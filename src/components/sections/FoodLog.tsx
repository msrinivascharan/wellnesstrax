"use client";
import { useState } from "react";
import type { DayLog, FoodEntry, FoodItemsData, MealType } from "@/types";
import { autoCategory, resolveCategory } from "@/lib/food-utils";

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

const CAT_COLORS = [
  { border: "#1d4ed8", bg: "rgba(29,78,216,0.1)",  text: "#93c5fd" },
  { border: "#15803d", bg: "rgba(21,128,61,0.1)",   text: "#86efac" },
  { border: "#9333ea", bg: "rgba(147,51,234,0.1)",  text: "#d8b4fe" },
  { border: "#b45309", bg: "rgba(180,83,9,0.1)",    text: "#fcd34d" },
  { border: "#0e7490", bg: "rgba(14,116,144,0.1)",  text: "#67e8f9" },
];
function catColor(idx: number) { return CAT_COLORS[idx % CAT_COLORS.length]; }
function genId() { return crypto.randomUUID(); }

// ─── Component ────────────────────────────────────────────────────────────────

interface PendingItem {
  name: string;
  category: string;
  qty: string;
  unit: string;
  custom: boolean;
}

interface SavePrompt {
  name: string;
  /** which meal the item was added to */
  meal: MealType;
  /** category selected for saving */
  category: string;
  saving: boolean;
}

