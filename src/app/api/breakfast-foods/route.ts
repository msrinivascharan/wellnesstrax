import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import type { BreakfastFood, BreakfastFoodsData } from "@/types";

const FILE = path.join(process.cwd(), "data", "breakfast_foods.json");

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

// Per-100g database seeded from the user's Breakfast_Planner.xlsx "Foods" tab.
const F = (category: string, item: string, kcal: number, protein: number, carbs: number, fiber: number, cooking_method: string, typical_unit: string, notes = ""): BreakfastFood =>
  ({ id: item.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), category, item, kcal_100g: kcal, protein_100g: protein, carbs_100g: carbs, fiber_100g: fiber, cooking_method, typical_unit, notes });

const DEFAULTS: BreakfastFoodsData = {
  target: { kcal: 500, protein: 35, carbs: 50, fiber: 12 },
  notes: [
    "How to use the planner",
    "1. In 'Tomorrow's plate', each row is one slot. Pick an Item from its dropdown and type the RAW/DRY quantity in grams.",
    "2. Calories, protein, carbs and fibre fill in automatically; TOTAL PLATE sums the breakfast.",
    "3. Leave a slot's item blank to skip it (counts as 0).",
    "",
    "Conventions",
    "- All numbers in 'Foods' are per 100 g of the RAW / DRY ingredient — enter raw weights.",
    "- Quick conversions: 1 egg ~ 50 g | 1 tsp oil ~ 5 g | 10 almonds ~ 12 g | 1 tbsp seeds ~ 10-12 g.",
    "",
    "Targets (a guide, not a rule)",
    "- Aim roughly 500 kcal and ~35 g protein. The Difference row shows how far the plate is from target.",
    "- If over on calories, trim the nuts, the oil, or the base grams first.",
    "",
    "Health notes",
    "- Fruit is whole and ripe only — no juice, no smoothie. Guava, apple, pear, berries are the lowest-GI picks.",
    "- Nuts & seeds are calorie-dense: 10-20 g is plenty.",
    "",
    "Note: this is a planning tool, not medical advice. Keep medication and clinical decisions with your doctor.",
  ].join("\n"),
  foods: [
    F("Base", "Moong / Green gram (pesarattu) - dry", 347, 24, 59, 16, "Soak 4h, grind to batter, cook as dosa on tawa", "1 dosa ~ 30g dry", "Low-GI, high protein + fibre"),
    F("Base", "Besan / Gram flour (chilla) - dry", 387, 22, 58, 11, "Batter with water + veg, cook as chilla", "1 chilla ~ 30g", "Good protein, low-GI"),
    F("Base", "Rolled oats - dry", 389, 13, 66, 10, "Cook with water/milk, savoury or plain", "1 bowl ~ 40g", "Use rolled/steel-cut, not instant"),
    F("Protein", "Egg, whole (raw)", 143, 13, 1, 0, "Boiled / bhurji / poached, low oil", "1 egg ~ 50g"),
    F("Protein", "Egg white (raw)", 52, 11, 0.7, 0, "Boiled / scrambled", "1 white ~ 33g", "Extra protein, very low cal"),
    F("Protein", "Paneer", 296, 18, 6, 0, "Grilled / scrambled, low oil", "100g block", "Pick low-fat paneer (~206 kcal) to cut calories"),
    F("Dairy", "Curd (toned)", 60, 3.4, 4.7, 0, "Plain, chilled", "1 katori ~ 150g", "Use toned / low-fat"),
    F("Dairy", "Greek yogurt (plain)", 60, 10, 3.6, 0, "Plain, chilled", "1 cup ~ 200g", "High protein per calorie"),
    F("Veg", "Onion", 40, 1.1, 9, 1.7, "Saute / raw", "-"),
    F("Veg", "Tomato", 18, 0.9, 3.9, 1.2, "Saute / raw", "-"),
    F("Veg", "Spinach (palak)", 23, 2.9, 3.6, 2.2, "Chop into bhurji / chilla", "-"),
    F("Veg", "Capsicum", 31, 1, 6, 2.1, "Saute", "-"),
    F("Veg", "Mixed veg (onion-tomato-palak)", 30, 1.5, 6, 2, "Saute for bhurji / chilla", "-", "Adds volume + fibre for few calories"),
    F("Fruit", "Guava", 68, 2.6, 14, 5.4, "Fresh, ripe - eat as-is", "1 medium ~ 100g", "Best fibre, low-GI - top pick"),
    F("Fruit", "Apple", 52, 0.3, 14, 2.4, "Fresh, with skin - as-is", "1 medium ~ 180g", "Low-GI"),
    F("Fruit", "Papaya", 43, 0.5, 11, 1.7, "Ripe - as-is", "1 cup ~ 140g"),
    F("Fruit", "Pear", 57, 0.4, 15, 3.1, "Fresh, with skin - as-is", "1 medium ~ 180g", "Low-GI"),
    F("Fruit", "Orange / Mosambi", 47, 0.9, 12, 2.4, "Fresh segments - as-is", "1 medium ~ 130g"),
    F("Fruit", "Pomegranate", 83, 1.7, 19, 4, "Fresh arils - as-is", "1/2 cup ~ 90g"),
    F("Fruit", "Berries (mixed)", 50, 1, 12, 4, "Fresh / thawed - as-is", "1/2 cup ~ 75g", "Lowest sugar; frozen is fine"),
    F("Fruit", "Banana", 89, 1.1, 23, 2.6, "Ripe - as-is", "1 medium ~ 120g", "Higher sugar - keep small / half"),
    F("Nuts & Seeds", "Almonds", 579, 21, 22, 12.5, "Raw / soaked - as-is", "10 nuts ~ 12g", "Calorie-dense - keep 10-20g"),
    F("Nuts & Seeds", "Walnuts", 654, 15, 14, 6.7, "Raw - as-is", "2 halves ~ 8g", "Omega-3"),
    F("Nuts & Seeds", "Chia seeds", 486, 17, 42, 34, "Soak 10 min, then sprinkle", "1 tbsp ~ 12g", "Soak before eating"),
    F("Nuts & Seeds", "Flax seeds (ground)", 534, 18, 29, 27, "Grind, then sprinkle", "1 tbsp ~ 10g", "Grind for absorption"),
    F("Nuts & Seeds", "Pumpkin seeds", 559, 30, 11, 6, "Raw / roasted - sprinkle", "1 tbsp ~ 10g", "High protein"),
    F("Nuts & Seeds", "Sunflower seeds", 584, 21, 20, 9, "Raw / roasted - sprinkle", "1 tbsp ~ 10g"),
    F("Nuts & Seeds", "Mixed nuts & seeds", 600, 20, 20, 10, "As-is", "1 tbsp ~ 12g", "Keep portion small"),
    F("Cooking Fat", "Groundnut oil", 884, 0, 0, 0, "For tawa / saute", "1 tsp ~ 5g"),
    F("Cooking Fat", "Olive oil", 884, 0, 0, 0, "Low-heat / finishing", "1 tsp ~ 5g"),
    F("Cooking Fat", "Ghee", 900, 0, 0, 0, "Small amount only", "1 tsp ~ 5g"),
    F("Cooking Fat", "Mustard oil", 884, 0, 0, 0, "For tawa / saute", "1 tsp ~ 5g"),
  ],
};

