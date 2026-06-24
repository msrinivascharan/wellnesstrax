"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { format } from "date-fns";
import type {
  DayLog, UserProfile, ActivitiesData,
  MealType, FoodEntry, ActivityLog, MedicationEntry, SupplementEntry,
  SleepLog, DayAnalysis, ExerciseEntry,
} from "@/types";
import { autoCategory } from "@/lib/food-utils";
import Sidebar, { type SectionId } from "@/components/Sidebar";
import Dashboard from "@/components/sections/Dashboard";
import FoodLog from "@/components/sections/FoodLog";
import ActivityLogSection from "@/components/sections/ActivityLog";
import MedicationLog from "@/components/sections/MedicationLog";
import BloodWork from "@/components/sections/BloodWork";
import WaterSleep from "@/components/sections/WaterSleep";
import Reports from "@/components/sections/Reports";

// ─── Medication entry builder (handles multi-time meds) ──────

/**
 * Converts profile.medications into MedicationEntry[].
 * - Medications without a `time` field (e.g. periodic injectables) are skipped.
 * - Medications with "and" in time (e.g. "9AM and 9PM") are split into two
 *   entries: "<Med> (9AM)" and "<Med> (9PM)".
 */
function buildMedEntries(profile: UserProfile): MedicationEntry[] {
  return profile.medications.flatMap(m => {
    if (!m.time) return [];
    if (/\band\b/i.test(m.time)) {
      const times = m.time.split(/\s+and\s+/i).map(t => t.trim()).filter(Boolean);
      return times.map(t => ({
        name: `${m.name} (${t})`,
        dose: m.dose,
        scheduled_time: t,
        condition: m.condition,
        taken: false as const,
        taken_at: "",
      }));
    }
    return [{
      name: m.name,
      dose: m.dose,
      scheduled_time: m.time,
      condition: m.condition,
      taken: false as const,
      taken_at: "",
    }];
  });
}

// ─── Supplement-def type ──────────────────────────────────────────────────────

type SuppDef = { name: string; dose: string; scheduled_time: string };

// ─── DayLog factory — accepts explicit date so it works for any day ───────────

