import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export interface InjectionRecord {
  id: string;
  medication: string;
  dose: string;
  date_given: string;
  notes: string;
  next_due: string;
}

interface InjectableMedsData {
  injections: InjectionRecord[];
}

const FILE = path.join(process.cwd(), "data", "injectable_meds.json");

async function read(): Promise<InjectableMedsData> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf-8")) as InjectableMedsData;
  } catch {
    return { injections: [] };
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
    const { data } = await req.json() as { data: InjectableMedsData };
    await fs.writeFile(FILE, JSON.stringify(data, null, 2), "utf-8");
    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
