"use client";
import { useState } from "react";
import type { DayLog, FoodEntry, FoodItemsData, MealType } from "@/types";

interface Props {
  dayLog: DayLog;
  foodItems: FoodItemsData;
  onUpdate: (food: Record<MealType, FoodEntry[]>) => void;
  /** Called when a custom item should be saved to food_items.json */
  onSaveToList: (meal: string, category: string, name: string) => Promise<void>;
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

// ─── Auto-category (balanced plate terminology) ───────────────────────────────

/**
 * Guesses the best food category from the name.
 * Priority order prevents mis-classification (e.g. "lassi" → Beverages, not One-Pot Dish).
 */
function autoCategory(name: string): string {
  const lc = name.toLowerCase();

  // Beverages & Drinks — must come first so "lassi", "coffee" etc. win over one-pot
  if (/\b(coffee|tea|juice|shake|smoothie|lassi|sherbet|kombucha|kefir|buttermilk|neer\s*more|coconut water)\b/.test(lc)) {
    return "Beverages & Drinks";
  }

  // One-Pot Dish — complex multi-ingredient preparations (3+ commas OR long + cooked)
  const commas = (lc.match(/,/g) || []).length;
  const hasPrep = /\b(cooked|mixed|prepared|along with|tossed|stir.fried|sautéed|sauteed|roasted)\b/.test(lc);
  if ((commas >= 2 && hasPrep) || commas >= 4 || (name.length > 55 && commas >= 1 && hasPrep)) {
    return "One-Pot Dish";
  }

  // Protein
  if (/\b(egg|chicken|fish|salmon|tuna|sardine|turkey|lamb|mutton|beef|prawn|shrimp|tofu|tempeh|whey|cottage cheese)\b/.test(lc)) {
    return "Protein";
  }

  // Nuts & Seeds (including groundnuts, melon seeds)
  if (/\b(almond|walnut|cashew|pistachio|peanut|groundnut|pecan|hazelnut|macadamia|flaxseed|flax seed|chia seed|pumpkin seed|sunflower seed|sesame|hemp seed|muskmelon seed|watermelon seed|melon seed)\b/.test(lc)) {
    return "Nuts & Seeds";
  }

  // Fruits
  if (/\b(apple|banana|orange|mango|guava|blueberr|strawberr|raspberry|grape|watermelon|papaya|kiwi|pear|peach|plum|avocado|cherry|lemon|lime|pomegranate|fig|apricot)\b/.test(lc)) {
    return "Fruits";
  }

  // Vegetables
  if (/\b(broccoli|spinach|carrot|cucumber|drumstick|tomato|onion|garlic|capsicum|bell pepper|lettuce|cabbage|cauliflower|kale|zucchini|radish|beetroot|sweet potato|potato|yam|okra|brinjal|eggplant|bitter gourd|bottle gourd|ridge gourd|cluster bean|french bean)\b/.test(lc)) {
    return "Vegetables";
  }

  // Dairy
  if (/\b(milk|curd|yogurt|yoghurt|cheese|butter|ghee|cream|paneer)\b/.test(lc)) {
    return "Dairy";
  }

  // Grains & Carbs
  if (/\b(rice|wheat|oat|bread|roti|chapati|noodle|pasta|quinoa|millet|barley|cereal|poha|upma|idli|dosa|porridge|corn|maize|bajra|jowar|ragi)\b/.test(lc)) {
    return "Grains & Carbs";
  }

  // Legumes & Beans
  if (/\b(dal|lentil|chickpea|moong|chana|rajma|soybean|kidney bean|black bean|toor|urad|masoor|moth bean|horse gram|chawli)\b/.test(lc)) {
    return "Legumes & Beans";
  }

  // Spices & Condiments
  if (/\b(masala|turmeric|cumin|coriander seed|garam masala|chili|chilli|curry paste|ketchup|mayo|mustard|vinegar|soy sauce)\b/.test(lc)) {
    return "Spices & Condiments";
  }

  return "Custom";
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

export default function FoodLog({ dayLog, foodItems, onUpdate, onSaveToList }: Props) {
  const [activeMeal, setActiveMeal] = useState<MealType>("breakfast");
  const [pendingItem, setPendingItem] = useState<PendingItem | null>(null);
  const [customText, setCustomText] = useState("");
  const [customQty, setCustomQty] = useState("");
  const [customUnit, setCustomUnit] = useState<string>("g");
  const [savePrompt, setSavePrompt] = useState<SavePrompt | null>(null);

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
          return (
            <button key={m} onClick={() => { setActiveMeal(m); setPendingItem(null); setSavePrompt(null); }}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={activeMeal === m
                ? { background: "rgba(255,255,255,0.07)", color: meta.color, boxShadow: `0 0 0 1px ${meta.color}30` }
                : { color: "#475569" }}>
              <span>{meta.icon}</span>
              <span className="hidden sm:inline">{meta.label}</span>
              {count > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                  style={{ background: `${meta.color}22`, color: meta.color }}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Meal label */}
      <div className="flex items-center gap-2">
        <span className="text-lg">{MEAL_META[meal].icon}</span>
        <span className="text-sm font-semibold text-white">{MEAL_META[meal].label}</span>
        <span className="text-xs px-2 py-0.5 rounded-full"
          style={{ background: "var(--bg-card)", color: "#475569" }}>{MEAL_META[meal].time}</span>
      </div>

      {/* Pre-populated chips */}
      <div className="card p-4 space-y-4">
        <div className="section-header">Pre-defined items — tap to add</div>
        {Object.keys(categories).length === 0 ? (
          <p className="text-xs" style={{ color: "#475569" }}>No pre-defined items for this meal. Add via the custom input below.</p>
        ) : (
          Object.entries(categories).map(([cat, items], ci) => {
            const cc = catColor(ci);
            return (
              <div key={cat}>
                <div className="text-xs font-semibold mb-2" style={{ color: cc.text }}>{cat}</div>
                <div className="flex flex-wrap gap-2">
                  {items.map(item => {
                    const selected = isSelected(item);
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
          })
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
          {entries.map(entry => (
            <div key={entry.id}
              className="flex items-center gap-3 p-2.5 rounded-lg"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-white">{entry.name}</span>
                {entry.custom && (
                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded"
                    style={{ background: "#1e2d45", color: "#64748b" }}>custom</span>
                )}
                {!entry.custom && (
                  <span className="ml-2 text-xs" style={{ color: "#475569" }}>{entry.category}</span>
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
          ))}
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
                It will appear as a chip in future sessions. To remove it, edit <code className="text-teal-400">data/food_items.json</code>.
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
