"use client";
import { useState } from "react";
import type { DayLog, FoodEntry, FoodItemsData, MealType } from "@/types";
import { autoCategory, resolveCategory } from "@/lib/food-utils";
import MealPlanner from "@/components/sections/MealPlanner";
import type { MealKey } from "@/types";

interface Props {
  dayLog: DayLog;
  foodItems: FoodItemsData;
  onUpdate: (food: Record<MealType, FoodEntry[]>) => void;
  onMealTimeUpdate: (meal: MealType, time: string) => void;
  /** Called when a custom item should be saved to food_items.json */
  onSaveToList: (meal: string, category: string, name: string) => Promise<void>;
  /** Called when an item should be removed from the pre-defined list */
  onRemoveFromList: (meal: string, category: string, name: string) => Promise<void>;
  /** Called when an item should be moved to a different category */
  onMoveItem: (meal: string, oldCat: string, newCat: string, name: string) => Promise<void>;
  /** Apply a planned plate to a date's meal log */
  onApplyMealPlan: (meal: MealType, date: string, items: { name: string; qty_g: number }[]) => Promise<void>;
}

// ─── Unit helpers ─────────────────────────────────────────────────────────────

const UNITS = ["g", "ml", "pieces", "cups", "tbsp", "tsp"] as const;

// ─── Meal meta ────────────────────────────────────────────────────────────────

const MEAL_META: Record<MealType, { label: string; icon: string; color: string; time: string }> = {
  breakfast: { label: "Breakfast", icon: "☀️", color: "#f59e0b", time: "7–9 AM"  },
  lunch:     { label: "Lunch",     icon: "🌤️", color: "#22c55e", time: "12–2 PM" },
  dinner:    { label: "Dinner",    icon: "🌙", color: "#a78bfa", time: "7–9 PM"  },
  snacks:    { label: "Snacks",    icon: "🍎", color: "#fb923c", time: "Any time" },
};

const MEALS: MealType[] = ["breakfast", "lunch", "dinner", "snacks"];

function genId() { return crypto.randomUUID(); }

// ─── Component ────────────────────────────────────────────────────────────────

