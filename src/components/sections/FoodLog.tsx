"use client";
import { useState } from "react";
import type { DayLog, FoodEntry, FoodItemsData, FoodPreferences, FoodPreferenceItem, MealType } from "@/types";
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
  /** Current avoid / encourage preference lists */
  foodPrefs: FoodPreferences;
  /** Called when either preference list changes */
  onUpdatePrefs: (prefs: FoodPreferences) => Promise<void>;
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

interface SavePrompt {
  name: string;
  /** which meal the item was added to */
  meal: MealType;
  /** category selected for saving */
  category: string;
  saving: boolean;
}

export default function FoodLog({ dayLog, foodItems, onUpdate, onMealTimeUpdate, onSaveToList, onRemoveFromList, onMoveItem, foodPrefs, onUpdatePrefs }: Props) {
  const [activeMeal, setActiveMeal] = useState<MealType>("breakfast");
  const [pendingItem, setPendingItem] = useState<PendingItem | null>(null);
  const [customText, setCustomText] = useState("");
  const [customQty, setCustomQty] = useState("");
  const [customUnit, setCustomUnit] = useState<string>("g");
  const [savePrompt, setSavePrompt] = useState<SavePrompt | null>(null);
  const [editingList, setEditingList] = useState(false);
  const [recatItem, setRecatItem] = useState<{ cat: string; name: string } | null>(null);
  const [newCatName, setNewCatName] = useState("");
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
                            {/* Recategorize — available for ALL items, even ones logged today */}
                            <button
                              onClick={() => { setRecatItem(isRecat ? null : { cat, name: item }); setNewCatName(""); }}
                              className="h-5 px-1.5 rounded text-xs font-bold transition-all shrink-0"
                              style={isRecat
                                ? { background: "rgba(20,184,166,0.2)", color: "#14b8a6", border: "1px solid rgba(20,184,166,0.4)" }
                                : { background: "rgba(255,255,255,0.04)", color: "#64748b", border: "1px solid var(--border)" }}
                              title={`Change category for "${item}"`}>
                              ↷
                            </button>
                            {/* Remove — locked for items already in today's log */}
                            {!selected && (
                              <button
                                onClick={() => { onRemoveFromList(meal, cat, item); if (isRecat) setRecatItem(null); }}
                                className="w-5 h-5 rounded-full flex items-center justify-center text-xs transition-all shrink-0"
                                style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}
                                title={`Remove "${item}" from list`}>
                                ✕
                              </button>
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
