"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { format } from "date-fns";
import type {
  DayLog, UserProfile, FoodItemsData, ActivitiesData,
  MealType, FoodEntry, ActivityLog, MedicationEntry, SupplementEntry,
  SleepLog, DayAnalysis, FoodPreferences,
} from "@/types";
import Sidebar, { type SectionId } from "@/components/Sidebar";
import Dashboard from "@/components/sections/Dashboard";
import FoodLog from "@/components/sections/FoodLog";
import ActivityLogSection from "@/components/sections/ActivityLog";
import MedicationLog from "@/components/sections/MedicationLog";
import BloodWork from "@/components/sections/BloodWork";
import WaterSleep from "@/components/sections/WaterSleep";
import Reports from "@/components/sections/Reports";

// ─── Medication entry builder (handles multi-time meds like Ticagrelor) ──────

/**
 * Converts profile.medications into MedicationEntry[].
 * - Medications without a `time` field (e.g. Inclisiran injectable) are skipped.
 * - Medications with "and" in time (e.g. "9AM and 9PM") are split into two
 *   entries: "Ticagrelor (9AM)" and "Ticagrelor (9PM)".
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

// ─── Component ────────────────────────────────────────────────────────────────

export default function Home() {
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const [section, setSection]                 = useState<SectionId>("dashboard");
  const [dayLog, setDayLog]                   = useState<DayLog | null>(null);
  const [profile, setProfile]                 = useState<UserProfile | null>(null);
  const [foodItems, setFoodItems]             = useState<FoodItemsData | null>(null);
  const [activitiesData, setActivitiesData]   = useState<ActivitiesData | null>(null);
  const [saveStatus, setSaveStatus]           = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [booting, setBooting]                 = useState(true);
  const [bootError, setBootError]             = useState("");
  const [bloodWork, setBloodWork]             = useState<import("@/types").BloodWorkData | undefined>(undefined);
  const [alwaysAvoid, setAlwaysAvoid]         = useState<string[]>([]);
  const [foodPrefs, setFoodPrefs]             = useState<FoodPreferences>({ avoid: [], encourage: [] });
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
      // No file for this date — return blank log; don't save yet (user may just be browsing)
      return fresh;
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

    return {
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
        const [profRes, foodRes, actRes, sessRes, bwRes, prefsRes] = await Promise.all([
          fetch("/api/profile"),
          fetch("/api/food-items"),
          fetch("/api/activities"),
          fetch(`/api/sessions/${today}`),
          fetch("/api/bloodwork"),
          fetch("/api/food-preferences"),
        ]);

        if (bwRes.ok) {
          const bwJson = await bwRes.json() as { data: import("@/types").BloodWorkData };
          setBloodWork(bwJson.data);
        }

        if (prefsRes.ok) {
          const { data: fp } = await prefsRes.json() as { data: FoodPreferences };
          setFoodPrefs(fp);
        }

        if (!profRes.ok) throw new Error("Failed to load profile.json");
        const { profile: p } = await profRes.json() as { profile: UserProfile };
        setProfile(p);
        profileRef.current = p;

        if (!foodRes.ok) throw new Error("Failed to load food_items.json");
        const { data: fi } = await foodRes.json() as { data: FoodItemsData };
        setFoodItems(fi);

        if (!actRes.ok) throw new Error("Failed to load activities.json");
        const { data: ad } = await actRes.json() as { data: ActivitiesData };
        setActivitiesData(ad);

        const rulesRes = await fetch("/api/food-rules");
        const { rules } = rulesRes.ok
          ? await rulesRes.json() as { rules: { supplements_to_track: { name: string; dose?: string; target: string }[]; always_avoid?: string[] } }
          : { rules: { supplements_to_track: [], always_avoid: [] } };
        const suppDefs: SuppDef[] = rules.supplements_to_track.map(s => ({
          name: s.name,
          dose: s.dose ?? "",
          scheduled_time: s.target,
        }));
        suppDefsRef.current = suppDefs;
        if (rules.always_avoid?.length) setAlwaysAvoid(rules.always_avoid);

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
          // Fresh day — create the file immediately
          setDayLog(fresh);
          logRef.current = fresh;
          await fetch(`/api/sessions/${today}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ log: fresh }),
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

  async function onSaveToList(meal: string, category: string, name: string) {
    try {
      const res = await fetch("/api/food-items", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meal, category, name }),
      });
      if (res.ok) {
        const { data } = await res.json() as { data: FoodItemsData };
        setFoodItems(data);
      }
    } catch { /* non-critical */ }
  }

  async function onRemoveFromList(meal: string, category: string, name: string) {
    try {
      const res = await fetch("/api/food-items", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meal, category, name }),
      });
      if (res.ok) {
        const { data } = await res.json() as { data: FoodItemsData };
        setFoodItems(data);
      }
    } catch { /* non-critical */ }
  }

  async function onUpdatePrefs(prefs: FoodPreferences) {
    try {
      const res = await fetch("/api/food-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      if (res.ok) {
        const { data } = await res.json() as { data: FoodPreferences };
        setFoodPrefs(data);
      }
    } catch { /* non-critical */ }
  }

  async function onMoveItem(meal: string, oldCat: string, newCat: string, name: string) {
    try {
      const res = await fetch("/api/food-items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meal, oldCategory: oldCat, newCategory: newCat, name }),
      });
      if (res.ok) {
        const { data } = await res.json() as { data: FoodItemsData };
        setFoodItems(data);
      }
    } catch { /* non-critical */ }
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
            Make sure <code className="text-teal-400">data/profile.json</code>,{" "}
            <code className="text-teal-400">data/food_items.json</code>, and{" "}
            <code className="text-teal-400">data/activities.json</code> exist,
            then restart <code className="text-teal-400">npm run dev</code>.
          </div>
        </div>
      </div>
    );
  }

  if (!profile || !foodItems || !activitiesData) return null;

  const isToday = selectedDate === todayStr;

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-base)" }}>
      <Sidebar
        active={section}
        onNavigate={setSection}
        dayLog={dayLog}
        profile={profile}
        saveStatus={saveStatus}
        selectedDate={selectedDate}
        onDateChange={handleDateChange}
      />

      <main className="flex-1 overflow-y-auto flex flex-col">

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
              <FoodLog dayLog={dayLog} foodItems={foodItems} onUpdate={onFoodUpdate} onMealTimeUpdate={onMealTimeUpdate} onSaveToList={onSaveToList} onRemoveFromList={onRemoveFromList} onMoveItem={onMoveItem} foodPrefs={foodPrefs} onUpdatePrefs={onUpdatePrefs} />
            )}
            {section === "activity" && (
              <ActivityLogSection dayLog={dayLog} activitiesData={activitiesData} onUpdate={onActivityUpdate} />
            )}
            {section === "medications" && (
              <MedicationLog dayLog={dayLog} onUpdate={onMedUpdate} />
            )}
            {section === "bloodwork" && (
              <BloodWork />
            )}
            {section === "water-sleep" && (
              <WaterSleep dayLog={dayLog} profile={profile} onUpdate={onWaterSleepUpdate} />
            )}
            {section === "reports" && (
              <Reports dayLog={dayLog} profile={profile} onAnalysisComplete={onAnalysisComplete} bloodWork={bloodWork} alwaysAvoid={alwaysAvoid} foodPrefs={foodPrefs} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
