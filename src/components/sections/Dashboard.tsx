"use client";
import type { DayLog, UserProfile } from "@/types";

interface Props {
  dayLog: DayLog;
  profile: UserProfile;
  onNavigate: (s: string) => void;
}

function Ring({ pct, color, label, sub, icon }: { pct: number; color: string; label: string; sub: string; icon: string }) {
  const r = 28; const circ = 2 * Math.PI * r;
  const fill = circ - (pct / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-2 fade-in-up">
      <div className="relative">
        <svg width="72" height="72" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r={r} fill="none" stroke="#1a2540" strokeWidth="5" />
          <circle cx="36" cy="36" r={r} fill="none"
            stroke={color} strokeWidth="5" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={fill}
            transform="rotate(-90 36 36)"
            style={{ transition: "stroke-dashoffset 1.2s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-lg">{icon}</div>
      </div>
      <div className="text-center">
        <div className="text-sm font-semibold" style={{ color }}>{pct}%</div>
        <div className="text-xs font-medium text-white">{label}</div>
        <div className="text-xs" style={{ color: "#475569" }}>{sub}</div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color, icon }: { label: string; value: string; sub: string; color: string; icon: string }) {
  return (
    <div className="card px-4 py-3 fade-in-up">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs mb-1" style={{ color: "#475569" }}>{label}</div>
          <div className="text-xl font-bold" style={{ color }}>{value}</div>
          <div className="text-xs mt-0.5" style={{ color: "#64748b" }}>{sub}</div>
        </div>
        <div className="text-2xl opacity-60">{icon}</div>
      </div>
    </div>
  );
}

// ─── Time-aware alert helpers ────────────────────────────────────────────────

function parseScheduledHour(time: string): number | null {
  // Handles "5AM", "8AM", "9PM", "1:30 PM post lunch", etc.
  const m = time.match(/\b(\d{1,2})(?::\d{2})?\s*(AM|PM)\b/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  if (m[2].toUpperCase() === "PM" && h !== 12) h += 12;
  if (m[2].toUpperCase() === "AM" && h === 12) h = 0;
  return h;
}

/** Returns true only if the medication's scheduled time has already passed */
function isMissedByNow(scheduledTime: string): boolean {
  const hour = parseScheduledHour(scheduledTime);
  if (hour === null) return false;
  return new Date().getHours() >= hour;
}

export default function Dashboard({ dayLog, profile, onNavigate }: Props) {
  const totalFood = Object.values(dayLog.food).flat().length;
  const waterTarget = profile.daily_targets.water_ml;
  const waterPct = Math.min(100, Math.round((dayLog.water_ml / waterTarget) * 100));

  const totalMeds = dayLog.medications.length + dayLog.supplements.length;
  const takenMeds = dayLog.medications.filter(m => m.taken).length + dayLog.supplements.filter(s => s.taken).length;
  const medsPct = totalMeds > 0 ? Math.round((takenMeds / totalMeds) * 100) : 0;

  const gymDone = dayLog.activity.gym.did_gym;
  const walks = dayLog.activity.post_prandial_walks.length;
  const soleus = dayLog.activity.soleus_pumps.length;
  const activityPct = Math.min(100, (gymDone ? 50 : 0) + Math.min(50, (walks / 3) * 50));

  const sleepH = dayLog.sleep.hours;
  const sleepPct = sleepH >= 7 ? 100 : sleepH > 0 ? Math.round((sleepH / 7) * 100) : 0;
  const foodPct = Math.min(100, Math.round((totalFood / 6) * 100));

  // Critical alerts from medications
  const missedCritical = dayLog.medications.filter(
    m => !m.taken && m.scheduled_time && isMissedByNow(m.scheduled_time)
  );
  function ringColor(p: number) {
    return p >= 75 ? "#22c55e" : p >= 40 ? "#f59e0b" : "#ef4444";
  }

  // Only treat analysis as valid if it's in the new format (has overall_score + nutrition)
  const hasAnalysis =
    !!dayLog.analysis &&
    typeof dayLog.analysis.overall_score === "number" &&
    dayLog.analysis.nutrition != null;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"},{" "}
          <span style={{ color: "#14b8a6" }}>{profile.display_name}</span>!
        </h1>
        <p className="text-sm mt-1" style={{ color: "#64748b" }}>
          {dayLog.day} · {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          {" · "}BMI {profile.bmi} · {profile.weight_kg}kg
        </p>
      </div>

      {/* Completion rings */}
      <div className="card p-5">
        <div className="section-header mb-4">Today&apos;s completion</div>
        <div className="grid grid-cols-5 gap-4">
          <button onClick={() => onNavigate("food")} className="hover:opacity-80 transition-opacity">
            <Ring pct={foodPct} color={ringColor(foodPct)} label="Food" sub={`${totalFood} items`} icon="🍽️" />
          </button>
          <button onClick={() => onNavigate("water-sleep")} className="hover:opacity-80 transition-opacity">
            <Ring pct={waterPct} color={ringColor(waterPct)} label="Water" sub={`${dayLog.water_ml}ml`} icon="💧" />
          </button>
          <button onClick={() => onNavigate("medications")} className="hover:opacity-80 transition-opacity">
            <Ring pct={medsPct} color={ringColor(medsPct)} label="Meds" sub={`${takenMeds}/${totalMeds} taken`} icon="💊" />
          </button>
          <button onClick={() => onNavigate("activity")} className="hover:opacity-80 transition-opacity">
            <Ring pct={activityPct} color={ringColor(activityPct)} label="Activity" sub={gymDone ? "Gym done" : `${walks} walks`} icon="🏃" />
          </button>
          <button onClick={() => onNavigate("water-sleep")} className="hover:opacity-80 transition-opacity">
            <Ring pct={sleepPct} color={ringColor(sleepPct)} label="Sleep" sub={sleepH > 0 ? `${sleepH}h` : "Not logged"} icon="😴" />
          </button>
        </div>
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Food items today" value={String(totalFood)} sub="logged across all meals" color="#14b8a6" icon="🥗" />
        <StatCard label="Water intake" value={`${dayLog.water_ml}ml`} sub={`of ${waterTarget}ml target`} color="#60a5fa" icon="💧" />
        <StatCard label="Active minutes" value={`${(gymDone ? profile.exercise.duration_min : 0) + walks * 10 + soleus * 10}`} sub="gym + walks + soleus" color="#a78bfa" icon="⏱️" />
        <StatCard label="Medications" value={`${takenMeds}/${totalMeds}`} sub="taken on schedule" color={medsPct === 100 ? "#22c55e" : "#f59e0b"} icon="💊" />
      </div>

      {/* Alerts */}
      {missedCritical.length > 0 && (
        <div className="space-y-2">
          <div className="section-header">Alerts</div>
          {missedCritical.map(m => (
            <div key={m.name} className="flex items-start gap-3 p-3 rounded-xl border border-red-900 bg-red-950/30">
              <span className="text-red-400 shrink-0 mt-0.5">⚠</span>
              <div>
                <span className="text-sm text-red-300 font-medium">{m.name} not taken</span>
                <span className="text-xs text-red-400/70 ml-2">scheduled {m.scheduled_time}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AI score if available */}
      {hasAnalysis && dayLog.analysis && (
        <div className="card p-5 border-teal-900/50" style={{ borderColor: "rgba(20,184,166,0.2)" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="section-header">Latest AI analysis</div>
            <span className="text-xs" style={{ color: "#475569" }}>
              {new Date(dayLog.analysis.analyzed_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-4xl font-bold" style={{ color: dayLog.analysis.overall_score >= 75 ? "#22c55e" : dayLog.analysis.overall_score >= 50 ? "#f59e0b" : "#ef4444" }}>
                {dayLog.analysis.overall_score}
              </div>
              <div className="text-xs" style={{ color: "#475569" }}>Overall score</div>
            </div>
            <div className="flex-1 space-y-1.5">
              {(dayLog.analysis.top_wins ?? []).slice(0, 2).map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span style={{ color: "#22c55e" }}>✓</span>
                  <span style={{ color: "#94a3b8" }}>{w}</span>
                </div>
              ))}
              {(dayLog.analysis.areas_to_improve ?? []).slice(0, 1).map((a, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span style={{ color: "#f59e0b" }}>↑</span>
                  <span style={{ color: "#94a3b8" }}>{a}</span>
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={() => onNavigate("reports")}
            className="mt-3 text-xs px-3 py-1.5 rounded-lg border transition-colors"
            style={{ borderColor: "rgba(20,184,166,0.3)", color: "#14b8a6" }}
          >
            View full report →
          </button>
        </div>
      )}

      {!hasAnalysis && (
        <div className="card p-5 text-center">
          <div className="text-2xl mb-2">📊</div>
          <div className="text-sm font-medium text-white">No analysis yet</div>
          <div className="text-xs mt-1 mb-3" style={{ color: "#64748b" }}>
            Log your meals, meds, and activity, then generate your AI insight report
          </div>
          <button
            onClick={() => onNavigate("reports")}
            className="text-xs px-4 py-2 rounded-lg font-medium transition-colors"
            style={{ background: "rgba(20,184,166,0.15)", color: "#14b8a6", border: "1px solid rgba(20,184,166,0.3)" }}
          >
            Go to Reports →
          </button>
        </div>
      )}
    </div>
  );
}
