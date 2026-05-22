"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { format } from "date-fns";
import type {
  DayLog, UserProfile, FoodItemsData, ActivitiesData,
  MealType, FoodEntry, ActivityLog, MedicationEntry, SupplementEntry,
  SleepLog, DayAnalysis,
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
    if (!m.time) return [];   // no daily schedule (e.g. injectable every 6 months)
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

// ─── Initial DayLog factory ───────────────────────────────────────────────────

function makeEmptyLog(profile: UserProfile, supplements: { name: string; dose: string; scheduled_time: string }[]): DayLog {
  const now = new Date();
  const date = format(now, "yyyy-MM-dd");
  return {
    date,
    day: format(now, "EEEE"),
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
  const [section, setSection] = useState<SectionId>("dashboard");
  const [dayLog, setDayLog] = useState<DayLog | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [foodItems, setFoodItems] = useState<FoodItemsData | null>(null);
  const [activitiesData, setActivitiesData] = useState<ActivitiesData | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState("");
  const [bloodWork, setBloodWork] = useState<import("@/types").BloodWorkData | undefined>(undefined);
  const [alwaysAvoid, setAlwaysAvoid] = useState<string[]>([]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logRef = useRef<DayLog | null>(null);

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

  // ── Boot ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function boot() {
      const today = format(new Date(), "yyyy-MM-dd");
      try {
        const [profRes, foodRes, actRes, sessRes, bwRes] = await Promise.all([
          fetch("/api/profile"),
          fetch("/api/food-items"),
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

        if (!foodRes.ok) throw new Error("Failed to load food_items.json");
        const { data: fi } = await foodRes.json() as { data: FoodItemsData };
        setFoodItems(fi);

        if (!actRes.ok) throw new Error("Failed to load activities.json");
        const { data: ad } = await actRes.json() as { data: ActivitiesData };
        setActivitiesData(ad);

        // Build supplement entries from food_rules via profile-loader already done server-side
        // We pass them from food_rules.json — use the api route
        const rulesRes = await fetch("/api/food-rules");
        const { rules } = rulesRes.ok
          ? await rulesRes.json() as { rules: { supplements_to_track: { name: string; dose?: string; target: string }[]; always_avoid?: string[] } }
          : { rules: { supplements_to_track: [], always_avoid: [] } };
        const suppDefs = rules.supplements_to_track.map(s => ({
          name: s.name,
          dose: s.dose ?? "",
          scheduled_time: s.target,
        }));
        if (rules.always_avoid?.length) setAlwaysAvoid(rules.always_avoid);

        const fresh = makeEmptyLog(p, suppDefs);

        if (sessRes.ok) {
          // The saved file may be in the old chatbot format (no medications/food/activity).
          // Defensively merge: use fresh defaults for any missing field.
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

          // Only carry forward analysis that's in the NEW format (has overall_score + nutrition)
          const savedAnalysis =
            saved.analysis &&
            typeof (saved.analysis as DayAnalysis).overall_score === "number" &&
            (saved.analysis as DayAnalysis).nutrition != null
              ? (saved.analysis as DayAnalysis)
              : undefined;

          const merged: DayLog = {
            ...fresh,                               // safe defaults for every field
            ...saved,                               // overlay what was saved
            date: today,                            // always use today's date
            food: saved.food ?? fresh.food,
            water_ml: saved.water_ml ?? 0,
            sleep: saved.sleep ?? fresh.sleep,
            activity: saved.activity
              ? { ...saved.activity, breathing: saved.activity.breathing ?? { box_4444: 0, long_exhale_478: 0 } }
              : fresh.activity,
            medications: mergedMeds,
            supplements: mergedSupps,
            analysis: savedAnalysis,                // strip old chatbot-era analysis
          };

          // If the file was in the old format, overwrite it with the new structure
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
          // Fresh day — save immediately so the file exists
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

  /** Save a custom food item to food_items.json and refresh the local foodItems state */
  async function onSaveToList(meal: string, category: string, name: string) {
    try {
      const res = await fetch("/api/food-items", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meal, category, name }),
      });
      if (res.ok) {
        const { data } = await res.json() as { data: FoodItemsData };
        setFoodItems(data);   // immediately reflected in chips without refresh
      }
    } catch {
      // non-critical — item is already logged in the session
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
            Make sure <code className="text-teal-400">data/profile.json</code>,{" "}
            <code className="text-teal-400">data/food_items.json</code>, and{" "}
            <code className="text-teal-400">data/activities.json</code> exist,
            then restart <code className="text-teal-400">npm run dev</code>.
          </div>
        </div>
      </div>
    );
  }

  if (!dayLog || !profile || !foodItems || !activitiesData) return null;

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-base)" }}>
      <Sidebar
        active={section}
        onNavigate={setSection}
        dayLog={dayLog}
        profile={profile}
        saveStatus={saveStatus}
      />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {section === "dashboard" && (
          <Dashboard dayLog={dayLog} profile={profile} onNavigate={s => setSection(s as SectionId)} />
        )}
        {section === "food" && (
          <FoodLog dayLog={dayLog} foodItems={foodItems} onUpdate={onFoodUpdate} onMealTimeUpdate={onMealTimeUpdate} onSaveToList={onSaveToList} />
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
          <Reports dayLog={dayLog} profile={profile} onAnalysisComplete={onAnalysisComplete} bloodWork={bloodWork} alwaysAvoid={alwaysAvoid} />
        )}
      </main>
    </div>
  );
}
