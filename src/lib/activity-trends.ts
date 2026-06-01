import type { DailyActivityPoint, ActivityLog, PrandialActivity, SleepLog } from "@/types";
import { listSessions, getSession } from "@/lib/session-store";
import { getMusclesForExercise, MUSCLE_LABELS, type MuscleId } from "@/lib/muscle-map";

/** Minimal shape we read from a raw daily session for the rollup. */
interface RawSession {
  activity?: ActivityLog;
  water_ml?: number;
  sleep?: Partial<SleepLog>;
}

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

/** Convert a raw session into a single DailyActivityPoint (activity + wellness). */
function rollup(date: string, session: RawSession | undefined): DailyActivityPoint {
  const activity = session?.activity;
  const weekday = WEEKDAYS[new Date(date + "T12:00:00").getDay()] ?? "";
  const gym = activity?.gym;
  const gymDone = !!gym?.did_gym;
  const gymMin = gymDone ? minutesBetween(gym?.started_at, gym?.ended_at) : 0;
  const exercises = gym?.exercises ?? [];
  const exerciseCount = exercises.length;

  // Cardio / strength split + muscle work
  let cardioMin = 0;
  let strengthSets = 0;
  let strengthVolume = 0;
  const muscles: Record<string, number> = {};
  const addMuscle = (m: MuscleId, n: number) => { muscles[m] = (muscles[m] ?? 0) + n; };

  for (const ex of exercises) {
    if (ex.type === "cardio") {
      cardioMin += ex.duration_min ?? 0;
    } else if (ex.type === "core") {
      const sets = ex.core_sets ?? 0;
      strengthSets += sets;
      getMusclesForExercise(ex.name).forEach(m => addMuscle(m, sets));
    } else {
      const sets = ex.sets ?? [];
      strengthSets += sets.length;
      strengthVolume += sets.reduce((s, set) => s + (set.reps || 0) * (set.weight_kg || 0), 0);
      getMusclesForExercise(ex.name).forEach(m => addMuscle(m, sets.length));
    }
  }

  const walks = activity?.post_prandial_walks?.length ?? 0;
  const walkMin = sumMin(activity?.post_prandial_walks);
  const soleus = activity?.soleus_pumps?.length ?? 0;
  const soleusMin = sumMin(activity?.soleus_pumps);
  if (soleus > 0) addMuscle("calves", soleus); // soleus pumps work the calves

  const badminton = activity?.badminton ?? [];
  const badmintonMin = badminton.reduce((s, b) => s + (b.duration_min || 0), 0);
  const badmintonGames = badminton.reduce((s, b) => s + (b.games || 0), 0);

  const boxRounds = activity?.breathing?.box_4444 ?? 0;
  const longExhaleRounds = activity?.breathing?.long_exhale_478 ?? 0;

  const sleep = session?.sleep;

  return {
    date, weekday, gymDone, gymMin, exerciseCount,
    cardioMin, strengthSets, strengthVolume,
    walks, walkMin, soleus, soleusMin,
    badmintonMin, badmintonGames, muscles,
    boxRounds, longExhaleRounds, breathingRounds: boxRounds + longExhaleRounds,
    activeMin: gymMin + walkMin + soleusMin + badmintonMin,
    waterMl: session?.water_ml ?? 0,
    sleepHours: sleep?.hours ?? 0,
    sleepQuality: sleep?.quality ?? "",
    napHours: sleep?.nap_hours ?? 0,
    postLunchDip: sleep?.post_lunch_sleepiness ?? "",
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
      const session = await getSession(date) as RawSession | null;
      if (!session) return null;
      return rollup(date, session);
    })
  );
  return points
    .filter((p): p is DailyActivityPoint => p !== null)
    .sort((a, b) => a.date.localeCompare(b.date)); // oldest-first for charts
}

function dayDiff(a: string, b: string): number {
  return Math.round((new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime()) / 86400000);
}

/** Streak / gap analysis over the active (movement) days. */
function consistency(points: DailyActivityPoint[]) {
  const activeDates = points.filter(p => p.gymDone || p.activeMin > 0).map(p => p.date);
  let longestStreak = 0, cur = 0, prev: string | null = null, longestGap = 0;
  for (const d of activeDates) {
    cur = (prev && dayDiff(prev, d) === 1) ? cur + 1 : 1;
    longestStreak = Math.max(longestStreak, cur);
    if (prev) longestGap = Math.max(longestGap, dayDiff(prev, d) - 1);
    prev = d;
  }
  const lastDate = points[points.length - 1]?.date ?? "";
  const currentGap = activeDates.length ? dayDiff(activeDates[activeDates.length - 1], lastDate) : points.length;
  return { activeCount: activeDates.length, longestStreak, longestGap, currentGap };
}

