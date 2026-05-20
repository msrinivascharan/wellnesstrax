import { NextResponse } from "next/server";
import { loadProfile } from "@/lib/profile-loader";

export async function GET() {
  try {
    const profile = await loadProfile();
    return NextResponse.json({ profile });
  } catch {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }
}