export default function FoodLog({ dayLog, foodItems, onUpdate, onMealTimeUpdate, onSaveToList, onRemoveFromList, onMoveItem }: Props) {
  const [activeMeal, setActiveMeal] = useState<MealType>("breakfast");
  const [pendingItem, setPendingItem] = useState<PendingItem | null>(null);
  const [customText, setCustomText] = useState("");
  const [customQty, setCustomQty] = useState("");
  const [customUnit, setCustomUnit] = useState<string>("g");
  const [savePrompt, setSavePrompt] = useState<SavePrompt | null>(null);
  const [editingList, setEditingList] = useState(false);
  const [recatItem, setRecatItem] = useState<{ cat: string; name: string } | null>(null);
  const [newCatName, setNewCatName] = useState("");

  const meal = activeMeal;
  const entries = dayLog.food[meal] ?? [];
  const categories = foodItems.meals[meal] ?? {};
  const allCategories = Object.keys(categories);

  // ── Helpers ──────────────────────────────────────────────────────────────

  function isSelected(name: string) {
    return entries.some(e => e.name.toLowerCase() === name.toLowerCase());
  }

  // Open quantity+unit dialog for a pre-defined chip
  function handleChipClick(name: string, category: string) {
    if (isSelected(name)) {
      // Remove existing entry
      onUpdate({ ...dayLog.food, [meal]: entries.filter(e => e.name.toLowerCase() !== name.toLowerCase()) });
      return;
    }
    setPendingItem({ name, category, qty: "", unit: guessUnit(name), custom: false });
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

  // Add a custom food item
  function addCustom() {
    const name = customText.trim();
    const qty = parseFloat(customQty);
    if (!name || isNaN(qty) || qty <= 0) return;

    const detectedCat = autoCategory(name);

    const entry: FoodEntry = {
      id: genId(),
      name,
      category: detectedCat,
      quantity_g: qty,
      unit: customUnit,
      custom: true,
      logged_at: new Date().toISOString(),
    };
    onUpdate({ ...dayLog.food, [meal]: [...entries, entry] });

    // Offer to save to the pre-defined list — pre-select the auto-detected category
    setSavePrompt({
      name,
      meal,
      category: detectedCat,
      saving: false,
    });

    setCustomText("");
    setCustomQty("");
    setCustomUnit("g");
  }

  async function confirmSaveToList() {
    if (!savePrompt) return;
    setSavePrompt({ ...savePrompt, saving: true });
    await onSaveToList(savePrompt.meal, savePrompt.category, savePrompt.name);
    setSavePrompt(null);
  }

  async function handleRecat(newCat: string) {
    if (!recatItem || !newCat.trim()) return;
    await onMoveItem(meal, recatItem.cat, newCat.trim(), recatItem.name);
    setRecatItem(null);
    setNewCatName("");
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
          {totalItems} item{totalItems !== 1 ? "s" : ""} logged today · Custom items can be saved to your list permanently
        </p>
      </div>

      {/* Meal tabs */}
      <div className="flex gap-1.5 p-1 rounded-xl" style={{ background: "var(--bg-card)" }}>
        {MEALS.map(m => {
          const meta = MEAL_META[m];
          const count = dayLog.food[m]?.length ?? 0;
          const mealTime = dayLog.meal_times?.[m];
          return (
            <button key={m} onClick={() => { setActiveMeal(m); setPendingItem(null); setSavePrompt(null); setEditingList(false); setRecatItem(null); setNewCatName(""); }}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-lg text-sm font-medium transition-all"
              style={activeMeal === m
                ? { background: "rgba(255,255,255,0.07)", color: meta.color, boxShadow: `0 0 0 1px ${meta.color}30` }
                : { color: "#475569" }}>
              <div className="flex items-center gap-1.5">
                <span>{meta.icon}</span>
                <span className="hidden sm:inline">{meta.label}</span>
                {count > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                    style={{ background: `${meta.color}22`, color: meta.color }}>{count}</span>
                )}
              </div>
              {mealTime && (
                <span className="text-xs font-normal tabular-nums" style={{ color: activeMeal === m ? meta.color : "#334155", opacity: 0.85 }}>
                  🕐 {mealTime}
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

      {/* Pre-populated chips */}
      <div className="card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="section-header">{editingList ? "Edit list — tap ✕ to remove" : "Pre-defined items — tap to add"}</div>
          {Object.keys(categories).length > 0 && (
            <button
              onClick={() => setEditingList(e => !e)}
              className="text-xs px-2.5 py-1 rounded-lg transition-all"
              style={editingList
                ? { background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" }
                : { background: "var(--bg-input)", color: "#64748b", border: "1px solid var(--border)" }}>
              {editingList ? "✓ Done" : "✏ Edit list"}
            </button>
          )}
        </div>
        {Object.keys(categories).length === 0 ? (
          <p className="text-xs" style={{ color: "#475569" }}>No pre-defined items for this meal. Add via the custom input below.</p>
        ) : (
          <>
            {Object.entries(categories).map(([cat, items], ci) => {
              const cc = catColor(ci);
              return (
                <div key={cat}>
                  <div className="text-xs font-semibold mb-2" style={{ color: cc.text }}>{cat}</div>
                  <div className="flex flex-wrap gap-2">
                    {items.map(item => {
                      const selected = isSelected(item);
                      if (editingList) {
                        const isRecat = recatItem?.name === item && recatItem?.cat === cat;
                        return (
                          <div key={item} className="flex items-center gap-1">
                            <span
                              className="food-chip cursor-default select-none"
                              style={selected ? { borderColor: cc.border, background: cc.bg, color: cc.text } : undefined}>
                              {selected && <span>✓</span>}
                              {item}
                            </span>
                            {!selected && (
                              <>
                                {/* Recategorize toggle */}
                                <button
                                  onClick={() => { setRecatItem(isRecat ? null : { cat, name: item }); setNewCatName(""); }}
                                  className="h-5 px-1.5 rounded text-xs font-bold transition-all shrink-0"
                                  style={isRecat
                                    ? { background: "rgba(20,184,166,0.2)", color: "#14b8a6", border: "1px solid rgba(20,184,166,0.4)" }
                                    : { background: "rgba(255,255,255,0.04)", color: "#64748b", border: "1px solid var(--border)" }}
                                  title={`Change category for "${item}"`}>
                                  ↷
                                </button>
                                {/* Remove */}
                                <button
                                  onClick={() => { onRemoveFromList(meal, cat, item); if (isRecat) setRecatItem(null); }}
                                  className="w-5 h-5 rounded-full flex items-center justify-center text-xs transition-all shrink-0"
                                  style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}
                                  title={`Remove "${item}" from list`}>
                                  ✕
                                </button>
                              </>
                            )}
                          </div>
                        );
                      }
                      return (
                        <button key={item} onClick={() => handleChipClick(item, cat)}
                          className="food-chip"
                          style={selected ? { borderColor: cc.border, background: cc.bg, color: cc.text } : undefined}>
                          {selected && <span>✓</span>}
                          {item}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* ── Inline recat picker ── */}
            {recatItem && editingList && (
              <div className="mt-1 p-3 rounded-xl space-y-2.5 fade-in-up"
                style={{ background: "rgba(20,184,166,0.05)", border: "1px solid rgba(20,184,166,0.2)" }}>
                <div className="text-xs font-semibold text-white">
                  Move <span style={{ color: "#14b8a6" }}>&ldquo;{recatItem.name}&rdquo;</span> to category:
                </div>
                {/* Existing categories (exclude current) */}
                {Object.keys(categories).filter(c => c !== recatItem.cat).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.keys(categories)
                      .filter(c => c !== recatItem.cat)
                      .map(c => (
                        <button key={c} onClick={() => handleRecat(c)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                          style={{ background: "var(--bg-input)", color: "#94a3b8", border: "1px solid var(--border)" }}>
                          {c}
                        </button>
                      ))}
                  </div>
                )}
                {/* New category input */}
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    className="nb-input-sm"
                    style={{ maxWidth: 190 }}
                    placeholder="New category name…"
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleRecat(newCatName)}
                    autoFocus
                  />
                  <button
                    onClick={() => handleRecat(newCatName)}
                    disabled={!newCatName.trim()}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={newCatName.trim()
                      ? { background: "rgba(20,184,166,0.15)", color: "#14b8a6", border: "1px solid rgba(20,184,166,0.3)" }
                      : { background: "transparent", color: "#334155", border: "1px solid var(--border)", opacity: 0.5 }}>
                    Move ✓
                  </button>
                  <button
                    onClick={() => { setRecatItem(null); setNewCatName(""); }}
                    className="text-xs px-2 py-1.5 transition-colors"
                    style={{ color: "#475569" }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Pending quantity + unit input (for pre-defined chips) */}
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

      {/* Custom food input */}
      <div className="card p-4 space-y-3">
        <div className="section-header">Add custom item</div>
        <input
          className="nb-input"
          placeholder='Food name — e.g. "Boiled egg whites" or "Milk coffee without sugar"'
          value={customText}
          onChange={e => {
            setCustomText(e.target.value);
            setCustomUnit(guessUnit(e.target.value));
          }}
          onKeyDown={e => e.key === "Enter" && addCustom()}
        />

        {/* Unit picker */}
        <div>
          <div className="section-header mb-1.5">Unit</div>
          <UnitPicker value={customUnit} onChange={setCustomUnit} />
        </div>

        {/* Quantity + Add button */}
        <div className="flex gap-2 items-center">
          <input
            className="nb-input"
            style={{ maxWidth: 120 }}
            type="number"
            min="0.1"
            step="0.1"
            placeholder={customUnit === "ml" ? "e.g. 200" : customUnit === "pieces" ? "e.g. 3" : "e.g. 100"}
            value={customQty}
            onChange={e => setCustomQty(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addCustom()}
          />
          <span className="text-sm font-medium" style={{ color: "#64748b" }}>{customUnit}</span>
          <button onClick={addCustom}
            className="px-4 py-2 rounded-lg text-sm font-medium shrink-0 transition-colors"
            style={{ background: "rgba(20,184,166,0.15)", color: "#14b8a6", border: "1px solid rgba(20,184,166,0.3)" }}>
            + Add
          </button>
        </div>
      </div>

      {/* Save-to-list prompt */}
      {savePrompt && (
        <div className="card p-4 space-y-3 fade-in-up"
          style={{ borderColor: "rgba(250,204,21,0.3)", border: "1px solid rgba(250,204,21,0.3)", background: "rgba(250,204,21,0.04)" }}>
          <div className="flex items-start gap-2">
            <span>💾</span>
            <div>
              <div className="text-sm font-semibold text-white">
                Save &ldquo;{savePrompt.name}&rdquo; to your food list?
              </div>
              <div className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>
                It will appear as a chip in future sessions. You can remove it later using the ✏ Edit list button.
              </div>
            </div>
          </div>

          {/* Category picker — includes auto-detected cat even if new */}
          <div>
            <div className="section-header mb-2">
              Category to save under
              {!allCategories.includes(savePrompt.category) && savePrompt.category !== "Custom" && (
                <span className="ml-2 text-xs font-normal" style={{ color: "#14b8a6" }}>
                  (auto-detected: {savePrompt.category})
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {[...new Set([...allCategories, savePrompt.category, "Custom"])].map(cat => (
                <button key={cat} onClick={() => setSavePrompt({ ...savePrompt, category: cat })}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={savePrompt.category === cat
                    ? { background: "rgba(250,204,21,0.15)", color: "#fde047", border: "1px solid rgba(250,204,21,0.35)" }
                    : { background: "var(--bg-input)", color: "#64748b", border: "1px solid var(--border)" }}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={confirmSaveToList}
              disabled={savePrompt.saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ background: "rgba(250,204,21,0.15)", color: "#fde047", border: "1px solid rgba(250,204,21,0.3)" }}>
              {savePrompt.saving ? (
                <><span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /> Saving…</>
              ) : "✓ Save to list"}
            </button>
            <button onClick={() => setSavePrompt(null)}
              className="px-3 py-2 rounded-lg text-sm transition-colors"
              style={{ color: "#475569" }}>
              Not now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
