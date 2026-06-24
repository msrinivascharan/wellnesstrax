import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { listSessions, getSession } from "@/lib/session-store";

export const dynamic = "force-dynamic";

const DATA_DIR = path.join(process.cwd(), "data");
const MIRROR_DIR = process.env.BACKUP_MIRROR_DIR || "G:\\My Drive\\MyApps";

/** Build the full backup bundle: all config files + the last 30 daily sessions. */
async function buildBackup(): Promise<{ bundle: unknown; fileName: string }> {
  const [profileResult, activitiesResult, foodRulesResult] =
    await Promise.allSettled([
      fs.readFile(path.join(DATA_DIR, "profile.json"), "utf-8").then(JSON.parse),
      fs.readFile(path.join(DATA_DIR, "activities.json"), "utf-8").then(JSON.parse),
      fs.readFile(path.join(DATA_DIR, "food_rules.json"), "utf-8").then(JSON.parse),
    ]);

  const allDates = await listSessions();           // newest-first
  const sessions: Record<string, unknown> = {};
  for (const date of allDates.slice(0, 30)) {
    const data = await getSession(date);
    if (data !== null) sessions[date] = data;
  }

  const today = new Date().toISOString().split("T")[0];
  const bundle = {
    exported_at: new Date().toISOString(),
    app: "WellnessTrax",
    version: "1.0.0",
    data_files: {
      profile:    profileResult.status    === "fulfilled" ? profileResult.value    : null,
      activities: activitiesResult.status === "fulfilled" ? activitiesResult.value : null,
      food_rules: foodRulesResult.status  === "fulfilled" ? foodRulesResult.value  : null,
    },
    sessions,
  };
  return { bundle, fileName: `wellnesstrax-backup-${today}.json` };
}

/**
 * GET /api/backup — download the backup bundle as a JSON file.
 */
export async function GET() {
  try {
    const { bundle, fileName } = await buildBackup();
    return new NextResponse(JSON.stringify(bundle, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Backup failed" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/backup — write the backup to the external folder (e.g. Google Drive).
 * Into <BACKUP_MIRROR_DIR> (default "G:\My Drive\MyApps") it writes BOTH:
 *   - the JSON bundle file  (wellnesstrax-backup-<date>.json), replacing any older
 *     app backup files so only the latest remains, and
 *   - a mirror of the whole data/ folder at <dest>/data (overwriting the previous).
 * Failures (e.g. the drive isn't mounted) are reported, not thrown.
 */
export async function POST() {
  const destData = path.join(MIRROR_DIR, "data");
  try {
    await fs.access(DATA_DIR);                          // nothing to back up without data/
    await fs.mkdir(MIRROR_DIR, { recursive: true });    // ensure the destination exists

    // 1. Mirror the whole data/ folder (overwrite previous copy)
    await fs.cp(DATA_DIR, destData, { recursive: true, force: true });

    // 2. Write the JSON bundle file, replacing any previous app backup files
    const { bundle, fileName } = await buildBackup();
    try {
      const existing = await fs.readdir(MIRROR_DIR);
      await Promise.all(
        existing
          .filter(f => /^wellnesstrax-backup-.*\.json$/i.test(f) && f !== fileName)
          .map(f => fs.rm(path.join(MIRROR_DIR, f), { force: true }))
      );
    } catch { /* listing/cleanup is best-effort */ }
    await fs.writeFile(path.join(MIRROR_DIR, fileName), JSON.stringify(bundle, null, 2), "utf-8");

    return NextResponse.json({ mirrored: true, dest: MIRROR_DIR, file: fileName, at: new Date().toISOString() });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "copy failed";
    return NextResponse.json({ mirrored: false, dest: MIRROR_DIR, reason }, { status: 200 });
  }
}
