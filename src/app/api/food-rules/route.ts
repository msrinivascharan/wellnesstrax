import { NextResponse } from "next/server";
import { loadFoodRules } from "@/lib/profile-loader";

export async function GET() {
  try {
    const rules = await loadFoodRules();
    return NextResponse.json({ rules });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load food rules";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
