"use client";
import { useState } from "react";
import type { DayLog, FoodEntry, FoodItemsData, FoodPreferences, FoodPreferenceItem, MealType } from "@/types";
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
  /** Current avoid / encourage preference lists */
  foodPrefs: FoodPreferences;
  /** Called when either preference list changes */
  onUpdatePrefs: (prefs: FoodPreferences) => Promise<void>;
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

// ─── PrefListCard sub-component ──────────────────────────────────────────────

interface PrefListCardProps {
  title: string;
  icon: string;
  subtitle: string;
  accentColor: string;
  accentBg: string;
  accentBorder: string;
  accentText: string;
  items: FoodPreferenceItem[];
  catFilter: string;
  setCatFilter: (c: string) => void;
  getCategories: (list: FoodPreferenceItem[]) => string[];
  onToggle: (name: string) => void;
  onDelete: (name: string) => void;
  showAdd: boolean;
  setShowAdd: (v: boolean) => void;
  newName: string; setNewName: (v: string) => void;
  newCat: string;  setNewCat:  (v: string) => void;
  newNotes: string; setNewNotes: (v: string) => void;
  onAdd: () => void;
  addPlaceholder: string;
}

function PrefListCard({
  title, icon, subtitle, accentColor, accentBg, accentBorder, accentText,
  items, catFilter, setCatFilter, getCategories, onToggle, onDelete,
  showAdd, setShowAdd, newName, setNewName, newCat, setNewCat, newNotes, setNewNotes,
  onAdd, addPlaceholder,
}: PrefListCardProps) {
  const cats = getCategories(items);
  const enabledCount = items.filter(i => i.enabled).length;
  const filtered = catFilter ? items.filter(i => i.category === catFilter) : items;

  const FREQ_COLORS: Record<string, string> = {
    "Strictly Avoid": "#ef4444",
    "Strictly Limit": "#f97316",
    "Avoid": "#f87171",
    "Limit": "#fb923c",
    "Time Separately": "#f59e0b",
    "Daily": "#22c55e",
    "3x Weekly": "#14b8a6",
    "Weekly": "#60a5fa",
    "Regular": "#a78bfa",
  };
  function freqColor(freq: string) {
    return FREQ_COLORS[freq] ?? "#64748b";
  }

  return (
    <div className="card p-4 space-y-3" style={{ borderColor: accentBorder }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <div>
            <div className="text-sm font-semibold text-white">{title}</div>
            <div className="text-xs" style={{ color: "#475569" }}>
              {enabledCount} active · {items.length} total
              {items.length > enabledCount && (
                <span style={{ color: "#334155" }}> · {items.length - enabledCount} disabled</span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="text-xs px-2.5 py-1 rounded-lg transition-all shrink-0"
          style={showAdd
            ? { background: `${accentBg}`, color: accentText, border: `1px solid ${accentBorder}` }
            : { background: "var(--bg-input)", color: "#64748b", border: "1px solid var(--border)" }}>
          {showAdd ? "✕ Cancel" : "+ Add"}
        </button>
      </div>

      {/* Category filter */}
      {cats.length > 1 && (
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setCatFilter("")}
            className="px-2 py-0.5 rounded-full text-xs font-medium transition-all"
            style={!catFilter
              ? { background: accentBg, color: accentText, border: `1px solid ${accentBorder}` }
              : { background: "var(--bg-input)", color: "#475569", border: "1px solid var(--border)" }}>
            All
          </button>
          {cats.map(cat => (
            <button key={cat}
              onClick={() => setCatFilter(catFilter === cat ? "" : cat)}
              className="px-2 py-0.5 rounded-full text-xs font-medium transition-all"
              style={catFilter === cat
                ? { background: accentBg, color: accentText, border: `1px solid ${accentBorder}` }
                : { background: "var(--bg-input)", color: "#475569", border: "1px solid var(--border)" }}>
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Items list */}
      {filtered.length === 0 ? (
        <p className="text-xs py-2" style={{ color: "#334155" }}>
          {items.length === 0 ? "No items yet. Click + Add to start." : "No items in this category."}
        </p>
      ) : (
        <div className="space-y-1 overflow-y-auto pr-0.5" style={{ maxHeight: 280 }}>
          {filtered.map(item => (
            <div key={item.name}
              className="flex items-start gap-2 px-2.5 py-2 rounded-lg transition-all"
              style={{
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.04)",
                opacity: item.enabled ? 1 : 0.45,
              }}>
              {/* Left: name + badges + notes */}
              <div className="flex-1 min-w-0">
                <div
                  className="text-sm font-medium text-white leading-tight"
                  style={!item.enabled ? { textDecoration: "line-through", opacity: 0.7 } : undefined}>
                  {item.name}
                </div>
                <div className="flex flex-wrap items-center gap-1 mt-0.5">
                  {item.subcategory && (
                    <span className="text-xs px-1.5 py-0 rounded"
                      style={{ background: "rgba(255,255,255,0.05)", color: "#64748b" }}>
                      {item.subcategory}
                    </span>
                  )}
                  {item.frequency && (
                    <span className="text-xs font-medium" style={{ color: freqColor(item.frequency) }}>
                      {item.frequency}
                    </span>
                  )}
                </div>
                {item.notes && (
                  <div className="text-xs mt-0.5 leading-tight" style={{ color: "#334155" }}>
                    {item.notes}
                  </div>
                )}
              </div>
              {/* Right: toggle + delete */}
              <div className="flex gap-1 items-center shrink-0 mt-0.5">
                <button
                  onClick={() => onToggle(item.name)}
                  title={item.enabled ? "Disable (keeps in list)" : "Enable"}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all"
                  style={item.enabled
                    ? { background: `${accentBg}`, color: accentColor, border: `1px solid ${accentBorder}` }
                    : { background: "rgba(255,255,255,0.04)", color: "#334155", border: "1px solid var(--border)" }}>
                  {item.enabled ? "●" : "○"}
                </button>
                <button
                  onClick={() => onDelete(item.name)}
                  title="Remove from list"
                  className="w-5 h-5 rounded flex items-center justify-center text-xs transition-colors"
                  style={{ color: "#334155" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#334155")}>
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="space-y-2 pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="text-xs font-semibold" style={{ color: accentText }}>Add new item</div>
          <input
            type="text"
            className="nb-input-sm w-full"
            placeholder={addPlaceholder}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && onAdd()}
            autoFocus
          />
          <div className="flex gap-2">
            <input
              type="text"
              className="nb-input-sm flex-1"
              placeholder="Category (e.g. Vegetables)"
              value={newCat}
              onChange={e => setNewCat(e.target.value)}
            />
            <input
              type="text"
              className="nb-input-sm flex-1"
              placeholder="Notes (optional)"
              value={newNotes}
              onChange={e => setNewNotes(e.target.value)}
              onKeyDown={e => e.key === "Enter" && onAdd()}
            />
          </div>
          <button
            onClick={onAdd}
            disabled={!newName.trim()}
            className="px-4 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={newName.trim()
              ? { background: accentBg, color: accentText, border: `1px solid ${accentBorder}` }
              : { background: "transparent", color: "#334155", border: "1px solid var(--border)", opacity: 0.5 }}>
            ✓ Add to list
          </button>
        </div>
      )}

      <div className="text-xs" style={{ color: "#1e3a5f" }}>{subtitle}</div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface PendingItem {
  name: string;
  category: string;
  qty: string;
  unit: string;
  custom: boolean;
}

export default function FoodLog({ dayLog, foodItems, onUpdate, onMealTimeUpdate, onSaveToList: _onSaveToList, onRemoveFromList: _onRemoveFromList, onMoveItem: _onMoveItem, foodPrefs, onUpdatePrefs, onApplyMealPlan }: Props) {
  const [activeMeal, setActiveMeal] = useState<MealType>("breakfast");
  const [pendingItem, setPendingItem] = useState<PendingItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showPlanner, setShowPlanner] = useState(false);
  // ── Preference list UI state ──────────────────────────────────────────────
  const [avoidCatFilter, setAvoidCatFilter]       = useState("");
  const [encourageCatFilter, setEncourageCatFilter] = useState("");
  const [showAvoidAdd, setShowAvoidAdd]           = useState(false);
  const [showEncourageAdd, setShowEncourageAdd]   = useState(false);
  const [newAvoidName, setNewAvoidName]           = useState("");
  const [newAvoidCat, setNewAvoidCat]             = useState("");
  const [newAvoidNotes, setNewAvoidNotes]         = useState("");
  const [newEncName, setNewEncName]               = useState("");
  const [newEncCat, setNewEncCat]                 = useState("");
  const [newEncNotes, setNewEncNotes]             = useState("");

  const meal = activeMeal;
  const entries = dayLog.food[meal] ?? [];

  // ── Search pool: encourage + avoid lists + food_items.json, deduplicated ──
  // Must Avoid items ARE searchable — you log what you actually ate, and
  // Reports flags it. They carry an avoid marker so the dropdown warns you.
  const searchPool: Array<{ name: string; category: string; avoid?: boolean }> = (() => {
    const seen = new Set<string>();
    const pool: Array<{ name: string; category: string; avoid?: boolean }> = [];
    // Primary: Good to Eat list (with full category info)
    for (const item of foodPrefs.encourage) {
      const lc = item.name.toLowerCase();
      if (!seen.has(lc)) { seen.add(lc); pool.push({ name: item.name, category: item.category }); }
    }
    // Must Avoid list — category "Custom" so the entry is auto-categorised
    // into the right plate group on add (avoid categories like "Refined
    // Grains" don't map to balanced-plate buckets)
    for (const item of foodPrefs.avoid) {
      const lc = item.name.toLowerCase();
      if (!seen.has(lc)) { seen.add(lc); pool.push({ name: item.name, category: "Custom", avoid: true }); }
    }
    // Secondary: food_items.json (all meals, all categories)
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

  // ── Preference list helpers ───────────────────────────────────────────────

  function getPrefCategories(list: FoodPreferenceItem[]) {
    return [...new Set(list.map(i => i.category))].sort();
  }

  async function togglePrefItem(list: "avoid" | "encourage", name: string) {
    await onUpdatePrefs({
      ...foodPrefs,
      [list]: foodPrefs[list].map((i: FoodPreferenceItem) =>
        i.name === name ? { ...i, enabled: !i.enabled } : i
      ),
    });
  }

  async function deletePrefItem(list: "avoid" | "encourage", name: string) {
    await onUpdatePrefs({
      ...foodPrefs,
      [list]: foodPrefs[list].filter((i: FoodPreferenceItem) => i.name !== name),
    });
  }

  async function addAvoid() {
    const name = newAvoidName.trim();
    if (!name) return;
    if (foodPrefs.avoid.some(a => a.name.toLowerCase() === name.toLowerCase())) {
      setNewAvoidName(""); return;
    }
    const item: FoodPreferenceItem = {
      name,
      category: newAvoidCat.trim() || "Custom",
      subcategory: "",
      frequency: "Avoid",
      notes: newAvoidNotes.trim(),
      enabled: true,
    };
    await onUpdatePrefs({ ...foodPrefs, avoid: [...foodPrefs.avoid, item] });
    setNewAvoidName(""); setNewAvoidCat(""); setNewAvoidNotes("");
    setShowAvoidAdd(false);
  }

  async function addEncourage() {
    const name = newEncName.trim();
    if (!name) return;
    if (foodPrefs.encourage.some(a => a.name.toLowerCase() === name.toLowerCase())) {
      setNewEncName(""); return;
    }
    const item: FoodPreferenceItem = {
      name,
      category: newEncCat.trim() || "Custom",
      subcategory: "",
      frequency: "Regular",
      notes: newEncNotes.trim(),
      enabled: true,
    };
    await onUpdatePrefs({ ...foodPrefs, encourage: [...foodPrefs.encourage, item] });
    setNewEncName(""); setNewEncCat(""); setNewEncNotes("");
    setShowEncourageAdd(false);
  }

  // Update quantity or unit of already-logged entry
  function updateEntry(id: string, patch: Partial<Pick<FoodEntry, "quantity_g" | "unit">>) {
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
                {entry.custom && (
                  <span className="ml-1.5 text-xs px-1 py-0.5 rounded"
                    style={{ background: "#1e293b", color: "#334155" }}>+added</span>
                )}
              </div>
              {/* Inline quantity + unit edit */}
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
                  Not in your lists — add it to <strong className="text-white">Good to Eat</strong> first
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
                        {s.avoid ? (
                          <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                            style={{ background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" }}>
                            ⚠ Must Avoid
                          </span>
                        ) : s.category && (
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
          {searchPool.length} items across your Good to Eat, Must Avoid &amp; pre-defined lists — select one to set quantity
        </div>
      </div>

      {/* ── Must Avoid ────────────────────────────────────────────────────── */}
      <PrefListCard
        title="Must Avoid"
        icon="🚫"
        subtitle="Never eat — flagged in Reports"
        accentColor="#ef4444"
        accentBg="rgba(239,68,68,0.1)"
        accentBorder="rgba(239,68,68,0.2)"
        accentText="#f87171"
        items={foodPrefs.avoid}
        catFilter={avoidCatFilter}
        setCatFilter={setAvoidCatFilter}
        getCategories={getPrefCategories}
        onToggle={name => togglePrefItem("avoid", name)}
        onDelete={name => deletePrefItem("avoid", name)}
        showAdd={showAvoidAdd}
        setShowAdd={setShowAvoidAdd}
        newName={newAvoidName} setNewName={setNewAvoidName}
        newCat={newAvoidCat}   setNewCat={setNewAvoidCat}
        newNotes={newAvoidNotes} setNewNotes={setNewAvoidNotes}
        onAdd={addAvoid}
        addPlaceholder='e.g. "Carbonated drinks"'
      />

      {/* ── Good to Eat ───────────────────────────────────────────────────── */}
      <PrefListCard
        title="Good to Eat"
        icon="✅"
        subtitle="Always welcome — include regularly"
        accentColor="#22c55e"
        accentBg="rgba(34,197,94,0.1)"
        accentBorder="rgba(34,197,94,0.2)"
        accentText="#86efac"
        items={foodPrefs.encourage}
        catFilter={encourageCatFilter}
        setCatFilter={setEncourageCatFilter}
        getCategories={getPrefCategories}
        onToggle={name => togglePrefItem("encourage", name)}
        onDelete={name => deletePrefItem("encourage", name)}
        showAdd={showEncourageAdd}
        setShowAdd={setShowEncourageAdd}
        newName={newEncName} setNewName={setNewEncName}
        newCat={newEncCat}   setNewCat={setNewEncCat}
        newNotes={newEncNotes} setNewNotes={setNewEncNotes}
        onAdd={addEncourage}
        addPlaceholder='e.g. "Broccoli"'
      />

    </div>
  );
}