function makeEmptyLog(profile: UserProfile, supplements: SuppDef[], date: string): DayLog {
  const dayDate = new Date(date + "T12:00:00");
  const now = new Date();
  return {
    date,
    day: format(dayDate, "EEEE"),
    food: { breakfast: [], lunch: [], dinner: [], snacks: [] },
    water_ml: 0,
    sleep: { hours: 0, quality: "", bedtime: "", wake_time: "", notes: "" },
    medications: buildMedEntries(profile),
    supplements: supplements.map(s => ({
      name: s.name,
      dose: s.dose,
      scheduled_time: s.scheduled_time,
      taken: false,
      taken_at: "",
    })),
    activity: {
      gym: { did_gym: false, started_at: "07:00", exercises: [] },
      post_prandial_walks: [],
      soleus_pumps: [],
      breathing: { box_4444: 0, long_exhale_478: 0 },
    },
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
}

/**
 * Seed a fresh day's GYM exercises (only) from the most recent logged gym
 * session, so today's input carries forward as tomorrow's default. did_gym is
 * left false — the exercises are pre-filled but the user still confirms the day.
 */
async function withGymDefaults(log: DayLog, date: string): Promise<DayLog> {
  try {
    const res = await fetch(`/api/last-gym?before=${date}`);
    if (!res.ok) return log;
    const { data } = await res.json() as { data?: { exercises: ExerciseEntry[]; started_at: string } | null };
    if (!data?.exercises?.length) return log;
    return {
      ...log,
      activity: {
        ...log.activity,
        gym: {
          ...log.activity.gym,
          did_gym: false,
          exercises: structuredClone(data.exercises),
          started_at: data.started_at || log.activity.gym.started_at,
        },
      },
    };
  } catch {
    return log;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Home() {
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const [section, setSection]                 = useState<SectionId>("dashboard");
  const [navOpen, setNavOpen]                 = useState(false);   // mobile drawer
  const [dayLog, setDayLog]                   = useState<DayLog | null>(null);
  const [profile, setProfile]                 = useState<UserProfile | null>(null);
  const [activitiesData, setActivitiesData]   = useState<ActivitiesData | null>(null);
  const [saveStatus, setSaveStatus]           = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [booting, setBooting]                 = useState(true);
  const [bootError, setBootError]             = useState("");
  const [bloodWork, setBloodWork]             = useState<import("@/types").BloodWorkData | undefined>(undefined);
  const [selectedDate, setSelectedDate]       = useState<string>(todayStr);
  const [dateLoading, setDateLoading]         = useState(false);

  // Refs that let async functions always see the latest values without stale closures
  const saveTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logRef      = useRef<DayLog | null>(null);
  const profileRef  = useRef<UserProfile | null>(null);
  const suppDefsRef = useRef<SuppDef[]>([]);

  // ── Save to server (debounced) ────────────────────────────────────────────
  const persistLog = useCallback(async (log: DayLog) => {
    setSaveStatus("saving");
    try {
      await fetch(`/api/sessions/${log.date}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ log }),
      });
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
  }, []);

  const debouncedSave = useCallback((log: DayLog) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persistLog(log), 900);
  }, [persistLog]);

  // ── Update log (merge + save) ─────────────────────────────────────────────
  const updateLog = useCallback((updates: Partial<DayLog>) => {
    setDayLog(prev => {
      if (!prev) return prev;
      const next: DayLog = { ...prev, ...updates, updated_at: new Date().toISOString() };
      logRef.current = next;
      debouncedSave(next);
      return next;
    });
  }, [debouncedSave]);

  // ── Session loader — works for today OR any past date ─────────────────────
  async function loadSessionForDate(date: string): Promise<DayLog> {
    const p = profileRef.current;
    const defs = suppDefsRef.current;
    if (!p) throw new Error("Profile not loaded");

    const fresh = makeEmptyLog(p, defs, date);
    const sessRes = await fetch(`/api/sessions/${date}`);

    if (!sessRes.ok) {
      // No file for this date — return blank log seeded with the last gym's
      // exercises; don't save yet (user may just be browsing).
      return await withGymDefaults(fresh, date);
    }

    const raw = await sessRes.json() as { log?: Partial<DayLog> };
    const saved = raw.log ?? {};

    const mergedMeds = buildMedEntries(p).map(freshEntry => {
      const existing = (saved.medications ?? []).find(m => m.name === freshEntry.name);
      return existing ?? freshEntry;
    });
    const mergedSupps = defs.map(sd => {
      const existing = (saved.supplements ?? []).find(s => s.name === sd.name);
      return existing ?? { ...sd, taken: false, taken_at: "" };
    });

    const savedAnalysis =
      saved.analysis &&
      typeof (saved.analysis as DayAnalysis).overall_score === "number" &&
      (saved.analysis as DayAnalysis).nutrition != null
        ? (saved.analysis as DayAnalysis)
        : undefined;

    const result: DayLog = {
      ...fresh,
      ...saved,
      date,
      food: saved.food ?? fresh.food,
      water_ml: saved.water_ml ?? 0,
      sleep: saved.sleep ?? fresh.sleep,
      activity: saved.activity
        ? { ...saved.activity, breathing: saved.activity.breathing ?? { box_4444: 0, long_exhale_478: 0 } }
        : fresh.activity,
      medications: mergedMeds,
      supplements: mergedSupps,
      analysis: savedAnalysis,
    };
    return result;
  }

  // ── Switch to a different date ────────────────────────────────────────────
  async function handleDateChange(date: string) {
    if (date === selectedDate) return;
    if (date > todayStr) return; // no future dates
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus("idle");
    setSelectedDate(date);
    setDateLoading(true);
    setDayLog(null);
    try {
      const log = await loadSessionForDate(date);
      setDayLog(log);
      logRef.current = log;
    } catch (e) {
      console.error("Failed to load session for", date, e);
    } finally {
      setDateLoading(false);
    }
  }

  // ── Boot ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function boot() {
      const today = format(new Date(), "yyyy-MM-dd");
      try {
        const [profRes, actRes, sessRes, bwRes] = await Promise.all([
          fetch("/api/profile"),
          fetch("/api/activities"),
          fetch(`/api/sessions/${today}`),
          fetch("/api/bloodwork"),
        ]);

        if (bwRes.ok) {
          const bwJson = await bwRes.json() as { data: import("@/types").BloodWorkData };
          setBloodWork(bwJson.data);
        }

        if (!profRes.ok) throw new Error("Failed to load profile.json");
        const { profile: p } = await profRes.json() as { profile: UserProfile };
        setProfile(p);
        profileRef.current = p;

        if (!actRes.ok) throw new Error("Failed to load activities.json");
        const { data: ad } = await actRes.json() as { data: ActivitiesData };
        setActivitiesData(ad);

        const rulesRes = await fetch("/api/food-rules");
        const { rules } = rulesRes.ok
          ? await rulesRes.json() as { rules: { supplements_to_track: { name: string; dose?: string; target: string }[] } }
          : { rules: { supplements_to_track: [] } };
        const suppDefs: SuppDef[] = rules.supplements_to_track.map(s => ({
          name: s.name,
          dose: s.dose ?? "",
          scheduled_time: s.target,
        }));
        suppDefsRef.current = suppDefs;

        const fresh = makeEmptyLog(p, suppDefs, today);

        if (sessRes.ok) {
          const raw = await sessRes.json() as { log?: Partial<DayLog> };
          const saved = raw.log ?? {};

          const mergedMeds = buildMedEntries(p).map(freshEntry => {
            const existing = (saved.medications ?? []).find(m => m.name === freshEntry.name);
            return existing ?? freshEntry;
          });
          const mergedSupps = suppDefs.map(sd => {
            const existing = (saved.supplements ?? []).find(s => s.name === sd.name);
            return existing ?? { ...sd, taken: false, taken_at: "" };
          });

          const savedAnalysis =
            saved.analysis &&
            typeof (saved.analysis as DayAnalysis).overall_score === "number" &&
            (saved.analysis as DayAnalysis).nutrition != null
              ? (saved.analysis as DayAnalysis)
              : undefined;

          const merged: DayLog = {
            ...fresh,
            ...saved,
            date: today,
            food: saved.food ?? fresh.food,
            water_ml: saved.water_ml ?? 0,
            sleep: saved.sleep ?? fresh.sleep,
            activity: saved.activity
              ? { ...saved.activity, breathing: saved.activity.breathing ?? { box_4444: 0, long_exhale_478: 0 } }
              : fresh.activity,
            medications: mergedMeds,
            supplements: mergedSupps,
            analysis: savedAnalysis,
          };

          // Overwrite if old format
          if (!saved.food || !saved.activity || !savedAnalysis !== !saved.analysis) {
            await fetch(`/api/sessions/${today}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ log: merged }),
            });
          }

          setDayLog(merged);
          logRef.current = merged;
        } else {
          // Fresh day — seed gym from the last session, then create the file
          const seeded = await withGymDefaults(fresh, today);
          setDayLog(seeded);
          logRef.current = seeded;
          await fetch(`/api/sessions/${today}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ log: seeded }),
          });
        }
      } catch (e) {
        setBootError(e instanceof Error ? e.message : "Failed to start app");
      } finally {
        setBooting(false);
      }
    }
    boot();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Section-specific update handlers ─────────────────────────────────────
  function onFoodUpdate(food: Record<MealType, FoodEntry[]>) { updateLog({ food }); }
  function onMealTimeUpdate(meal: MealType, time: string) {
    const meal_times = { ...(dayLog?.meal_times ?? {}), [meal]: time };
    updateLog({ meal_times });
  }
  function onActivityUpdate(activity: ActivityLog) { updateLog({ activity }); }
  function onMedUpdate(meds: MedicationEntry[], supps: SupplementEntry[]) {
    updateLog({ medications: meds, supplements: supps });
  }
  function onWaterSleepUpdate(water_ml: number, sleep: SleepLog) { updateLog({ water_ml, sleep }); }
  function onAnalysisComplete(analysis: DayAnalysis) { updateLog({ analysis }); }

  // Meal planner: apply a plate to a date's meal log (manual, on demand).
  // Appends the planned items to that day's meal; updates the live view if it's
  // the date being viewed, otherwise writes straight to that date's session.
  async function onApplyMealPlan(meal: MealType, date: string, items: { name: string; qty_g: number }[]) {
    const entries: FoodEntry[] = items
      .filter(i => i.name && i.qty_g > 0)
      .map(i => ({
        id: crypto.randomUUID(),
        name: i.name,
        category: autoCategory(i.name),
        quantity_g: i.qty_g,
        unit: "g",
        custom: false,
        logged_at: new Date().toISOString(),
      }));
    if (entries.length === 0) return;

    if (date === selectedDate && logRef.current) {
      const cur = logRef.current;
      const merged: DayLog = { ...cur, food: { ...cur.food, [meal]: [...cur.food[meal], ...entries] }, updated_at: new Date().toISOString() };
      setDayLog(merged);
      logRef.current = merged;
      persistLog(merged);
    } else {
      const log = await loadSessionForDate(date);
      const merged: DayLog = { ...log, food: { ...log.food, [meal]: [...log.food[meal], ...entries] }, updated_at: new Date().toISOString() };
      await fetch(`/api/sessions/${date}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ log: merged }),
      });
    }
  }


  // ── Boot screen ───────────────────────────────────────────────────────────
  if (booting) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: "var(--bg-base)" }}>
        <div className="text-center space-y-4">
          <div className="text-4xl spin-slow inline-block">🧬</div>
          <div className="text-sm font-medium text-white">Loading WellnessTrax…</div>
          <div className="flex justify-center gap-1.5">
            <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
          </div>
        </div>
      </div>
    );
  }

  if (bootError) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: "var(--bg-base)" }}>
        <div className="card p-8 max-w-md text-center space-y-3">
          <div className="text-3xl">⚠️</div>
          <div className="text-base font-semibold text-white">Startup failed</div>
          <div className="text-sm" style={{ color: "#ef4444" }}>{bootError}</div>
          <div className="text-xs" style={{ color: "#475569" }}>
            Make sure <code className="text-teal-400">data/profile.json</code> and{" "}
            <code className="text-teal-400">data/activities.json</code> exist,
            then restart <code className="text-teal-400">npm run dev</code>.
          </div>
        </div>
      </div>
    );
  }

  if (!profile || !activitiesData) return null;

  const isToday = selectedDate === todayStr;

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-base)" }}>
      {/* Mobile drawer backdrop */}
      {navOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setNavOpen(false)} />
      )}

      <Sidebar
        active={section}
        onNavigate={setSection}
        dayLog={dayLog}
        profile={profile}
        saveStatus={saveStatus}
        selectedDate={selectedDate}
        onDateChange={handleDateChange}
        open={navOpen}
        onClose={() => setNavOpen(false)}
      />

      <main className="flex-1 min-w-0 overflow-y-auto flex flex-col">

        {/* ── Mobile top bar (hamburger) — hidden on desktop ─────────────── */}
        <div className="lg:hidden sticky top-0 z-30 shrink-0 flex items-center gap-3 px-4 py-3 border-b"
          style={{ background: "var(--bg-sidebar)", borderColor: "var(--border)" }}>
          <button onClick={() => setNavOpen(true)} aria-label="Open menu"
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-lg"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "#94a3b8" }}>
            ☰
          </button>
          <span className="text-sm font-bold text-white truncate">WellnessTrax</span>
          <span className="ml-auto text-xs truncate" style={{ color: "#64748b" }}>
            {format(new Date(selectedDate + "T12:00:00"), "EEE, dd MMM")}
          </span>
        </div>

        {/* ── Past-date editing banner ─────────────────────────────────── */}
        {!isToday && (
          <div className="shrink-0 flex items-center gap-2.5 px-5 py-2.5 text-xs font-medium"
            style={{ background: "rgba(245,158,11,0.08)", borderBottom: "1px solid rgba(245,158,11,0.18)", color: "#f59e0b" }}>
            <span className="text-base">📅</span>
            <span>
              Editing: <strong>{format(new Date(selectedDate + "T12:00:00"), "EEEE, dd MMMM yyyy")}</strong>
            </span>
            <span className="ml-auto hidden sm:inline" style={{ color: "#92400e", opacity: 0.8 }}>
              All changes save to this date
            </span>
            <button
              onClick={() => handleDateChange(todayStr)}
              className="ml-2 px-2.5 py-1 rounded-lg transition-all"
              style={{ background: "rgba(245,158,11,0.15)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.3)" }}>
              ↩ Today
            </button>
          </div>
        )}

        {/* ── Date-switching spinner ───────────────────────────────────── */}
        {dateLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <div className="text-4xl">📅</div>
            <div className="flex gap-1.5">
              <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
            </div>
            <div className="text-sm" style={{ color: "#475569" }}>
              Loading {format(new Date(selectedDate + "T12:00:00"), "dd MMMM yyyy")}…
            </div>
          </div>
        ) : !dayLog ? null : (
          <>
            {section === "dashboard" && (
              <Dashboard dayLog={dayLog} profile={profile} onNavigate={s => setSection(s as SectionId)} />
            )}
            {section === "food" && (
              <FoodLog dayLog={dayLog} onUpdate={onFoodUpdate} onMealTimeUpdate={onMealTimeUpdate} onApplyMealPlan={onApplyMealPlan} />
            )}
            {section === "activity" && (
              <ActivityLogSection dayLog={dayLog} activitiesData={activitiesData} onUpdate={onActivityUpdate} />
            )}
            {section === "medications" && (
              <MedicationLog dayLog={dayLog} profile={profile} onUpdate={onMedUpdate} />
            )}
            {section === "bloodwork" && (
              <BloodWork profile={profile} />
            )}
            {section === "water-sleep" && (
              <WaterSleep dayLog={dayLog} profile={profile} onUpdate={onWaterSleepUpdate} />
            )}
            {section === "reports" && (
              <Reports dayLog={dayLog} profile={profile} onAnalysisComplete={onAnalysisComplete} bloodWork={bloodWork} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
