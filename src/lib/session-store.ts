import fs from "fs/promises";
import path from "path";

const SESSIONS_DIR = path.join(process.cwd(), "data", "sessions");

async function ensureSessionsDir() {
  await fs.mkdir(SESSIONS_DIR, { recursive: true });
}

// Generic — stores any JSON object keyed by date
export async function saveSession(date: string, data: unknown): Promise<void> {
  await ensureSessionsDir();
  await fs.writeFile(path.join(SESSIONS_DIR, `${date}.json`), JSON.stringify(data, null, 2), "utf-8");
}

export async function getSession(date: string): Promise<unknown | null> {
  try {
    const raw = await fs.readFile(path.join(SESSIONS_DIR, `${date}.json`), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function listSessions(): Promise<string[]> {
  await ensureSessionsDir();
  const files = await fs.readdir(SESSIONS_DIR);
  return files
    .filter(f => f.endsWith(".json") && f !== ".gitkeep")
    .map(f => f.replace(".json", ""))
    .sort()
    .reverse();
}

export async function deleteSession(date: string): Promise<boolean> {
  try {
    await fs.unlink(path.join(SESSIONS_DIR, `${date}.json`));
    return true;
  } catch {
    return false;
  }
}
