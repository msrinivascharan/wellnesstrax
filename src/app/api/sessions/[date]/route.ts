import { NextResponse } from "next/server";
import { getSession, saveSession, deleteSession } from "@/lib/session-store";
import type { DayLog } from "@/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params;
  const log = await getSession(date);
  if (!log) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  return NextResponse.json({ log });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params;
  const body = await req.json();
  const log = body.log as DayLog;
  await saveSession(date, log);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params;
  const deleted = await deleteSession(date);
  return NextResponse.json({ deleted });
}
