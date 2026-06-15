"use client";
import { useState, useEffect, useRef } from "react";
import type { BreakfastFoodsData, BreakfastFood, BreakfastPlan } from "@/types";

const SLOTS = [
  { id: "base",    label: "Base (cereal/legume)", category: "Base" },
  { id: "protein", label: "Eggs / Protein",       category: "Protein" },
  { id: "dairy",   label: "Dairy",                category: "Dairy" },
  { id: "veg",     label: "Vegetables",           category: "Veg" },
  { id: "fruit",   label: "Fruit",                category: "Fruit" },
  { id: "nuts",    label: "Nuts & Seeds",         category: "Nuts & Seeds" },
  { id: "fat",     label: "Cooking Fat",          category: "Cooking Fat" },
] as const;
const CATEGORIES = ["Base", "Protein", "Dairy", "Veg", "Fruit", "Nuts & Seeds", "Cooking Fat"];

function genId() {
  return (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
}
function isoAddDays(n: number) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().split("T")[0]; }
function prettyDate(iso: string) { return new Date(iso + "T12:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }); }
const r1 = (n: number) => Math.round(n * 10) / 10;

export default function BreakfastPlanner() {
  const [fd, setFd] = useState<BreakfastFoodsData | null>(null);
  const [plans, setPlans] = useState<Record<string, BreakfastPlan>>({});
  const [tab, setTab] = useState<"plan" | "foods" | "notes">("plan");
  const [loading, setLoading] = useState(true);

  const today = isoAddDays(0);
  const tomorrow = isoAddDays(1);

  useEffect(() => {
    Promise.all([
      fetch("/api/breakfast-foods").then(r => r.json()),
      fetch("/api/breakfast-plans").then(r => r.json()),
    ]).then(([f, p]) => {
      setFd(f.data);
      setPlans(p.data?.plans ?? {});
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // ── persistence (debounced) ────────────────────────────────────────────────
  const foodsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function persistFoods(next: BreakfastFoodsData) {
    setFd(next);
    if (foodsTimer.current) clearTimeout(foodsTimer.current);
    foodsTimer.current = setTimeout(() => {
      fetch("/api/breakfast-foods", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: next }) });
    }, 500);
  }
  const planTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function persistPlan(date: string, plan: BreakfastPlan) {
    setPlans(p => ({ ...p, [date]: plan }));
    if (planTimer.current) clearTimeout(planTimer.current);
    planTimer.current = setTimeout(() => {
      fetch("/api/breakfast-plans", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date, plan }) });
    }, 500);
  }

  if (loading || !fd) {
    return <div className="card p-5 text-center text-sm" style={{ color: "#475569" }}>Loading breakfast planner…</div>;
  }

  const foodByName = (name: string) => fd.foods.find(f => f.item === name);
  const target = fd.target;

  function nutri(plan: BreakfastPlan, slotId: string) {
    const c = plan[slotId];
    const food = c?.item ? foodByName(c.item) : undefined;
    if (!c?.item || !food) return { kcal: 0, protein: 0, carbs: 0, fiber: 0, food };
    const q = (c.qty_g || 0) / 100;
    return { kcal: q * food.kcal_100g, protein: q * food.protein_100g, carbs: q * food.carbs_100g, fiber: q * food.fiber_100g, food };
  }
  function totals(plan: BreakfastPlan) {
    return SLOTS.reduce((t, s) => {
      const n = nutri(plan, s.id);
      return { kcal: t.kcal + n.kcal, protein: t.protein + n.protein, carbs: t.carbs + n.carbs, fiber: t.fiber + n.fiber };
    }, { kcal: 0, protein: 0, carbs: 0, fiber: 0 });
  }

  // ── plate table (editable for tomorrow, read-only/frozen otherwise) ─────────
  function PlateTable({ date, editable }: { date: string; editable: boolean }) {
    const plan = plans[date] ?? {};
    const t = totals(plan);
    const grid = "minmax(96px,1.4fr) minmax(150px,2fr) 64px 60px 48px 48px 48px";
    const Cell = ({ children, color = "#94a3b8", right = false }: { children: React.ReactNode; color?: string; right?: boolean }) =>
      <div className="text-xs tabular-nums" style={{ color, textAlign: right ? "right" : "left" }}>{children}</div>;

    function setItem(slotId: string, item: string) {
      const next = { ...plan };
      if (!item) delete next[slotId];
      else next[slotId] = { item, qty_g: next[slotId]?.qty_g || 0 };
      persistPlan(date, next);
    }
    function setQty(slotId: string, qty: number) {
      const cur = plan[slotId];
      if (!cur?.item) return;
      persistPlan(date, { ...plan, [slotId]: { ...cur, qty_g: qty } });
    }

    return (
      <div className="space-y-1">
        {/* header */}
        <div className="grid gap-2 pb-1" style={{ gridTemplateColumns: grid, borderBottom: "1px solid var(--border)" }}>
          <Cell color="#64748b">Slot</Cell><Cell color="#64748b">Item</Cell>
          <Cell color="#64748b" right>Qty (g)</Cell><Cell color="#64748b" right>kcal</Cell>
          <Cell color="#64748b" right>P</Cell><Cell color="#64748b" right>C</Cell><Cell color="#64748b" right>F</Cell>
        </div>
        {SLOTS.map(slot => {
          const c = plan[slot.id];
          const n = nutri(plan, slot.id);
          const opts = fd!.foods.filter(f => f.category === slot.category);
          return (
            <div key={slot.id} className="grid gap-2 items-center py-1" style={{ gridTemplateColumns: grid }}>
              <div>
                <div className="text-xs font-medium text-white leading-tight">{slot.label}</div>
                {n.food?.cooking_method && <div style={{ fontSize: 10, color: "#475569" }}>{n.food.cooking_method}</div>}
              </div>
              {editable ? (
                <div>
                  <select className="nb-input-sm w-full" value={c?.item ?? ""} onChange={e => setItem(slot.id, e.target.value)}>
                    <option value="">— skip —</option>
                    {opts.map(f => <option key={f.id} value={f.item}>{f.item}</option>)}
                  </select>
                  {n.food?.typical_unit && n.food.typical_unit !== "-" && (
                    <div style={{ fontSize: 10, color: "#475569" }}>{n.food.typical_unit}</div>
                  )}
                </div>
              ) : (
                <div className="text-xs" style={{ color: c?.item ? "white" : "#334155" }}>
                  {c?.item || "— skip —"}
                  {n.food?.typical_unit && n.food.typical_unit !== "-" && <span style={{ color: "#475569" }}> · {n.food.typical_unit}</span>}
                </div>
              )}
              {editable ? (
                <input type="number" min="0" step="1" className="nb-input-sm text-right" disabled={!c?.item}
                  value={c?.item ? (c.qty_g || "") : ""} placeholder="g"
                  onChange={e => setQty(slot.id, parseInt(e.target.value) || 0)} />
              ) : <Cell right color="#94a3b8">{c?.item ? (c.qty_g || 0) : "—"}</Cell>}
              <Cell right color="#fb923c">{n.kcal ? Math.round(n.kcal) : "—"}</Cell>
              <Cell right color="#a78bfa">{n.protein ? r1(n.protein) : "—"}</Cell>
              <Cell right color="#60a5fa">{n.carbs ? r1(n.carbs) : "—"}</Cell>
              <Cell right color="#2dd4bf">{n.fiber ? r1(n.fiber) : "—"}</Cell>
            </div>
          );
        })}
        {/* totals + target */}
        {[
          { label: "TOTAL PLATE", vals: [Math.round(t.kcal), r1(t.protein), r1(t.carbs), r1(t.fiber)], bold: true, color: "#fff" },
          { label: "Target (guide)", vals: [target.kcal, target.protein, target.carbs, target.fiber], bold: false, color: "#475569" },
        ].map((row, i) => (
          <div key={i} className="grid gap-2 items-center pt-1" style={{ gridTemplateColumns: grid, borderTop: i === 0 ? "1px solid var(--border)" : undefined }}>
            <div className="text-xs font-semibold" style={{ color: row.color ?? "#94a3b8", gridColumn: "1 / 4" }}>{row.label}</div>
            {row.vals.map((v, j) => (
              <div key={j} className="text-xs text-right tabular-nums" style={{ color: row.bold ? ["#fb923c", "#a78bfa", "#60a5fa", "#2dd4bf"][j] : "#64748b", fontWeight: row.bold ? 700 : 400 }}>{v}</div>
            ))}
          </div>
        ))}

        {/* vs target — in plain words */}
        <div className="pt-2 space-y-1.5" style={{ borderTop: "1px dashed var(--border)" }}>
          <div className="text-xs font-semibold" style={{ color: "#94a3b8" }}>How the plate compares to the target</div>
          <div className="flex flex-wrap gap-1.5">
            {([
              { label: "Calories", unit: " kcal", diff: target.kcal - t.kcal, round: (x: number) => Math.round(x) },
              { label: "Protein", unit: "g", diff: target.protein - t.protein, round: r1 },
              { label: "Carbs", unit: "g", diff: target.carbs - t.carbs, round: r1 },
              { label: "Fiber", unit: "g", diff: target.fiber - t.fiber, round: r1 },
            ]).map(d => {
              const onTarget = Math.abs(d.diff) < (d.unit === " kcal" ? 1 : 0.1);
              const over = d.diff < 0;                 // plate exceeds target
              const color = onTarget ? "#22c55e" : over ? "#f59e0b" : "#2dd4bf";
              const text = onTarget
                ? "on target"
                : over
                  ? `${d.round(-d.diff)}${d.unit} over`
                  : `${d.round(d.diff)}${d.unit} short`;
              return (
                <span key={d.label} className="text-xs px-2 py-1 rounded-lg"
                  style={{ background: `${color}14`, color, border: `1px solid ${color}33` }}>
                  {onTarget ? "✓" : over ? "▲" : "▼"} {d.label}: {text}
                </span>
              );
            })}
          </div>
          <div style={{ fontSize: 10, color: "#475569" }}>
            ▼ <span style={{ color: "#2dd4bf" }}>short</span> = under target (room left) · ▲ <span style={{ color: "#f59e0b" }}>over</span> = exceeded target (trim nuts / oil / base)
          </div>
        </div>
      </div>
    );
  }

  // ── Foods editor ────────────────────────────────────────────────────────────
  function updateFood(id: string, patch: Partial<BreakfastFood>) {
    persistFoods({ ...fd!, foods: fd!.foods.map(f => f.id === id ? { ...f, ...patch } : f) });
  }
  function removeFood(id: string) { persistFoods({ ...fd!, foods: fd!.foods.filter(f => f.id !== id) }); }
  function addFood(category: string) {
    persistFoods({ ...fd!, foods: [...fd!.foods, { id: genId(), category, item: "New item", kcal_100g: 0, protein_100g: 0, carbs_100g: 0, fiber_100g: 0, cooking_method: "", typical_unit: "", notes: "" }] });
  }

  return (
    <div className="card p-4 space-y-4">
      {/* header + tabs */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">🗓️</span>
          <div>
            <div className="text-sm font-semibold text-white">Breakfast Planner</div>
            <div className="text-xs" style={{ color: "#475569" }}>Plan tomorrow&apos;s plate — it auto-fills as that day&apos;s breakfast log</div>
          </div>
        </div>
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
          {([["plan", "🍽️ Plan"], ["foods", "📚 Foods"], ["notes", "📖 Notes"]] as const).map(([t, lbl]) => (
            <button key={t} onClick={() => setTab(t)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={tab === t ? { background: "rgba(20,184,166,0.15)", color: "#14b8a6", border: "1px solid rgba(20,184,166,0.35)" } : { color: "#64748b" }}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* ── PLAN TAB ── */}
      {tab === "plan" && (
        <div className="space-y-4">
          <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(20,184,166,0.05)", border: "1px solid rgba(20,184,166,0.2)" }}>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold" style={{ color: "#14b8a6" }}>Planning for {prettyDate(tomorrow)}</span>
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(20,184,166,0.12)", color: "#5eead4" }}>editable</span>
              <span className="ml-auto text-xs" style={{ color: "#475569" }}>only tomorrow can be edited</span>
            </div>
            <PlateTable date={tomorrow} editable />
          </div>

          {plans[today] && Object.keys(plans[today]).length > 0 && (
            <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white">Today&apos;s locked plan · {prettyDate(today)}</span>
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.06)", color: "#64748b" }}>🔒 frozen</span>
                <span className="ml-auto text-xs" style={{ color: "#475569" }}>auto-logged to today&apos;s breakfast</span>
              </div>
              <PlateTable date={today} editable={false} />
            </div>
          )}

          <div className="text-xs" style={{ color: "#334155" }}>
            Enter raw / dry weight in grams. Leave a slot on “— skip —” to drop it.
          </div>
        </div>
      )}

      {/* ── FOODS TAB ── */}
      {tab === "foods" && (
        <div className="space-y-4">
          <p className="text-xs" style={{ color: "#64748b" }}>Per-100g database. Edits save automatically and power the dropdowns above.</p>
          {CATEGORIES.map(cat => {
            const list = fd.foods.filter(f => f.category === cat);
            return (
              <div key={cat} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold" style={{ color: "#5eead4" }}>{cat}</div>
                  <button onClick={() => addFood(cat)} className="text-xs px-2 py-0.5 rounded-lg" style={{ background: "rgba(20,184,166,0.1)", color: "#14b8a6", border: "1px solid rgba(20,184,166,0.25)" }}>+ Add</button>
                </div>
                {list.map(f => (
                  <div key={f.id} className="rounded-lg p-2 space-y-1.5" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid var(--border)" }}>
                    <div className="flex items-center gap-2">
                      <input className="nb-input-sm flex-1" value={f.item} onChange={e => updateFood(f.id, { item: e.target.value })} placeholder="Item name" />
                      <button onClick={() => removeFood(f.id)} className="text-xs px-1.5" style={{ color: "#475569" }} title="Remove">✕</button>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {([["kcal_100g", "kcal/100g"], ["protein_100g", "Protein"], ["carbs_100g", "Carbs"], ["fiber_100g", "Fiber"]] as const).map(([k, lbl]) => (
                        <div key={k}>
                          <label style={{ fontSize: 9, color: "#475569" }}>{lbl}</label>
                          <input type="number" min="0" step="0.1" className="nb-input-sm w-full text-center" value={f[k] || ""} placeholder="0"
                            onChange={e => updateFood(f.id, { [k]: parseFloat(e.target.value) || 0 } as Partial<BreakfastFood>)} />
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <input className="nb-input-sm" value={f.cooking_method} placeholder="Cooking method" onChange={e => updateFood(f.id, { cooking_method: e.target.value })} />
                      <input className="nb-input-sm" value={f.typical_unit} placeholder="Typical unit" onChange={e => updateFood(f.id, { typical_unit: e.target.value })} />
                      <input className="nb-input-sm" value={f.notes} placeholder="Notes" onChange={e => updateFood(f.id, { notes: e.target.value })} />
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* ── NOTES TAB ── */}
      {tab === "notes" && (
        <div className="space-y-2">
          <p className="text-xs" style={{ color: "#64748b" }}>Your planner notes (the old README). Edits save automatically.</p>
          <textarea
            className="nb-input w-full resize-y"
            style={{ minHeight: 320, fontFamily: "inherit", lineHeight: 1.6 }}
            value={fd.notes}
            onChange={e => persistFoods({ ...fd, notes: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}
