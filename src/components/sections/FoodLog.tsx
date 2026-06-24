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
type Unit = typeof UNITS[number];

/** Best-guess default unit from food name */
function guessUnit(name: string): Unit {
  const lc = name.toLowerCase();
  if (/coffee|tea|milk|juice|water|shake|smoothie|drink|beverage|soup|broth|liquid/i.test(lc)) return "ml";
  if (/egg\s*white|egg\s*yolk|egg$/i.test(lc)) return "pieces";
  if (/capsule|tablet|pill/i.test(lc)) return "pieces";
  return "g";
}

function UnitPicker({ value, onChange }: { value: string; onChange: (u: string) => void }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {UNITS.map(u => (
        <button
          key={u}
          type="button"
          onClick={() => onChange(u)}
          className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
          style={
            value === u
              ? { background: "rgba(20,184,166,0.18)", color: "#14b8a6", border: "1px solid rgba(20,184,166,0.45)" }
              : { background: "var(--bg-input)", color: "#64748b", border: "1px solid var(--border)" }
          }
        >
          {u}
        </button>
      ))}
    </div>
  );
}

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

interface PendingItem {
  name: string;
  category: string;
  qty: string;
  unit: string;
  custom: boolean;
}

export default function FoodLog({ dayLog, foodItems, onUpdate, onMealTimeUpdate, onSaveToList: _onSaveToList, onRemoveFromList: _onRemoveFromList, onMoveItem: _onMoveItem, onApplyMealPlan }: Props) {
  const [activeMeal, setActiveMeal] = useState<MealType>("breakfast");
  const [pendingItem, setPendingItem] = useState<PendingItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showPlanner, setShowPlanner] = useState(false);
  // ── Custom / cheat-meal entry (unplanned, eating-out days) ──
  const [showCustom, setShowCustom] = useState(false);
  const [cName, setCName]     = useState("");
  const [cKcal, setCKcal]     = useState("");
  const [cProtein, setCProtein] = useState("");
  const [cCarbs, setCCarbs]   = useState("");
  const [cFiber, setCFiber]   = useState("");

  const meal = activeMeal;
  const entries = dayLog.food[meal] ?? [];

  // ── Search pool: the pre-defined food_items.json list, deduplicated ──
  const searchPool: Array<{ name: string; category: string }> = (() => {
    const seen = new Set<string>();
    const pool: Array<{ name: string; category: string }> = [];
    for (const cats of Object.values(foodItems.meals)) {
      for (const [cat, items] of Object.entries(cats)) {
        for (const item of items) {
          const lc = item.toLowerCase();
          if (!seen.has(lc)) { seen.add(lc); pool.push({ name: item, category: cat }); }
        }
      }
    }
    return pool;
  })();

  const suggestions = searchQuery.trim().length >= 1
    ? searchPool
        .filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase().trim()))
        .slice(0, 12)
    : [];

  // ── Helpers ──────────────────────────────────────────────────────────────

  function isSelected(name: string) {
    return entries.some(e => e.name.toLowerCase() === name.toLowerCase());
  }

  function confirmPending() {
    if (!pendingItem) return;
    const qty = parseFloat(pendingItem.qty);
    if (isNaN(qty) || qty <= 0) { setPendingItem(null); return; }

    // If the JSON bucket is literally "Custom", run autoCategory so the entry
    // gets a meaningful label (e.g. a chip mis-filed in JSON "Custom" is still correct in the log).
    const resolvedCategory =
      pendingItem.category.toLowerCase() === "custom"
        ? autoCategory(pendingItem.name)
        : pendingItem.category;

    const entry: FoodEntry = {
      id: genId(),
      name: pendingItem.name,
      category: resolvedCategory,
      quantity_g: qty,
      unit: pendingItem.unit,
      custom: pendingItem.custom,
      logged_at: new Date().toISOString(),
    };
    onUpdate({ ...dayLog.food, [meal]: [...entries, entry] });
    setPendingItem(null);
  }

  // Log an unplanned / cheat-meal food by name + calories (macros optional). The
  // calories are stored on the entry and used directly in Reports.
  function addCustomFood() {
    const name = cName.trim();
    const kcal = parseFloat(cKcal);
    if (!name || isNaN(kcal) || kcal <= 0) return;
    const num = (s: string) => { const n = parseFloat(s); return isNaN(n) || n < 0 ? undefined : n; };
    const entry: FoodEntry = {
      id: genId(),
      name,
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
    setCName(""); setCKcal(""); setCProtein(""); setCCarbs(""); setCFiber("");
    setShowCustom(false);
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
            <button key={m} onClick={() => { setActiveMeal(m); setPendingItem(null); setSearchQuery(""); setShowSuggestions(false); }}
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

      {/* Pending quantity + unit input */}
      {pendingItem && (
        <div className="card p-4 space-y-3 fade-in-up"
          style={{ borderColor: "rgba(20,184,166,0.3)", border: "1px solid rgba(20,184,166,0.3)" }}>
          <div className="text-sm font-semibold text-white">
            How much <span style={{ color: "#14b8a6" }}>{pendingItem.name}</span> did you have?
          </div>

          {/* Unit picker */}
          <div>
            <div className="section-header mb-1.5">Unit</div>
            <UnitPicker value={pendingItem.unit} onChange={u => setPendingItem({ ...pendingItem, unit: u })} />
          </div>

          {/* Quantity */}
          <div className="flex gap-2 items-center">
            <input
              className="nb-input"
              style={{ maxWidth: 140 }}
              type="number"
              min="0.1"
              step="0.1"
              placeholder={pendingItem.unit === "g" ? "e.g. 100" : pendingItem.unit === "ml" ? "e.g. 200" : "e.g. 2"}
              value={pendingItem.qty}
              onChange={e => setPendingItem({ ...pendingItem, qty: e.target.value })}
              onKeyDown={e => e.key === "Enter" && confirmPending()}
              autoFocus
            />
            <span className="text-sm font-medium" style={{ color: "#64748b" }}>{pendingItem.unit}</span>
            <button onClick={confirmPending}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors ml-auto"
              style={{ background: "rgba(20,184,166,0.15)", color: "#14b8a6", border: "1px solid rgba(20,184,166,0.3)" }}>
              Add ✓
            </button>
            <button onClick={() => setPendingItem(null)}
              className="px-3 py-2 rounded-lg text-sm transition-colors"
              style={{ color: "#475569" }}>
              Cancel
            </button>
          </div>
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

      {/* Add food item to [Meal] plate */}
      <div className="card p-4 space-y-3">
        <div className="section-header">
          Add food item to {MEAL_META[meal].label} plate
        </div>
        <div className="relative">
          <input
            className="nb-input w-full"
            placeholder="Type to search from your food lists…"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onKeyDown={e => e.key === "Escape" && (setShowSuggestions(false))}
          />
          {showSuggestions && searchQuery.trim() && (
            <div
              className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl shadow-xl overflow-hidden"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", maxHeight: 256, overflowY: "auto" }}>
              {suggestions.length === 0 ? (
                <div className="px-4 py-3 text-sm" style={{ color: "#475569" }}>
                  Not in your food list — use <strong style={{ color: "#fb923c" }}>Add a custom food</strong> below to log it with calories, or add it to the planner&apos;s <strong className="text-white">Foods</strong> tab
                </div>
              ) : (
                suggestions.map(s => {
                  const already = isSelected(s.name);
                  return (
                    <button
                      key={s.name}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-white/5"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                      onMouseDown={() => {
                        if (!already) {
                          setPendingItem({ name: s.name, category: s.category, qty: "", unit: guessUnit(s.name), custom: false });
                          setSearchQuery("");
                          setShowSuggestions(false);
                        }
                      }}>
                      <span className={`text-sm ${already ? "opacity-50 line-through" : "text-white"}`}>
                        {s.name}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        {already && (
                          <span className="text-xs font-medium" style={{ color: "#14b8a6" }}>✓ added</span>
                        )}
                        {s.category && (
                          <span className="text-xs px-1.5 py-0.5 rounded"
                            style={{ background: "var(--bg-input)", color: "#64748b" }}>
                            {s.category}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
        <div className="text-xs" style={{ color: "#334155" }}>
          {searchPool.length} items in your food list — select one to set quantity
        </div>

        {/* Unplanned / cheat-meal: log a food by name + calories (for eating-out / no-plan days) */}
        <div className="pt-3" style={{ borderTop: "1px solid var(--border)" }}>
          {!showCustom ? (
            <button onClick={() => setShowCustom(true)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition-all"
              style={{ background: "rgba(251,146,60,0.08)", color: "#fb923c", border: "1px solid rgba(251,146,60,0.25)" }}>
              🍔 Eating out / cheat meal? Add a custom food with calories
            </button>
          ) : (
            <div className="space-y-2.5 fade-in-up">
              <div className="text-xs font-semibold text-white">Add a custom food <span style={{ color: "#64748b", fontWeight: 400 }}>(unplanned / cheat meal)</span></div>
              <input className="nb-input w-full" placeholder="Food name — e.g. Restaurant biryani, 2 pizza slices"
                value={cName} onChange={e => setCName(e.target.value)} autoFocus />
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
              <div className="text-xs" style={{ color: "#475569" }}>Only calories are required — enter the total for what you actually ate. It counts toward today&apos;s nutrition as-is (no gram scaling).</div>
              <div className="flex gap-2">
                <button onClick={addCustomFood} disabled={!cName.trim() || !cKcal.trim()}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  style={(cName.trim() && cKcal.trim())
                    ? { background: "rgba(251,146,60,0.15)", color: "#fb923c", border: "1px solid rgba(251,146,60,0.35)" }
                    : { background: "transparent", color: "#334155", border: "1px solid var(--border)", opacity: 0.5 }}>
                  Add to {MEAL_META[meal].label} ✓
                </button>
                <button onClick={() => { setShowCustom(false); setCName(""); setCKcal(""); setCProtein(""); setCCarbs(""); setCFiber(""); }}
                  className="px-3 py-2 rounded-lg text-sm" style={{ color: "#475569" }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