export default function FoodLog({ dayLog, foodItems: _foodItems, onUpdate, onMealTimeUpdate, onSaveToList: _onSaveToList, onRemoveFromList: _onRemoveFromList, onMoveItem: _onMoveItem, onApplyMealPlan }: Props) {
  const [activeMeal, setActiveMeal] = useState<MealType>("breakfast");
  const [showPlanner, setShowPlanner] = useState(false);
  // ── Custom / cheat-meal entry (unplanned, eating-out days) ──
  const [showCustom, setShowCustom] = useState(false);
  const [cName, setCName]     = useState("");
  const [cQty, setCQty]       = useState("");
  const [cKcal, setCKcal]     = useState("");
  const [cProtein, setCProtein] = useState("");
  const [cCarbs, setCCarbs]   = useState("");
  const [cFiber, setCFiber]   = useState("");
  const [estimating, setEstimating] = useState(false);
  const [estimateErr, setEstimateErr] = useState("");

  const meal = activeMeal;
  const entries = dayLog.food[meal] ?? [];

  function resetCustom() {
    setCName(""); setCQty(""); setCKcal(""); setCProtein(""); setCCarbs(""); setCFiber("");
    setEstimateErr(""); setShowCustom(false);
  }

  // Log an unplanned / cheat-meal food by name (+ quantity) + calories (macros optional).
  // The calories are stored on the entry and used directly in Reports.
  function addCustomFood() {
    const name = cName.trim();
    const kcal = parseFloat(cKcal);
    if (!name || isNaN(kcal) || kcal <= 0) return;
    const num = (s: string) => { const n = parseFloat(s); return isNaN(n) || n < 0 ? undefined : n; };
    const qty = cQty.trim();
    const entry: FoodEntry = {
      id: genId(),
      name: qty ? `${name} (${qty})` : name,
      category: autoCategory(name),
      quantity_g: 1,
      unit: "serving",
      custom: true,
      logged_at: new Date().toISOString(),
      kcal: Math.round(kcal),
      protein_g: num(cProtein),
      carbs_g: num(cCarbs),
      fiber_g: num(cFiber),
    };
    onUpdate({ ...dayLog.food, [meal]: [...entries, entry] });
    resetCustom();
  }

  // ✨ Ask the AI to estimate calories + macros from the food name and quantity.
  async function estimateMacros() {
    const name = cName.trim();
    if (!name) { setEstimateErr("Enter a food name first"); return; }
    setEstimating(true); setEstimateErr("");
    try {
      const res = await fetch("/api/estimate-food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, quantity: cQty.trim() }),
      });
      const d = await res.json() as { kcal?: number; protein_g?: number; carbs_g?: number; fiber_g?: number; error?: string };
      if (!res.ok || d.error) throw new Error(d.error || "estimate failed");
      if (d.kcal != null) setCKcal(String(d.kcal));
      if (d.protein_g != null) setCProtein(String(d.protein_g));
      if (d.carbs_g != null) setCCarbs(String(d.carbs_g));
      if (d.fiber_g != null) setCFiber(String(d.fiber_g));
    } catch {
      setEstimateErr("Couldn't estimate — enter the calories manually.");
    } finally {
      setEstimating(false);
    }
  }

  // Update an already-logged entry (grams/unit for DB items, or kcal for cheat items)
  function updateEntry(id: string, patch: Partial<Pick<FoodEntry, "quantity_g" | "unit" | "kcal">>) {
    onUpdate({ ...dayLog.food, [meal]: entries.map(e => e.id === id ? { ...e, ...patch } : e) });
  }

  function removeEntry(id: string) {
    onUpdate({ ...dayLog.food, [meal]: entries.filter(e => e.id !== id) });
  }

  const totalItems = Object.values(dayLog.food).flat().length;

  return (
    <div className="p-6 max-w-4xl space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white">Food Log</h2>
        <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>
          {totalItems} item{totalItems !== 1 ? "s" : ""} logged today across all meals
        </p>
      </div>

      {/* Meal tabs */}
      <div className="flex gap-1.5 p-1 rounded-xl" style={{ background: "var(--bg-card)" }}>
        {MEALS.map(m => {
          const meta = MEAL_META[m];
          const count = dayLog.food[m]?.length ?? 0;
          const mealTime = dayLog.meal_times?.[m];
          return (
            <button key={m} onClick={() => { setActiveMeal(m); resetCustom(); }}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-lg text-sm font-medium transition-all"
              style={activeMeal === m
                ? { background: "rgba(255,255,255,0.07)", color: meta.color, boxShadow: `0 0 0 1px ${meta.color}30` }
                : { color: "#475569" }}>
              <span className="text-base leading-none">{meta.icon}</span>
              <span className="text-xs leading-tight">{meta.label}</span>
              {count > 0 && (
                <span className="text-xs opacity-60 leading-none">{count}</span>
              )}
              {mealTime && (
                <span className="text-xs font-normal tabular-nums leading-none"
                  style={{ color: activeMeal === m ? meta.color : "#334155", opacity: 0.8 }}>
                  {mealTime}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Meal label + time picker */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-lg">{MEAL_META[meal].icon}</span>
          <span className="text-sm font-semibold text-white">{MEAL_META[meal].label}</span>
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: "var(--bg-card)", color: "#475569" }}>{MEAL_META[meal].time}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "#475569" }}>Ate at</span>
          <input
            type="time"
            className="nb-input-sm"
            style={{ width: 108 }}
            value={dayLog.meal_times?.[meal] ?? ""}
            onChange={e => onMealTimeUpdate(meal, e.target.value)}
          />
          {dayLog.meal_times?.[meal] && (
            <button
              onClick={() => onMealTimeUpdate(meal, "")}
              className="text-xs transition-colors"
              style={{ color: "#334155" }}
              title="Clear time">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Meal Planner — breakfast, lunch & dinner */}
      {(meal === "breakfast" || meal === "lunch" || meal === "dinner") && (
        <div className="space-y-0">
          <button
            onClick={() => setShowPlanner(v => !v)}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all"
            style={{ background: "rgba(20,184,166,0.06)", border: "1px solid rgba(20,184,166,0.2)" }}>
            <span className="text-base">🗓️</span>
            <span className="text-sm font-semibold text-white">{MEAL_META[meal].label} Planner</span>
            <span className="text-xs" style={{ color: "#475569" }}>build &amp; apply a plate</span>
            <span className="ml-auto text-sm" style={{ color: "#14b8a6" }}>{showPlanner ? "▲" : "▼"}</span>
          </button>
          {showPlanner && (
            <div className="mt-3">
              <MealPlanner meal={meal as MealKey} onApply={(date, items) => onApplyMealPlan(meal, date, items)} />
            </div>
          )}
        </div>
      )}


      {/* Logged entries for this meal */}
      {entries.length > 0 && (
        <div className="card p-4 space-y-2">
          <div className="section-header mb-3">
            Logged for {MEAL_META[meal].label} · {entries.length} item{entries.length !== 1 ? "s" : ""}
          </div>
          {entries.map(entry => {
            const displayCat = resolveCategory(entry);
            return (
            <div key={entry.id}
              className="flex items-center gap-3 p-2.5 rounded-lg"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-white">{entry.name}</span>
                <span className="ml-2 text-xs" style={{ color: "#475569" }}>{displayCat}</span>
                {entry.kcal != null ? (
                  <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded font-medium"
                    style={{ background: "rgba(251,146,60,0.12)", color: "#fb923c", border: "1px solid rgba(251,146,60,0.25)" }}>🍔 custom</span>
                ) : entry.custom && (
                  <span className="ml-1.5 text-xs px-1 py-0.5 rounded"
                    style={{ background: "#1e293b", color: "#334155" }}>+added</span>
                )}
              </div>
              {entry.kcal != null ? (
                /* Cheat / custom entry — edit calories directly (no gram scaling) */
                <div className="flex items-center gap-1.5">
                  <input
                    type="number" min="0" step="10"
                    className="nb-input-sm text-center"
                    style={{ width: 72 }}
                    value={entry.kcal}
                    onChange={e => updateEntry(entry.id, { kcal: Math.round(parseFloat(e.target.value)) || 0 })}
                  />
                  <span className="text-xs" style={{ color: "#64748b" }}>kcal</span>
                </div>
              ) : (
                /* Inline quantity + unit edit */
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    className="nb-input-sm text-center"
                    style={{ width: 72 }}
                    value={entry.quantity_g}
                    onChange={e => updateEntry(entry.id, { quantity_g: parseFloat(e.target.value) || 0 })}
                  />
                  {/* Compact unit switcher */}
                  <select
                    className="nb-input-sm"
                    style={{ width: 66, paddingLeft: 6, paddingRight: 2 }}
                    value={entry.unit ?? "g"}
                    onChange={e => updateEntry(entry.id, { unit: e.target.value })}
                  >
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              )}
              <button onClick={() => removeEntry(entry.id)}
                className="text-xs p-1.5 rounded-lg transition-colors hover:bg-red-950/50"
                style={{ color: "#ef4444" }}>✕</button>
            </div>
            );
          })}
        </div>
      )}

      {/* Add an unplanned / custom food to [Meal] */}
      <div className="card p-4 space-y-3">
        <div className="section-header">Add a food to {MEAL_META[meal].label}</div>
        <p className="text-xs" style={{ color: "#475569" }}>
          Planned meals come from the <strong className="text-white">Planner</strong> above. Use this for unplanned / eating-out / cheat foods — log by name &amp; quantity and let AI estimate the calories, or enter them yourself.
        </p>
        {!showCustom ? (
          <button onClick={() => setShowCustom(true)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition-all"
            style={{ background: "rgba(251,146,60,0.08)", color: "#fb923c", border: "1px solid rgba(251,146,60,0.25)" }}>
            🍔 Eating out / cheat meal? Add a custom food
          </button>
        ) : (
          <div className="space-y-2.5 fade-in-up">
            <input className="nb-input w-full" placeholder="Food name — e.g. Restaurant biryani, Pizza"
              value={cName} onChange={e => setCName(e.target.value)} autoFocus />
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col">
                <label className="text-xs mb-0.5" style={{ color: "#94a3b8" }}>Quantity</label>
                <input className="nb-input-sm" style={{ width: 156 }} placeholder="e.g. 1 plate, 2 slices, 200 g"
                  value={cQty} onChange={e => setCQty(e.target.value)} />
              </div>
              <button onClick={estimateMacros} disabled={estimating || !cName.trim()}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={(!estimating && cName.trim())
                  ? { background: "rgba(167,139,250,0.15)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.35)" }
                  : { background: "transparent", color: "#334155", border: "1px solid var(--border)", opacity: 0.6 }}>
                {estimating ? "✨ Estimating…" : "✨ Estimate with AI"}
              </button>
            </div>
            {estimateErr && <div className="text-xs" style={{ color: "#f59e0b" }}>⚠ {estimateErr}</div>}
            <div className="flex flex-wrap gap-2">
              <div className="flex flex-col">
                <label className="text-xs mb-0.5" style={{ color: "#fb923c" }}>Calories *</label>
                <input className="nb-input-sm" style={{ width: 92 }} type="number" min="0" step="10" placeholder="e.g. 650"
                  value={cKcal} onChange={e => setCKcal(e.target.value)} onKeyDown={e => e.key === "Enter" && addCustomFood()} />
              </div>
              <div className="flex flex-col">
                <label className="text-xs mb-0.5" style={{ color: "#64748b" }}>Protein g</label>
                <input className="nb-input-sm" style={{ width: 80 }} type="number" min="0" placeholder="opt"
                  value={cProtein} onChange={e => setCProtein(e.target.value)} />
              </div>
              <div className="flex flex-col">
                <label className="text-xs mb-0.5" style={{ color: "#64748b" }}>Carbs g</label>
                <input className="nb-input-sm" style={{ width: 80 }} type="number" min="0" placeholder="opt"
                  value={cCarbs} onChange={e => setCCarbs(e.target.value)} />
              </div>
              <div className="flex flex-col">
                <label className="text-xs mb-0.5" style={{ color: "#64748b" }}>Fiber g</label>
                <input className="nb-input-sm" style={{ width: 80 }} type="number" min="0" placeholder="opt"
                  value={cFiber} onChange={e => setCFiber(e.target.value)} />
              </div>
            </div>
            <div className="text-xs" style={{ color: "#475569" }}>
              ✨ Estimate fills calories &amp; macros from the name + quantity. Only calories are required; tweak anything before adding. Counts toward today&apos;s nutrition as-is.
            </div>
            <div className="flex gap-2">
              <button onClick={addCustomFood} disabled={!cName.trim() || !cKcal.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={(cName.trim() && cKcal.trim())
                  ? { background: "rgba(251,146,60,0.15)", color: "#fb923c", border: "1px solid rgba(251,146,60,0.35)" }
                  : { background: "transparent", color: "#334155", border: "1px solid var(--border)", opacity: 0.5 }}>
                Add to {MEAL_META[meal].label} ✓
              </button>
              <button onClick={resetCustom} className="px-3 py-2 rounded-lg text-sm" style={{ color: "#475569" }}>Cancel</button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
