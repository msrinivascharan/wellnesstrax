/**
 * Shared food helpers — used by FoodLog (entry creation) and Reports (plate balance chart).
 */
import type { FoodEntry } from "@/types";

/**
 * Guesses the best balanced-plate category for a food name.
 *
 * Key design decisions:
 * - Trailing \b is KEPT for Beverages and Dairy only, to prevent false positives
 *   like "teaspoon" → Beverages or "butternut" → Dairy.
 * - All other categories drop the trailing \b so plurals work:
 *   "walnuts" matches \bwalnut, "drumsticks" matches \bdrumstick, etc.
 * - "eggplant" is checked explicitly before Protein so \begg doesn't mis-fire.
 */
export function autoCategory(name: string): string {
  const lc = name.toLowerCase();

  // ── Beverages & Drinks ── (keep \b at end: "tea" must not match "teaspoon")
  if (/\b(coffee|tea|juice|shake|smoothie|lassi|sherbet|kombucha|kefir|buttermilk|coconut water|neer more)\b/.test(lc)) {
    return "Beverages & Drinks";
  }

  // ── One-Pot Dish ─────────────────────────────────────────────────────────────
  const commas = (lc.match(/,/g) || []).length;
  const hasPrep = /\b(cooked|mixed|prepared|along with|tossed|stir.fried|sautéed|sauteed|roasted)\b/.test(lc);
  if ((commas >= 2 && hasPrep) || commas >= 4 || (name.length > 55 && commas >= 1 && hasPrep)) {
    return "One-Pot Dish";
  }

  // ── eggplant guard — must come before Protein so \begg doesn't misfire ───────
  if (/\beggplant/.test(lc) || /\bbrinjal/.test(lc)) return "Vegetables";

  // ── Protein (no trailing \b → handles "eggs", "chickens", "fish fillets") ────
  if (/\b(egg|chicken|fish|salmon|tuna|sardine|turkey|lamb|mutton|beef|prawn|shrimp|tofu|tempeh|whey|cottage cheese)/.test(lc)) {
    return "Protein";
  }

  // ── Nuts & Seeds (no trailing \b → handles "walnuts", "almonds", "pumpkin seeds") ──
  if (/\b(almond|walnut|cashew|pistachio|peanut|groundnut|pecan|hazelnut|macadamia|flaxseed|flax seed|chia seed|pumpkin seed|sunflower seed|sesame|hemp seed|muskmelon seed|watermelon seed|melon seed)/.test(lc)) {
    return "Nuts & Seeds";
  }

  // ── Fruits (no trailing \b → handles "blueberries", "grapes", "cherries") ────
  if (/\b(apple|banana|orange|mango|guava|blueberr|strawberr|raspberr|grape|watermelon|papaya|kiwi|pear|peach|plum|avocado|cherr|lemon|lime|pomegranate|fig|apricot)/.test(lc)) {
    return "Fruits";
  }

  // ── Fats & Oils — checked BEFORE Vegetables so "vegetable oil" routes here ───
  if (/\b(olive oil|coconut oil|mustard oil|sunflower oil|rice bran oil|avocado oil|canola oil|groundnut oil|sesame oil|vegetable oil|flaxseed oil|ghee)\b/.test(lc)) {
    return "Fats & Oils";
  }

  // ── Vegetables — added "vegetable|sabzi" for "cooked mixed vegetables" etc. ──
  if (/\b(vegetable|mixed vegetable|sabzi|broccoli|spinach|carrot|cucumber|drumstick|tomato|onion|garlic|capsicum|bell pepper|lettuce|cabbage|cauliflower|kale|zucchini|radish|beetroot|sweet potato|potato|yam|okra|bitter gourd|bottle gourd|ridge gourd|cluster bean|french bean)/.test(lc)) {
    return "Vegetables";
  }

  // ── Dairy ── (keep \b at end: "butter" must not match "butternut", "cream" not "creamy") ──
  if (/\b(milk|curd|yogurt|yoghurt|cheese|butter|ghee|cream|paneer)\b/.test(lc)) {
    return "Dairy";
  }

  // ── Grains & Carbs (no trailing \b → handles "oats", "noodles") ──────────────
  if (/\b(rice|wheat|oat|bread|roti|chapati|noodle|pasta|quinoa|millet|barley|cereal|poha|upma|idli|dosa|porridge|corn|maize|bajra|jowar|ragi)/.test(lc)) {
    return "Grains & Carbs";
  }

  // ── Legumes & Beans (no trailing \b → handles "chickpeas", "lentils", "red beans") ──
  if (/\b(dal|lentil|chickpea|moong|chana|rajma|soybean|kidney bean|black bean|red bean|green pea|toor|urad|masoor|moth bean|horse gram|chawli)/.test(lc)) {
    return "Legumes & Beans";
  }

  // ── Spices & Condiments (no trailing \b) ─────────────────────────────────────
  if (/\b(masala|turmeric|cumin|coriander|garam|chili|chilli|curry paste|ketchup|mayo|mustard|vinegar|soy sauce)/.test(lc)) {
    return "Spices & Condiments";
  }

  // ── Dietary Fiber ─────────────────────────────────────────────────────────────
  if (/\b(psyllium|isabgol|husk|flaxseed|inulin|pectin|bran)/.test(lc)) {
    return "Dietary Fiber";
  }

  return "Other";
}

/**
 * Returns the display category for a food entry, always preferring the
 * auto-detected result over whatever was stored — this retroactively fixes
 * stale categories in old session files (e.g. "Vegetables" for a one-pot dish,
 * or "custom" from before the categorisation fix).
 *
 * Only falls back to the stored value when autoCategory cannot classify the
 * item (returns "Other") and the stored value is a meaningful, non-"custom" string.
 */
export function resolveCategory(entry: Pick<FoodEntry, "name" | "category">): string {
  const detected = autoCategory(entry.name);
  if (detected !== "Other") return detected;                  // auto wins
  const raw = entry.category ?? "";
  if (raw && raw.toLowerCase() !== "custom") return raw;      // meaningful stored value
  return "Other";
}

/**
 * Maps a fine-grained autoCategory result to one of the 5 balanced plate terms
 * (or supplementary labels for beverages, one-pot dishes, and uncategorised items).
 */
export function mapToBalancedPlate(cat: string): string {
  switch (cat) {
    case "Grains & Carbs":      return "Complex Carbohydrates";
    case "Protein":
    case "Legumes & Beans":
    case "Dairy":               return "Lean / Plant Proteins";
    case "Dietary Fiber":       return "Dietary Fiber";
    case "Vegetables":
    case "Fruits":
    case "Spices & Condiments": return "Micronutrients";
    case "Nuts & Seeds":
    case "Fats & Oils":         return "Essential Lipids";
    case "Beverages & Drinks":  return "Beverages & Drinks";
    case "One-Pot Dish":        return "One-Pot (Mixed)";
    default:                    return "Other";
  }
}

