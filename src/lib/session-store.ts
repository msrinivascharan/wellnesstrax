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

/**
 * Finds the most recent gym session strictly before `beforeDate` where the gym
 * was actually done and exercises were logged. Used to pre-fill the gym defaults
 * for a new day, so the latest entry carries forward automatically.
 */
export async function getLastGymBefore(
  beforeDate: string
): Promise<{ exercises: unknown[]; started_at: string } | null> {
  const dates = (await listSessions()).filter(d => d < beforeDate); // newest-first
  for (const date of dates) {
    const session = await getSession(date) as {
      activity?: { gym?: { did_gym?: boolean; started_at?: string; exercises?: unknown[] } };
    } | null;
    const gym = session?.activity?.gym;
    if (gym?.did_gym && Array.isArray(gym.exercises) && gym.exercises.length > 0) {
      return { exercises: gym.exercises, started_at: gym.started_at ?? "07:00" };
    }
  }
  return null;
}
