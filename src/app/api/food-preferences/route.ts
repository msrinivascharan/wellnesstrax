import { NextResponse } from "next/server";
import { loadFoodPreferences, saveFoodPreferences } from "@/lib/profile-loader";
import type { FoodPreferences, FoodPreferenceItem } from "@/types";

export async function GET() {
  try {
    const data = await loadFoodPreferences();
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load food preferences";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Replace food preferences. Body: { avoid: FoodPreferenceItem[], encourage: FoodPreferenceItem[] } */
export async function PUT(req: Request) {
  try {
    const body = await req.json() as Partial<FoodPreferences>;
    if (!Array.isArray(body.avoid) || !Array.isArray(body.encourage)) {
      return NextResponse.json({ error: "avoid and encourage must be arrays" }, { status: 400 });
    }
    // Accept either rich objects or legacy strings (migration-safe)
    function normalise(arr: unknown[]): FoodPreferenceItem[] {
      return arr.map(item => {
        if (typeof item === "string") {
          return { name: item, category: "Custom", subcategory: "", frequency: "", notes: "", enabled: true };
        }
        return item as FoodPreferenceItem;
      }).filter(i => i.name && i.name.trim());
    }
    const prefs: FoodPreferences = {
      avoid:    normalise(body.avoid),
      encourage: normalise(body.encourage),
    };
    await saveFoodPreferences(prefs);
    return NextResponse.json({ ok: true, data: prefs });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save food preferences";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
