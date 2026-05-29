import { NextResponse } from "next/server";
import { loadActivityHistory } from "@/lib/activity-trends";

/** GET activity history rollup for trend charts. Optional ?days=N (default 90, max 365). */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const days = Math.min(365, Math.max(1, parseInt(searchParams.get("days") ?? "90", 10) || 90));
    const points = await loadActivityHistory(days);
    return NextResponse.json({ data: points });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load activity trends";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
