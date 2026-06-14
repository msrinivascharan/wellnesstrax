import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import type { WeightPlan } from "@/types";

const FILE = path.join(process.cwd(), "data", "weight_plan.json");

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

/** Starter checklist of evidence-based weight-loss habits — editable in-app. */
const DEFAULTS: WeightPlan = {
  checklist: [
    { id: "hydration",      label: "Drink enough water" },
    { id: "movement",       label: "Stay active — 8,000+ steps / movement" },
    { id: "gym",            label: "Workout / gym session" },
    { id: "portion",        label: "Mindful portions — no overeating" },
    { id: "no-junk",        label: "Avoid added sugar & junk food" },
    { id: "no-late-eating", label: "No eating 2–3h before bed" },
    { id: "sleep",          label: "7+ hours of sleep" },
  ],
};

async function read(): Promise<WeightPlan> {
  try {
    const data = JSON.parse(await fs.readFile(FILE, "utf-8")) as WeightPlan;
    return { checklist: Array.isArray(data.checklist) ? data.checklist : DEFAULTS.checklist };
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

/** Replace the checklist. Body: { data: WeightPlan } */
export async function PUT(req: Request) {
  try {
    const { data } = await req.json() as { data: WeightPlan };
    const clean: WeightPlan = {
      checklist: (data?.checklist ?? [])
        .filter(i => i && typeof i.label === "string" && i.label.trim())
        .map(i => ({ id: i.id || genId(), label: i.label.trim() })),
    };
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(clean, null, 2), "utf-8");
    return NextResponse.json({ data: clean });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
