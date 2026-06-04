import { NextResponse } from "next/server";
import { getLastGymBefore } from "@/lib/session-store";

/** GET the most recent logged gym session before ?before=YYYY-MM-DD (default today). */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const before = searchParams.get("before") ?? new Date().toISOString().split("T")[0];
    const data = await getLastGymBefore(before);
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load last gym session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
