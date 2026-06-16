import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import type { MealPlan } from "@/types";
import { isPlannerMeal } from "@/lib/meal-planner-config";

type Store = { plans: Record<string, MealPlan>; applied: string[] };
const fileFor = (meal: string) => path.join(process.cwd(), "data", `${meal}_plans.json`);

async function read(meal: string): Promise<Store> {
  try {
    const d = JSON.parse(await fs.readFile(fileFor(meal), "utf-8")) as Partial<Store>;
    return {
      plans: d.plans && typeof d.plans === "object" ? d.plans : {},
      applied: Array.isArray(d.applied) ? d.applied : [],
    };
  } catch {
    return { plans: {}, applied: [] };
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ meal: string }> }) {
  const { meal } = await params;
  if (!isPlannerMeal(meal)) return NextResponse.json({ error: "unknown meal" }, { status: 404 });
  try {
    return NextResponse.json({ data: await read(meal) });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/**
 * Upsert one date's plan, or mark a date applied.
 * Body: { date, plan }  → save/clear that date's plan
 *       { date, applied: true } → record date as applied + drop its plan
 */
export async function PUT(req: Request, { params }: { params: Promise<{ meal: string }> }) {
  const { meal } = await params;
  if (!isPlannerMeal(meal)) return NextResponse.json({ error: "unknown meal" }, { status: 404 });
  try {
    const body = await req.json() as { date: string; plan?: MealPlan; applied?: boolean };
    if (!body.date) return NextResponse.json({ error: "date required" }, { status: 400 });
    const store = await read(meal);

    if (body.applied) {
      if (!store.applied.includes(body.date)) store.applied.push(body.date);
      delete store.plans[body.date];
    } else {
      const clean: MealPlan = {};
      for (const [slot, s] of Object.entries(body.plan ?? {})) {
        if (s && s.item) clean[slot] = { item: s.item, qty_g: Number(s.qty_g) || 0 };
      }
      if (Object.keys(clean).length === 0) delete store.plans[body.date];
      else store.plans[body.date] = clean;
    }

    await fs.mkdir(path.dirname(fileFor(meal)), { recursive: true });
    await fs.writeFile(fileFor(meal), JSON.stringify(store, null, 2), "utf-8");
    return NextResponse.json({ data: store });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
