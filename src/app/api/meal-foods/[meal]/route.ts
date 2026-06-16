import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import type { MealFoodsData } from "@/types";
import { MEAL_PLANNER, isPlannerMeal } from "@/lib/meal-planner-config";

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
const fileFor = (meal: string) => path.join(process.cwd(), "data", `${meal}_foods.json`);

async function read(meal: string): Promise<MealFoodsData> {
  const defaults = MEAL_PLANNER[meal as keyof typeof MEAL_PLANNER]!.defaults;
  try {
    const d = JSON.parse(await fs.readFile(fileFor(meal), "utf-8")) as Partial<MealFoodsData>;
    return {
      foods: Array.isArray(d.foods) ? d.foods : defaults.foods,
      notes: typeof d.notes === "string" ? d.notes : defaults.notes,
      target: d.target ?? defaults.target,
    };
  } catch {
    return defaults;
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ meal: string }> }) {
  const { meal } = await params;
  if (!isPlannerMeal(meal) || !MEAL_PLANNER[meal]) return NextResponse.json({ error: "unknown meal" }, { status: 404 });
  try {
    return NextResponse.json({ data: await read(meal) });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ meal: string }> }) {
  const { meal } = await params;
  if (!isPlannerMeal(meal) || !MEAL_PLANNER[meal]) return NextResponse.json({ error: "unknown meal" }, { status: 404 });
  try {
    const { data } = await req.json() as { data: MealFoodsData };
    const clean: MealFoodsData = {
      foods: (data?.foods ?? [])
        .filter(f => f && typeof f.item === "string" && f.item.trim())
        .map(f => ({
          id: f.id || genId(),
          category: f.category || MEAL_PLANNER[meal]!.categories[0],
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
      target: data?.target ?? MEAL_PLANNER[meal]!.defaults.target,
    };
    await fs.mkdir(path.dirname(fileFor(meal)), { recursive: true });
    await fs.writeFile(fileFor(meal), JSON.stringify(clean, null, 2), "utf-8");
    return NextResponse.json({ data: clean });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
