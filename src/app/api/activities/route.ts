import { NextResponse } from "next/server";
import { loadActivities } from "@/lib/profile-loader";

export async function GET() {
  try {
    const data = await loadActivities();
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load activities";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
