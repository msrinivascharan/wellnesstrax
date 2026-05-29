import type { DailyActivityPoint, ActivityLog, PrandialActivity } from "@/types";
import { listSessions, getSession } from "@/lib/session-store";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Minutes between two "HH:MM" strings, or 0 if invalid / non-positive. */
function minutesBetween(start?: string, end?: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some(n => Number.isNaN(n))) return 0;
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  return diff > 0 ? diff : 0;
}

function sumMin(list: PrandialActivity[] | undefined): number {
  return (list ?? []).reduce((s, a) => s + (a.duration_min || 0), 0);
}

/** Convert a raw session's activity into a single DailyActivityPoint. */
function rollup(date: string, activity: ActivityLog | undefined): DailyActivityPoint {
  const weekday = WEEKDAYS[new Date(date + "T12:00:00").getDay()] ?? "";
  const gym = activity?.gym;
  const gymDone = !!gym?.did_gym;
  const gymMin = gymDone ? minutesBetween(gym?.started_at, gym?.ended_at) : 0;
  const exerciseCount = gym?.exercises?.length ?? 0;
  const walks = activity?.post_prandial_walks?.length ?? 0;
  const walkMin = sumMin(activity?.post_prandial_walks);
  const soleus = activity?.soleus_pumps?.length ?? 0;
  const soleusMin = sumMin(activity?.soleus_pumps);
  const boxRounds = activity?.breathing?.box_4444 ?? 0;
  const longExhaleRounds = activity?.breathing?.long_exhale_478 ?? 0;

  return {
    date, weekday, gymDone, gymMin, exerciseCount,
    walks, walkMin, soleus, soleusMin,
    boxRounds, longExhaleRounds, breathingRounds: boxRounds + longExhaleRounds,
    activeMin: gymMin + walkMin + soleusMin,
  };
}

/**
 * Load up to `days` most-recent days of activity history (ascending by date).
 * Reads from the session store; days with no session file are skipped.
 */
export async function loadActivityHistory(days = 90): Promise<DailyActivityPoint[]> {
  const dates = (await listSessions()).slice(0, days); // listSessions is newest-first
  const points = await Promise.all(
    dates.map(async date => {
      const session = await getSession(date) as { activity?: ActivityLog } | null;
      if (!session) return null;
      return rollup(date, session.activity);
    })
  );
  return points
    .filter((p): p is DailyActivityPoint => p !== null)
    .sort((a, b) => a.date.localeCompare(b.date)); // oldest-first for charts
}

/** Compact text summary of activity history for the LLM prompt. */
export function summariseActivityHistory(points: DailyActivityPoint[]): string {
  if (points.length === 0) return "No activity history available yet.";

  const n = points.length;
  const gymDays = points.filter(p => p.gymDone).length;
  const gymMins = points.filter(p => p.gymMin > 0).map(p => p.gymMin);
  const avgGymMin = gymMins.length ? Math.round(gymMins.reduce((a, b) => a + b, 0) / gymMins.length) : 0;
  const totalWalks = points.reduce((s, p) => s + p.walks, 0);
  const totalSoleus = points.reduce((s, p) => s + p.soleus, 0);
  const avgActiveMin = Math.round(points.reduce((s, p) => s + p.activeMin, 0) / n);
  const daysWithWalk = points.filter(p => p.walks > 0).length;
  const daysWithAnything = points.filter(p => p.activeMin > 0 || p.gymDone).length;

  // Breathing practice rollup
  const breathDays = points.filter(p => p.breathingRounds > 0).length;
  const totalBox = points.reduce((s, p) => s + p.boxRounds, 0);
  const totalLongExhale = points.reduce((s, p) => s + p.longExhaleRounds, 0);
  const avgBox = breathDays ? (totalBox / n).toFixed(1) : "0";
  const avgLongExhale = breathDays ? (totalLongExhale / n).toFixed(1) : "0";

  // Per-day compact line (last 14 for context)
  const recent = points.slice(-14).map(p =>
    `${p.date}(${p.weekday}): gym ${p.gymDone ? `${p.gymMin || "?"}m` : "no"}, walks ${p.walks}, soleus ${p.soleus}, box ${p.boxRounds}, 4-7-8 ${p.longExhaleRounds}`
  ).join("\n  ");

  return `Days tracked: ${n}
Gym sessions: ${gymDays}/${n} days (${Math.round((gymDays / n) * 100)}%)
Average gym duration (when known): ${avgGymMin} min
Days with a post-meal walk: ${daysWithWalk}/${n}
Total post-meal walks: ${totalWalks} · Total soleus sessions: ${totalSoleus}
Average total active minutes/day: ${avgActiveMin}
Active days (any movement): ${daysWithAnything}/${n}

BREATHING PRACTICE (targets: Box 4-4-4-4 ~5-6 rounds/day, 4-7-8 long-exhale ~2 rounds/day):
Days practiced: ${breathDays}/${n} (${Math.round((breathDays / n) * 100)}%)
Total Box 4-4-4-4 rounds: ${totalBox} · Total 4-7-8 rounds: ${totalLongExhale}
Average per day — Box: ${avgBox}, 4-7-8: ${avgLongExhale}

Recent daily detail (last ${Math.min(14, n)} days):
  ${recent}`;
}
