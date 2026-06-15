import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import type { BreakfastPlan } from "@/types";

const FILE = path.join(process.cwd(), "data", "breakfast_plans.json");

type Store = { plans: Record<string, BreakfastPlan> };

async function read(): Promise<Store> {
  try {
    const d = JSON.parse(await fs.readFile(FILE, "utf-8")) as Store;
    return { plans: d.plans && typeof d.plans === "object" ? d.plans : {} };
  } catch {
    return { plans: {} };
  }
}

export async function GET() {
  try {
    return NextResponse.json({ data: await read() });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/** Upsert one date's plan. Body: { date: "YYYY-MM-DD", plan: BreakfastPlan } */
export async function PUT(req: Request) {
  try {
    const { date, plan } = await req.json() as { date: string; plan: BreakfastPlan };
    if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });
    const store = await read();
    // strip empty slots
    const clean: BreakfastPlan = {};
    for (const [slot, s] of Object.entries(plan ?? {})) {
      if (s && s.item) clean[slot] = { item: s.item, qty_g: Number(s.qty_g) || 0 };
    }
    if (Object.keys(clean).length === 0) delete store.plans[date];
    else store.plans[date] = clean;
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(store, null, 2), "utf-8");
    return NextResponse.json({ data: store });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
