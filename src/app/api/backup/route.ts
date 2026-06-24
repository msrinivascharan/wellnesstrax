import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { listSessions, getSession } from "@/lib/session-store";

export const dynamic = "force-dynamic";

/**
 * GET /api/backup
 * Returns all config data files + the last 30 daily sessions as a single
 * downloadable JSON bundle.
 */
export async function GET() {
  try {
    const DATA_DIR = path.join(process.cwd(), "data");

    // Load all static data files (gracefully handle missing files)
    const [profileResult, foodItemsResult, activitiesResult, foodRulesResult] =
      await Promise.allSettled([
        fs.readFile(path.join(DATA_DIR, "profile.json"), "utf-8").then(JSON.parse),
        fs.readFile(path.join(DATA_DIR, "food_items.json"), "utf-8").then(JSON.parse),
        fs.readFile(path.join(DATA_DIR, "activities.json"), "utf-8").then(JSON.parse),
        fs.readFile(path.join(DATA_DIR, "food_rules.json"), "utf-8").then(JSON.parse),
      ]);

    // Collect last 30 session files (listSessions returns newest-first)
    const allDates = await listSessions();
    const recentDates = allDates.slice(0, 30);
    const sessions: Record<string, unknown> = {};
    for (const date of recentDates) {
      const data = await getSession(date);
      if (data !== null) sessions[date] = data;
    }

    const today = new Date().toISOString().split("T")[0];

    const backup = {
      exported_at: new Date().toISOString(),
      app: "WellnessTrax",
      version: "1.0.0",
      data_files: {
        profile:     profileResult.status    === "fulfilled" ? profileResult.value    : null,
        food_items:  foodItemsResult.status  === "fulfilled" ? foodItemsResult.value  : null,
        activities:  activitiesResult.status === "fulfilled" ? activitiesResult.value : null,
        food_rules:  foodRulesResult.status  === "fulfilled" ? foodRulesResult.value  : null,
      },
      sessions,
    };

    return new NextResponse(JSON.stringify(backup, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="wellnesstrax-backup-${today}.json"`,
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
 * POST /api/backup
 * Mirrors the local `data/` folder into an external backup directory (e.g. a
 * Google Drive folder), overwriting the previous copy. Destination is taken from
 * BACKUP_MIRROR_DIR, defaulting to "G:\My Drive\MyApps". The copy lands at
 * <dest>/data. Failures (e.g. the drive isn't mounted) are reported, not thrown.
 */
export async function POST() {
  const DATA_DIR = path.join(process.cwd(), "data");
  const dest = process.env.BACKUP_MIRROR_DIR || "G:\\My Drive\\MyApps";
  const destData = path.join(dest, "data");
  try {
    await fs.access(DATA_DIR);                        // nothing to copy if there's no data/
    await fs.mkdir(dest, { recursive: true });        // ensure the destination base exists
    await fs.cp(DATA_DIR, destData, { recursive: true, force: true });  // overwrite previous copy
    return NextResponse.json({ mirrored: true, dest: destData });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "copy failed";
    return NextResponse.json({ mirrored: false, dest: destData, reason }, { status: 200 });
  }
}
