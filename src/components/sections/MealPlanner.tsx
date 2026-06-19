"use client";
import { useState, useEffect, useRef } from "react";
import type { MealFoodsData, MealFood, MealPlan, MealKey } from "@/types";
import { MEAL_PLANNER, kitchenGroups } from "@/lib/meal-planner-config";

function genId() {
  return (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
}
function isoAddDays(n: number) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().split("T")[0]; }
function prettyDate(iso: string) { return new Date(iso + "T12:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }); }
const r1 = (n: number) => Math.round(n * 10) / 10;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function MealPlanner({ meal, onApply }: {
  meal: MealKey;
  onApply: (date: string, items: { name: string; qty_g: number }[]) => Promise<void>;
}) {
  const cfg = MEAL_PLANNER[meal]!;
  const SLOTS = cfg.slots;
  const CATEGORIES = cfg.categories;

  const [fd, setFd] = useState<MealFoodsData | null>(null);
  const [plans, setPlans] = useState<Record<string, MealPlan>>({});
  const [applied, setApplied] = useState<string[]>([]);
  const [tab, setTab] = useState<"plan" | "foods" | "notes">("plan");
  const [loading, setLoading] = useState(true);
  const [planDate, setPlanDate] = useState(isoAddDays(1));
  const [confirmApply, setConfirmApply] = useState(false);
  const [applying, setApplying] = useState(false);
  const [servings, setServings] = useState(1);   // people eating — scales the kitchen list only

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/meal-foods/${meal}`).then(r => r.json()),
      fetch(`/api/meal-plans/${meal}`).then(r => r.json()),
    ]).then(([f, p]) => {
      setFd(f.data);
      setPlans(p.data?.plans ?? {});
      setApplied(p.data?.applied ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [meal]);

  // Date chips: next 21 days, minus already-applied dates (and past, since it starts today)
  const dateChips = Array.from({ length: 21 }, (_, i) => {
    const iso = isoAddDays(i);
    const d = new Date(iso + "T12:00:00");
    return { iso, weekday: WEEKDAYS[d.getDay()], day: d.getDate(), month: MONTHS[d.getMonth()], isToday: i === 0 };
  }).filter(c => !applied.includes(c.iso));

  // Keep the selected date valid (earliest available) as applied dates change
  useEffect(() => {
    if (dateChips.length && !dateChips.some(c => c.iso === planDate)) setPlanDate(dateChips[0].iso);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied, meal]);

  // ── persistence (debounced) ────────────────────────────────────────────────
  const foodsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function persistFoods(next: MealFoodsData) {
    setFd(next);
    if (foodsTimer.current) clearTimeout(foodsTimer.current);
    foodsTimer.current = setTimeout(() => {
      fetch(`/api/meal-foods/${meal}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: next }) });
    }, 500);
  }
  const planTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function persistPlan(date: string, plan: MealPlan) {
    setPlans(p => ({ ...p, [date]: plan }));
    if (planTimer.current) clearTimeout(planTimer.current);
    planTimer.current = setTimeout(() => {
      fetch(`/api/meal-plans/${meal}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date, plan }) });
    }, 500);
  }

  async function applyNow() {
    const plan = plans[planDate] ?? {};
    const items = Object.values(plan).filter(s => s.item && s.qty_g > 0).map(s => ({ name: s.item, qty_g: s.qty_g }));
    if (items.length === 0) { setConfirmApply(false); return; }
    setApplying(true);
    try {
      await onApply(planDate, items);
      await fetch(`/api/meal-plans/${meal}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: planDate, applied: true }) });
      setApplied(a => a.includes(planDate) ? a : [...a, planDate]);   // date disappears from the picker
      setPlans(p => { const n = { ...p }; delete n[planDate]; return n; });
    } finally {
      setApplying(false);
      setConfirmApply(false);
    }
  }

  // Plain-text "kitchen list" — grouped into kitchen prep stages (slow-cook items first,
  // ready-to-serve last) so it reads like a cooking sequence, and scaled by the number of
  // people eating (servings affects this list ONLY, not the plate/totals).
  function planText(): string {
    const plan = plans[planDate] ?? {};
    const chosen = SLOTS
      .map(s => plan[s.id])
      .filter((c): c is { item: string; qty_g: number } => !!c?.item && c.qty_g > 0)
      .map(c => ({ item: c.item, qty_g: Math.round(c.qty_g * servings) }));
    if (chosen.length === 0) return "";
    const who = servings === 1 ? "" : ` · for ${servings} people`;
    const head = `🍽️ ${cfg.title} — ${prettyDate(planDate)}${who}`;
    const groups = kitchenGroups(chosen, fd!.foods);
    const line = (c: { item: string; qty_g: number }) => `• ${c.item} — ${c.qty_g}g`;
    // Single stage → no need for headers; otherwise label each stage and space them out.
    const body = groups.length <= 1
      ? groups.flatMap(g => g.items).map(line).join("\n")
      : groups.map(g => `${g.stage.emoji} ${g.stage.label}\n${g.items.map(line).join("\n")}`).join("\n\n");
    return `${head}\n\n${body}`;
  }
  function shareWhatsApp() {
    const text = planText();
    if (!text) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  }

  if (loading || !fd) {
    return <div className="card p-5 text-center text-sm" style={{ color: "#475569" }}>Loading {cfg.title.toLowerCase()} planner…</div>;
  }

  const foodByName = (name: string) => fd.foods.find(f => f.item === name);
  const target = fd.target;

  function nutri(plan: MealPlan, slotId: string) {
    const c = plan[slotId];
    const food = c?.item ? foodByName(c.item) : undefined;
    if (!c?.item || !food) return { kcal: 0, protein: 0, carbs: 0, fiber: 0, food };
    const q = (c.qty_g || 0) / 100;
    return { kcal: q * food.kcal_100g, protein: q * food.protein_100g, carbs: q * food.carbs_100g, fiber: q * food.fiber_100g, food };
  }
  function totals(plan: MealPlan) {
    return SLOTS.reduce((t, s) => {
      const n = nutri(plan, s.id);
      return { kcal: t.kcal + n.kcal, protein: t.protein + n.protein, carbs: t.carbs + n.carbs, fiber: t.fiber + n.fiber };
    }, { kcal: 0, protein: 0, carbs: 0, fiber: 0 });
  }

  // ── editable plate ──────────────────────────────────────────────────────────
  // NOTE: this is a render *function* (called inline as {renderPlate(date)}),
  // NOT a nested component. Rendering it as <PlateTable/> would give it a new
  // identity each keystroke and remount the inputs, dropping cursor focus.
  function renderPlate(date: string) {
    const plan = plans[date] ?? {};
    const t = totals(plan);
    const grid = "minmax(96px,1.4fr) minmax(150px,2fr) 64px 60px 48px 48px 48px";

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
        <div className="grid gap-2 pb-1" style={{ gridTemplateColumns: grid, borderBottom: "1px solid var(--border)" }}>
          {["Slot", "Item", "Qty (g)", "kcal", "P", "C", "F"].map((h, i) => (
            <div key={h} className="text-xs" style={{ color: "#64748b", textAlign: i >= 2 ? "right" : "left" }}>{h}</div>
          ))}
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
              <div>
                <select className="nb-input-sm w-full" value={c?.item ?? ""} onChange={e => setItem(slot.id, e.target.value)}>
                  <option value="">— skip —</option>
                  {opts.map(f => <option key={f.id} value={f.item}>{f.item}</option>)}
                </select>
                {n.food?.typical_unit && n.food.typical_unit !== "-" && <div style={{ fontSize: 10, color: "#475569" }}>{n.food.typical_unit}</div>}
              </div>
              <input type="number" min="0" step="1" className="nb-input-sm text-right" disabled={!c?.item}
                value={c?.item ? (c.qty_g || "") : ""} placeholder="g"
                onChange={e => setQty(slot.id, parseInt(e.target.value) || 0)} />
              <div className="text-xs text-right tabular-nums" style={{ color: "#fb923c" }}>{n.kcal ? Math.round(n.kcal) : "—"}</div>
              <div className="text-xs text-right tabular-nums" style={{ color: "#a78bfa" }}>{n.protein ? r1(n.protein) : "—"}</div>
              <div className="text-xs text-right tabular-nums" style={{ color: "#60a5fa" }}>{n.carbs ? r1(n.carbs) : "—"}</div>
              <div className="text-xs text-right tabular-nums" style={{ color: "#2dd4bf" }}>{n.fiber ? r1(n.fiber) : "—"}</div>
            </div>
          );
        })}
        {/* totals + target */}
        {[
          { label: "TOTAL PLATE", vals: [Math.round(t.kcal), r1(t.protein), r1(t.carbs), r1(t.fiber)], bold: true },
          { label: "Target (guide)", vals: [target.kcal, target.protein, target.carbs, target.fiber], bold: false },
        ].map((row, i) => (
          <div key={i} className="grid gap-2 items-center pt-1" style={{ gridTemplateColumns: grid, borderTop: i === 0 ? "1px solid var(--border)" : undefined }}>
            <div className="text-xs font-semibold" style={{ color: row.bold ? "#fff" : "#475569", gridColumn: "1 / 4" }}>{row.label}</div>
            {row.vals.map((v, j) => (
              <div key={j} className="text-xs text-right tabular-nums" style={{ color: row.bold ? ["#fb923c", "#a78bfa", "#60a5fa", "#2dd4bf"][j] : "#64748b", fontWeight: row.bold ? 700 : 400 }}>{v}</div>
            ))}
          </div>
        ))}
        {/* vs target in words */}
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
              const over = d.diff < 0;
              const color = onTarget ? "#22c55e" : over ? "#f59e0b" : "#2dd4bf";
              const text = onTarget ? "on target" : over ? `${d.round(-d.diff)}${d.unit} over` : `${d.round(d.diff)}${d.unit} short`;
              return (
                <span key={d.label} className="text-xs px-2 py-1 rounded-lg" style={{ background: `${color}14`, color, border: `1px solid ${color}33` }}>
                  {onTarget ? "✓" : over ? "▲" : "▼"} {d.label}: {text}
                </span>
              );
            })}
          </div>
          <div style={{ fontSize: 10, color: "#475569" }}>
            ▼ <span style={{ color: "#2dd4bf" }}>short</span> = under target (room left) · ▲ <span style={{ color: "#f59e0b" }}>over</span> = exceeded target
          </div>
        </div>
      </div>
    );
  }

  // ── Foods editor ────────────────────────────────────────────────────────────
  function updateFood(id: string, patch: Partial<MealFood>) {
    persistFoods({ ...fd!, foods: fd!.foods.map(f => f.id === id ? { ...f, ...patch } : f) });
  }
  function removeFood(id: string) { persistFoods({ ...fd!, foods: fd!.foods.filter(f => f.id !== id) }); }
  function addFood(category: string) {
    persistFoods({ ...fd!, foods: [...fd!.foods, { id: genId(), category, item: "New item", kcal_100g: 0, protein_100g: 0, carbs_100g: 0, fiber_100g: 0, cooking_method: "", typical_unit: "", notes: "" }] });
  }

  const plan = plans[planDate] ?? {};
  const hasItems = Object.values(plan).some(s => s.item && s.qty_g > 0);

  return (
    <div className="card p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">🗓️</span>
          <div>
            <div className="text-sm font-semibold text-white">{cfg.title} Planner</div>
            <div className="text-xs" style={{ color: "#475569" }}>Pick a day, build the plate, then Apply to log it</div>
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
          <div>
            <div className="text-xs mb-1.5" style={{ color: "#64748b" }}>Plan {cfg.title.toLowerCase()} for</div>
            {dateChips.length === 0 ? (
              <p className="text-xs" style={{ color: "#334155" }}>No upcoming days to plan.</p>
            ) : (
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {dateChips.map(c => {
                  const active = c.iso === planDate;
                  return (
                    <button key={c.iso} onClick={() => { setPlanDate(c.iso); setConfirmApply(false); }}
                      className="shrink-0 flex flex-col items-center px-2.5 py-1.5 rounded-xl transition-all"
                      style={active
                        ? { background: "rgba(20,184,166,0.15)", color: "#14b8a6", border: "1px solid rgba(20,184,166,0.4)" }
                        : { background: "rgba(255,255,255,0.03)", color: "#64748b", border: "1px solid var(--border)" }}>
                      <span style={{ fontSize: 10 }}>{c.isToday ? "Today" : c.weekday}</span>
                      <span className="text-sm font-bold leading-none">{c.day}</span>
                      <span style={{ fontSize: 9, opacity: 0.8 }}>{c.month}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(20,184,166,0.05)", border: "1px solid rgba(20,184,166,0.2)" }}>
            <div className="text-xs font-semibold" style={{ color: "#14b8a6" }}>Plate for {prettyDate(planDate)}</div>
            {renderPlate(planDate)}
          </div>

          <div className="text-xs" style={{ color: "#334155" }}>Enter raw / dry weight in grams. Leave a slot on “— skip —” to drop it.</div>

          {/* Kitchen list — item + grams only, scaled by people, sent to WhatsApp */}
          {hasItems && (
            <div className="rounded-xl p-3 space-y-2.5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-xs font-semibold" style={{ color: "#94a3b8" }}>📋 Kitchen list — in cooking order</div>
                {/* People stepper — scales this list only */}
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: "#64748b" }}>People eating</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setServings(s => Math.max(1, s - 1))}
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-sm font-bold"
                      style={{ background: "rgba(255,255,255,0.05)", color: "#94a3b8", border: "1px solid var(--border)" }}>−</button>
                    <span className="text-sm font-bold tabular-nums" style={{ color: "#14b8a6", minWidth: 18, textAlign: "center" }}>{servings}</span>
                    <button onClick={() => setServings(s => Math.min(12, s + 1))}
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-sm font-bold"
                      style={{ background: "rgba(20,184,166,0.12)", color: "#14b8a6", border: "1px solid rgba(20,184,166,0.3)" }}>+</button>
                  </div>
                </div>
              </div>
              {servings > 1 && (
                <div className="text-xs" style={{ color: "#475569" }}>Quantities below are scaled ×{servings} for {servings} people (the plate above stays per-person).</div>
              )}
              <pre className="text-xs whitespace-pre-wrap" style={{ color: "#cbd5e1", fontFamily: "inherit", margin: 0 }}>{planText()}</pre>
              <button onClick={shareWhatsApp}
                className="w-full py-2 rounded-xl text-xs font-medium transition-all"
                style={{ background: "rgba(37,211,102,0.12)", color: "#25d366", border: "1px solid rgba(37,211,102,0.4)" }}>
                💬 Send to WhatsApp
              </button>
            </div>
          )}

          {!confirmApply ? (
            <button onClick={() => setConfirmApply(true)} disabled={!hasItems}
              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={hasItems
                ? { background: "rgba(20,184,166,0.15)", color: "#14b8a6", border: "1px solid rgba(20,184,166,0.4)" }
                : { background: "rgba(255,255,255,0.04)", color: "#334155", border: "1px solid var(--border)", cursor: "not-allowed" }}>
              ✓ Apply to {prettyDate(planDate)} {cfg.title.toLowerCase()}
            </button>
          ) : (
            <div className="rounded-xl p-3 space-y-3" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.3)" }}>
              <div className="flex items-start gap-2">
                <span>⚠️</span>
                <div className="text-xs" style={{ color: "#fcd34d" }}>
                  This logs the plate into <strong>{prettyDate(planDate)}</strong>&apos;s <strong>Logged for {cfg.title}</strong> and then the plan is <strong>cleared</strong> and that day is removed from the picker. This can&apos;t be undone.
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={applyNow} disabled={applying}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: "rgba(245,158,11,0.18)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.45)" }}>
                  {applying ? "Applying…" : "Apply & clear plan"}
                </button>
                <button onClick={() => setConfirmApply(false)} disabled={applying}
                  className="px-4 py-2 rounded-xl text-sm transition-all"
                  style={{ background: "rgba(255,255,255,0.04)", color: "#64748b", border: "1px solid var(--border)" }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
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
                            onChange={e => updateFood(f.id, { [k]: parseFloat(e.target.value) || 0 } as Partial<MealFood>)} />
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
          <textarea className="nb-input w-full resize-y" style={{ minHeight: 320, fontFamily: "inherit", lineHeight: 1.6 }}
            value={fd.notes} onChange={e => persistFoods({ ...fd, notes: e.target.value })} />
        </div>
      )}
    </div>
  );
}
