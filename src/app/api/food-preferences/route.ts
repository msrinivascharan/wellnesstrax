import { NextResponse } from "next/server";
import { loadFoodPreferences, saveFoodPreferences } from "@/lib/profile-loader";
import type { FoodPreferences } from "@/types";

export async function GET() {
  try {
    const data = await loadFoodPreferences();
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load food preferences";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Replace food preferences. Body: { avoid: string[], encourage: string[] } */
export async function PUT(req: Request) {
  try {
    const body = await req.json() as Partial<FoodPreferences>;
    if (!Array.isArray(body.avoid) || !Array.isArray(body.encourage)) {
      return NextResponse.json({ error: "avoid and encourage must be arrays" }, { status: 400 });
    }
    const prefs: FoodPreferences = {
      avoid:    body.avoid.map(s => String(s).trim()).filter(Boolean),
      encourage: body.encourage.map(s => String(s).trim()).filter(Boolean),
    };
    await saveFoodPreferences(prefs);
    return NextResponse.json({ ok: true, data: prefs });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save food preferences";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
