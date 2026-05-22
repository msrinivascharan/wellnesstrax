import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import type { BloodWorkData } from "@/types";

const FILE = path.join(process.cwd(), "data", "bloodwork.json");

async function read(): Promise<BloodWorkData> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf-8")) as BloodWorkData;
  } catch {
    return { lipid_profile: [], thyroid_profile: [] };
  }
}

export async function GET() {
  try {
    return NextResponse.json({ data: await read() });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { data } = await req.json() as { data: BloodWorkData };
    await fs.writeFile(FILE, JSON.stringify(data, null, 2), "utf-8");
    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