async function read(): Promise<BreakfastFoodsData> {
  try {
    const d = JSON.parse(await fs.readFile(FILE, "utf-8")) as Partial<BreakfastFoodsData>;
    return {
      foods: Array.isArray(d.foods) ? d.foods : DEFAULTS.foods,
      notes: typeof d.notes === "string" ? d.notes : DEFAULTS.notes,
      target: d.target ?? DEFAULTS.target,
    };
  } catch {
    return DEFAULTS;
  }
}

export async function GET() {
  try {
    return NextResponse.json({ data: await read() });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { data } = await req.json() as { data: BreakfastFoodsData };
    const clean: BreakfastFoodsData = {
      foods: (data?.foods ?? [])
        .filter(f => f && typeof f.item === "string" && f.item.trim())
        .map(f => ({
          id: f.id || genId(),
          category: f.category || "Base",
          item: f.item.trim(),
          kcal_100g: Number(f.kcal_100g) || 0,
          protein_100g: Number(f.protein_100g) || 0,
          carbs_100g: Number(f.carbs_100g) || 0,
          fiber_100g: Number(f.fiber_100g) || 0,
          cooking_method: f.cooking_method ?? "",
          typical_unit: f.typical_unit ?? "",
          notes: f.notes ?? "",
        })),
      notes: typeof data?.notes === "string" ? data.notes : "",
      target: data?.target ?? DEFAULTS.target,
    };
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(clean, null, 2), "utf-8");
    return NextResponse.json({ data: clean });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