/** Compact text summary of activity history for the LLM prompt. */
export function summariseActivityHistory(points: DailyActivityPoint[]): string {
  if (points.length === 0) return "No activity history available yet.";

  const n = points.length;
  const sum = (f: (p: DailyActivityPoint) => number) => points.reduce((s, p) => s + f(p), 0);
  const days = (f: (p: DailyActivityPoint) => boolean) => points.filter(f).length;

  // Cardio
  const cardioDays = days(p => p.cardioMin > 0);
  const totalCardio = sum(p => p.cardioMin);

  // Strength + muscles
  const strengthDays = days(p => p.strengthSets > 0);
  const totalSets = sum(p => p.strengthSets);
  const totalVolume = Math.round(sum(p => p.strengthVolume));
  const muscleTotals: Record<string, number> = {};
  for (const p of points) for (const [m, v] of Object.entries(p.muscles)) muscleTotals[m] = (muscleTotals[m] ?? 0) + v;
  const muscleRank = Object.entries(muscleTotals).sort((a, b) => b[1] - a[1]);
  const topMuscles = muscleRank.slice(0, 5).map(([m, v]) => `${MUSCLE_LABELS[m as MuscleId] ?? m} (${v} sets)`).join(", ") || "none";
  const neglected = (Object.keys(MUSCLE_LABELS) as MuscleId[]).filter(m => !muscleTotals[m]).map(m => MUSCLE_LABELS[m]).join(", ") || "none";

  // Indoor
  const walkDays = days(p => p.walks > 0);
  const soleusDays = days(p => p.soleus > 0);
  const totalWalks = sum(p => p.walks);
  const totalSoleus = sum(p => p.soleus);

  // Badminton
  const badDays = days(p => p.badmintonMin > 0);
  const badMin = sum(p => p.badmintonMin);
  const badGames = sum(p => p.badmintonGames);

  // Breathing
  const breathDays = days(p => p.breathingRounds > 0);
  const totalBox = sum(p => p.boxRounds);
  const totalLongExhale = sum(p => p.longExhaleRounds);

  const c = consistency(points);
  const avgActiveMin = Math.round(sum(p => p.activeMin) / n);

  const recent = points.slice(-14).map(p =>
    `${p.date}(${p.weekday}): cardio ${p.cardioMin}m, strength ${p.strengthSets} sets, walks ${p.walks}, soleus ${p.soleus}, badminton ${p.badmintonMin}m, box ${p.boxRounds}, 4-7-8 ${p.longExhaleRounds}`
  ).join("\n  ");

  return `Days tracked: ${n} · Average total active minutes/day: ${avgActiveMin}

CARDIO: ${cardioDays}/${n} days · total ${totalCardio} min · avg ${cardioDays ? Math.round(totalCardio / cardioDays) : 0} min/session
STRENGTH: ${strengthDays}/${n} days · ${totalSets} sets · ~${totalVolume} kg total volume
  Most-worked muscles: ${topMuscles}
  Untrained muscle groups: ${neglected}
INDOOR: walks ${walkDays}/${n} days (${totalWalks} total) · soleus ${soleusDays}/${n} days (${totalSoleus} total)
BADMINTON: ${badDays}/${n} days · ${badMin} min · ${badGames} games
BREATHING (targets: Box ~5-6/day, 4-7-8 ~2/day): ${breathDays}/${n} days · Box ${totalBox}, 4-7-8 ${totalLongExhale}

CONSISTENCY: active ${c.activeCount}/${n} days · longest streak ${c.longestStreak} days · longest gap ${c.longestGap} days · current gap ${c.currentGap} days since last active

Recent daily detail (last ${Math.min(14, n)} days):
  ${recent}`;
}

/** Compact hydration + sleep summary for the LLM prompt. */
export function summariseWellnessHistory(points: DailyActivityPoint[], waterTarget: number): string {
  const logged = points.filter(p => p.waterMl > 0 || p.sleepHours > 0);
  if (logged.length === 0) return "";

  const n = logged.length;
  const sum = (f: (p: DailyActivityPoint) => number) => logged.reduce((s, p) => s + f(p), 0);
  const days = (f: (p: DailyActivityPoint) => boolean) => logged.filter(f).length;

  // Hydration
  const waterDays = days(p => p.waterMl > 0);
  const avgWater = waterDays ? Math.round(sum(p => p.waterMl) / waterDays) : 0;
  const targetMet = days(p => p.waterMl >= waterTarget && waterTarget > 0);

  // Sleep
  const sleepDays = days(p => p.sleepHours > 0);
  const avgSleep = sleepDays ? (sum(p => p.sleepHours) / sleepDays).toFixed(1) : "0";
  const nights7 = days(p => p.sleepHours >= 7);
  const napDays = days(p => p.napHours > 0);
  const avgNap = napDays ? (sum(p => p.napHours) / napDays).toFixed(1) : "0";
  const qualityCounts: Record<string, number> = {};
  for (const p of logged) if (p.sleepQuality) qualityCounts[p.sleepQuality] = (qualityCounts[p.sleepQuality] ?? 0) + 1;
  const qualityStr = Object.entries(qualityCounts).map(([q, v]) => `${q} ${v}`).join(", ") || "not rated";
  const dipUncontrolled = days(p => p.postLunchDip === "uncontrollable");
  const dipControlled = days(p => p.postLunchDip === "controllable");

  const recent = logged.slice(-14).map(p =>
    `${p.date}(${p.weekday}): water ${p.waterMl}ml, sleep ${p.sleepHours}h${p.sleepQuality ? `/${p.sleepQuality}` : ""}, nap ${p.napHours}h, post-lunch dip ${p.postLunchDip || "n/a"}`
  ).join("\n  ");

  return `Days with hydration/sleep data: ${n}

HYDRATION (target ${waterTarget}ml/day): logged ${waterDays}/${n} days · avg ${avgWater}ml · target met ${targetMet}/${n} days
SLEEP: logged ${sleepDays}/${n} days · avg ${avgSleep}h · nights >=7h: ${nights7}/${n} · quality: ${qualityStr}
NAPS: ${napDays}/${n} days · avg ${avgNap}h
POST-LUNCH DIP: uncontrollable ${dipUncontrolled} days · controllable ${dipControlled} days

Recent daily detail (last ${Math.min(14, n)} days):
  ${recent}`;
}
