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
      app: "NutriTrack",
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
        "Content-Disposition": `attachment; filename="nutritrack-backup-${today}.json"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Backup failed" },
      { status: 500 }
    );
  }
}
