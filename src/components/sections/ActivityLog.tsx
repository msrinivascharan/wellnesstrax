"use client";
import { useState } from "react";
import type { ActivityLog, ActivitiesData, DayLog, ExerciseEntry, ExerciseSet, MealType, PrandialActivity, BreathingLog, SportSession } from "@/types";

const BADMINTON_INTENSITY: SportSession["intensity"][] = ["light", "moderate", "intense"];
const INTENSITY_COLOR: Record<SportSession["intensity"], string> = {
  light: "#86efac", moderate: "#fbbf24", intense: "#f87171",
};

interface Props {
  dayLog: DayLog;
  activitiesData: ActivitiesData;
  onUpdate: (activity: ActivityLog) => void;
}

const MEAL_LABELS: Record<string, string> = { breakfast: "After breakfast", lunch: "After lunch", dinner: "After dinner" };
const MEAL_ICONS: Record<string, string> = { breakfast: "☀️", lunch: "🌤️", dinner: "🌙" };

function genId() { return Math.random().toString(36).slice(2); }

/** Returns formatted duration string (e.g. "1h 15m" or "45m") or null if times are invalid. */
function calcGymDuration(start: string, end?: string): string | null {
  if (!start || !end) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const totalMin = (eh * 60 + em) - (sh * 60 + sm);
  if (totalMin <= 0) return null;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ─── Set editor (inline sets × reps × weight) ─────────────────────────────────
function SetRow({
  set, onChange, onRemove,
}: {
  set: ExerciseSet;
  onChange: (s: ExerciseSet) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-xs font-bold shrink-0" style={{ color: "#475569", width: 42 }}>Set {set.set_number}</span>
      <div className="flex items-center gap-1.5">
        <input type="number" min="0" className="nb-input-sm text-center" style={{ width: 52 }}
          value={set.reps} onChange={e => onChange({ ...set, reps: parseInt(e.target.value) || 0 })} placeholder="Reps" />
        <span style={{ color: "#475569" }}>×</span>
        <input type="number" min="0" step="0.5" className="nb-input-sm text-center" style={{ width: 64 }}
          value={set.weight_kg} onChange={e => onChange({ ...set, weight_kg: parseFloat(e.target.value) || 0 })} placeholder="kg" />
        <span style={{ color: "#475569" }}>kg</span>
      </div>
      <button onClick={onRemove} className="ml-1 text-xs hover:text-red-400 transition-colors" style={{ color: "#334155" }}>✕</button>
    </div>
  );
}

// ─── Single exercise card ──────────────────────────────────────────────────────
function ExerciseCard({
  ex, onUpdate, onRemove,
}: {
  ex: ExerciseEntry;
  onUpdate: (e: ExerciseEntry) => void;
  onRemove: () => void;
}) {
  function addSet() {
    const sets = ex.sets ?? [];
    const newSet: ExerciseSet = {
      set_number: sets.length + 1,
      reps: sets[0]?.reps ?? 12,
      weight_kg: sets[0]?.weight_kg ?? 0,
    };
    onUpdate({ ...ex, sets: [...sets, newSet] });
  }
  function updateSet(idx: number, s: ExerciseSet) {
    const sets = [...(ex.sets ?? [])];
    sets[idx] = s;
    onUpdate({ ...ex, sets });
  }
  function removeSet(idx: number) {
    const sets = (ex.sets ?? []).filter((_, i) => i !== idx).map((s, i) => ({ ...s, set_number: i + 1 }));
    onUpdate({ ...ex, sets });
  }

  return (
    <div className="card p-3 space-y-2.5 fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-semibold text-white">{ex.name}</span>
          <span className="ml-2 text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--bg-input)", color: "#64748b" }}>
            {ex.type}
          </span>
        </div>
        <button onClick={onRemove} className="text-xs px-2 py-1 rounded transition-colors hover:bg-red-950/40" style={{ color: "#ef4444" }}>
          Remove
        </button>
      </div>

      {/* Cardio → duration */}
      {ex.type === "cardio" && (
        <div className="flex items-center gap-2">
          <input type="number" min="1" className="nb-input-sm text-center" style={{ width: 72 }}
            value={ex.duration_min ?? 0}
            onChange={e => onUpdate({ ...ex, duration_min: parseInt(e.target.value) || 0 })} />
          <span className="text-xs" style={{ color: "#64748b" }}>minutes</span>
        </div>
      )}

      {/* Core → sets × hold duration */}
      {ex.type === "core" && (
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <input type="number" min="1" className="nb-input-sm text-center" style={{ width: 52 }}
              value={ex.core_sets ?? 3}
              onChange={e => onUpdate({ ...ex, core_sets: parseInt(e.target.value) || 0 })} />
            <span style={{ color: "#64748b" }}>sets</span>
          </div>
          <span style={{ color: "#334155" }}>×</span>
          <div className="flex items-center gap-1.5">
            <input type="number" min="1" className="nb-input-sm text-center" style={{ width: 64 }}
              value={ex.hold_sec ?? 30}
              onChange={e => onUpdate({ ...ex, hold_sec: parseInt(e.target.value) || 0 })} />
            <span style={{ color: "#64748b" }}>sec hold</span>
          </div>
        </div>
      )}

      {/* Strength → sets × reps × weight */}
      {ex.type === "strength" && (
        <div className="space-y-1.5">
          {(ex.sets ?? []).map((s, i) => (
            <SetRow key={i} set={s} onChange={upd => updateSet(i, upd)} onRemove={() => removeSet(i)} />
          ))}
          <button onClick={addSet}
            className="text-xs px-3 py-1 rounded-lg transition-colors"
            style={{ background: "rgba(20,184,166,0.08)", color: "#14b8a6", border: "1px solid rgba(20,184,166,0.2)" }}>
            + Add set
          </button>
        </div>
      )}
    </div>
  );
}

export default function ActivityLog({ dayLog, activitiesData, onUpdate }: Props) {
  const [gymExpanded, setGymExpanded] = useState(dayLog.activity.gym.did_gym);

  const activity = dayLog.activity;

  function toggleGym(val: boolean) {
    setGymExpanded(val);
    onUpdate({ ...activity, gym: { ...activity.gym, did_gym: val } });
  }

  function addExercise(defName: string, category: string) {
    const defs = activitiesData.gym[category] ?? [];
    const def = defs.find(d => d.name === defName);
    if (!def) return;
    const alreadyAdded = activity.gym.exercises.some(e => e.name === defName);
    if (alreadyAdded) return;

    let entry: ExerciseEntry = { name: def.name, type: def.type };
    if (def.type === "cardio") {
      entry.duration_min = def.default_duration_min ?? 15;
    } else if (def.type === "core") {
      entry.core_sets = def.default_sets ?? 3;
      entry.hold_sec = def.default_duration_sec ?? 30;
    } else {
      const sets: ExerciseSet[] = Array.from({ length: def.default_sets ?? 3 }, (_, i) => ({
        set_number: i + 1,
        reps: def.default_reps ?? 12,
        weight_kg: def.default_weight_kg ?? 0,
      }));
      entry.sets = sets;
    }
    onUpdate({ ...activity, gym: { ...activity.gym, exercises: [...activity.gym.exercises, entry] } });
  }

  function updateExercise(idx: number, ex: ExerciseEntry) {
    const exs = activity.gym.exercises.map((e, i) => i === idx ? ex : e);
    onUpdate({ ...activity, gym: { ...activity.gym, exercises: exs } });
  }

  function removeExercise(idx: number) {
    onUpdate({ ...activity, gym: { ...activity.gym, exercises: activity.gym.exercises.filter((_, i) => i !== idx) } });
  }

  function togglePrandial(type: "post_prandial_walks" | "soleus_pumps", meal: MealType) {
    const arr = activity[type] as PrandialActivity[];
    const existing = arr.find(a => a.after_meal === meal);
    const defaultMin = activitiesData.daily_activities[type === "post_prandial_walks" ? "post_prandial_walk" : "soleus_pump"]?.default_duration_min ?? (type === "post_prandial_walks" ? 15 : 5);
    if (existing) {
      onUpdate({ ...activity, [type]: arr.filter(a => a.after_meal !== meal) });
    } else {
      onUpdate({ ...activity, [type]: [...arr, { after_meal: meal, duration_min: defaultMin, logged_at: new Date().toISOString() }] });
    }
  }

  function updatePrandialDuration(type: "post_prandial_walks" | "soleus_pumps", meal: MealType, min: number) {
    onUpdate({
      ...activity,
      [type]: (activity[type] as PrandialActivity[]).map(a => a.after_meal === meal ? { ...a, duration_min: min } : a),
    });
  }

  function updateBreathing(key: keyof BreathingLog, val: number) {
    onUpdate({ ...activity, breathing: { ...activity.breathing, [key]: Math.max(0, val) } });
  }

  // ── Badminton handlers ──────────────────────────────────────────────────────
  const badminton = activity.badminton ?? [];
  function addBadminton() {
    const session: SportSession = {
      duration_min: 30, intensity: "moderate", games: 0, wins: 0, losses: 0,
      logged_at: new Date().toISOString(),
    };
    onUpdate({ ...activity, badminton: [...badminton, session] });
  }
  function updateBadminton(idx: number, patch: Partial<SportSession>) {
    onUpdate({ ...activity, badminton: badminton.map((b, i) => i === idx ? { ...b, ...patch } : b) });
  }
  function removeBadminton(idx: number) {
    onUpdate({ ...activity, badminton: badminton.filter((_, i) => i !== idx) });
  }

  const addedNames = new Set(activity.gym.exercises.map(e => e.name));
  const gymDuration = calcGymDuration(activity.gym.started_at, activity.gym.ended_at);

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Activity Log</h2>
        <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>
          Track gym, walks, soleus pump, badminton, and breathing exercises
        </p>
      </div>

      {/* ── Gym ── */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-4 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏋️</span>
            <div>
              <div className="text-sm font-semibold text-white">Gym session</div>
              <div className="text-xs" style={{ color: "#475569" }}>
                {activity.gym.did_gym
                  ? `${activity.gym.exercises.length} exercise${activity.gym.exercises.length !== 1 ? "s" : ""} logged${gymDuration ? ` · ${gymDuration}` : ""}`
                  : "Log today's gym workout"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {activity.gym.did_gym && (
              <div className="flex items-center gap-3">
                {/* Gym-in time */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium" style={{ color: "#64748b" }}>In</span>
                  <input
                    type="time"
                    className="nb-input-sm"
                    style={{ width: 116 }}
                    value={activity.gym.started_at}
                    onChange={e => onUpdate({ ...activity, gym: { ...activity.gym, started_at: e.target.value } })}
                  />
                </div>
                {/* Gym-out time */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium" style={{ color: "#64748b" }}>Out</span>
                  <input
                    type="time"
                    className="nb-input-sm"
                    style={{ width: 116 }}
                    value={activity.gym.ended_at ?? ""}
                    onChange={e => onUpdate({ ...activity, gym: { ...activity.gym, ended_at: e.target.value || undefined } })}
                  />
                </div>
                {/* Duration pill */}
                {gymDuration && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: "rgba(20,184,166,0.12)", color: "#14b8a6", border: "1px solid rgba(20,184,166,0.25)" }}>
                    ⏱ {gymDuration}
                  </span>
                )}
              </div>
            )}
            <button
              onClick={() => toggleGym(!activity.gym.did_gym)}
              className="toggle-track"
              style={activity.gym.did_gym ? { background: "#0d9488" } : { background: "#1a2540" }}>
              <span className="toggle-thumb" style={{ transform: activity.gym.did_gym ? "translateX(20px)" : "translateX(0)" }} />
            </button>
          </div>
        </div>

        {activity.gym.did_gym && (
          <div className="border-t px-4 pb-4 pt-3 space-y-4" style={{ borderColor: "var(--border)" }}>
            {/* Exercise picker */}
            <div className="space-y-3">
              {Object.entries(activitiesData.gym).map(([cat, defs]) => (
                <div key={cat}>
                  <div className="section-header mb-2">{cat}</div>
                  <div className="flex flex-wrap gap-2">
                    {defs.map(def => {
                      const added = addedNames.has(def.name);
                      return (
                        <button key={def.name} onClick={() => addExercise(def.name, cat)}
                          disabled={added}
                          className={`food-chip ${added ? "selected" : ""}`}
                          style={{ cursor: added ? "default" : "pointer" }}>
                          {added && <span>✓</span>}
                          {def.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Exercise cards */}
            {activity.gym.exercises.length > 0 && (
              <div className="space-y-2.5 pt-1">
                <div className="section-header">Exercise details</div>
                {activity.gym.exercises.map((ex, i) => (
                  <ExerciseCard key={ex.name + i} ex={ex}
                    onUpdate={upd => updateExercise(i, upd)}
                    onRemove={() => removeExercise(i)} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Post-prandial walks ── */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">🚶</span>
          <div>
            <div className="text-sm font-semibold text-white">Post-prandial walks</div>
            <div className="text-xs" style={{ color: "#475569" }}>15-min walk after meals to lower blood glucose</div>
          </div>
        </div>
        {(["breakfast", "lunch", "dinner"] as MealType[]).map(meal => {
          const logged = activity.post_prandial_walks.find(a => a.after_meal === meal);
          return (
            <div key={meal} className="flex items-center justify-between py-2 px-3 rounded-xl"
              style={{ background: logged ? "rgba(20,184,166,0.06)" : "rgba(255,255,255,0.02)", border: `1px solid ${logged ? "rgba(20,184,166,0.2)" : "var(--border)"}` }}>
              <div className="flex items-center gap-2">
                <span>{MEAL_ICONS[meal]}</span>
                <span className="text-sm text-white">{MEAL_LABELS[meal]}</span>
              </div>
              <div className="flex items-center gap-2">
                {logged && (
                  <div className="flex items-center gap-1.5">
                    <input type="number" min="1" max="60" className="nb-input-sm text-center" style={{ width: 56 }}
                      value={logged.duration_min}
                      onChange={e => updatePrandialDuration("post_prandial_walks", meal, parseInt(e.target.value) || 0)} />
                    <span className="text-xs" style={{ color: "#64748b" }}>min</span>
                  </div>
                )}
                <button onClick={() => togglePrandial("post_prandial_walks", meal)}
                  className="toggle-track shrink-0"
                  style={logged ? { background: "#0d9488" } : { background: "#1a2540" }}>
                  <span className="toggle-thumb" style={{ transform: logged ? "translateX(20px)" : "translateX(0)" }} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Soleus pump ── */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">🦵</span>
          <div>
            <div className="text-sm font-semibold text-white">Soleus pump exercises</div>
            <div className="text-xs" style={{ color: "#475569" }}>Seated calf raise — activates soleus muscle, lowers blood glucose</div>
          </div>
        </div>
        {(["breakfast", "lunch", "dinner"] as MealType[]).map(meal => {
          const logged = activity.soleus_pumps.find(a => a.after_meal === meal);
          return (
            <div key={meal} className="flex items-center justify-between py-2 px-3 rounded-xl"
              style={{ background: logged ? "rgba(167,139,250,0.06)" : "rgba(255,255,255,0.02)", border: `1px solid ${logged ? "rgba(167,139,250,0.25)" : "var(--border)"}` }}>
              <div className="flex items-center gap-2">
                <span>{MEAL_ICONS[meal]}</span>
                <span className="text-sm text-white">{MEAL_LABELS[meal]}</span>
              </div>
              <div className="flex items-center gap-2">
                {logged && (
                  <div className="flex items-center gap-1.5">
                    <input type="number" min="1" max="60" className="nb-input-sm text-center" style={{ width: 56 }}
                      value={logged.duration_min}
                      onChange={e => updatePrandialDuration("soleus_pumps", meal, parseInt(e.target.value) || 0)} />
                    <span className="text-xs" style={{ color: "#64748b" }}>min</span>
                  </div>
                )}
                <button onClick={() => togglePrandial("soleus_pumps", meal)}
                  className="toggle-track shrink-0"
                  style={logged ? { background: "#7c3aed" } : { background: "#1a2540" }}>
                  <span className="toggle-thumb" style={{ transform: logged ? "translateX(20px)" : "translateX(0)" }} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Badminton ── */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏸</span>
            <div>
              <div className="text-sm font-semibold text-white">Badminton</div>
              <div className="text-xs" style={{ color: "#475569" }}>Great cardio — log each session with games played</div>
            </div>
          </div>
          <button onClick={addBadminton}
            className="text-xs px-3 py-1.5 rounded-lg transition-colors shrink-0"
            style={{ background: "rgba(20,184,166,0.1)", color: "#14b8a6", border: "1px solid rgba(20,184,166,0.3)" }}>
            + Add session
          </button>
        </div>

        {badminton.length === 0 ? (
          <p className="text-xs py-1" style={{ color: "#334155" }}>No badminton logged today.</p>
        ) : badminton.map((b, i) => (
          <div key={i} className="p-3 rounded-xl space-y-3"
            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white">Session {i + 1}</span>
                {(b.games ?? 0) > 0 && (b.wins ?? 0) + (b.losses ?? 0) > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(20,184,166,0.1)", color: "#14b8a6" }}>
                    {b.wins ?? 0}W–{b.losses ?? 0}L
                  </span>
                )}
              </div>
              <button onClick={() => removeBadminton(i)} className="text-xs" style={{ color: "#475569" }} title="Remove">✕</button>
            </div>

            {/* Duration + games + wins + losses */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Minutes", key: "duration_min" as const, val: b.duration_min, max: 240, hint: "e.g. 45" },
                { label: "Games", key: "games" as const, val: b.games ?? 0, max: 50, hint: "e.g. 6" },
                { label: "Wins", key: "wins" as const, val: b.wins ?? 0, max: 50, hint: "e.g. 4" },
                { label: "Losses", key: "losses" as const, val: b.losses ?? 0, max: 50, hint: "e.g. 2" },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs mb-1" style={{ color: "#64748b" }}>{f.label}</label>
                  <input type="number" min="0" max={f.max} className="nb-input-sm w-full text-center"
                    placeholder={f.hint}
                    value={f.val || ""}
                    onChange={e => updateBadminton(i, { [f.key]: parseInt(e.target.value) || 0 })} />
                </div>
              ))}
            </div>

            {/* Intensity */}
            <div>
              <label className="block text-xs mb-1" style={{ color: "#64748b" }}>Intensity</label>
              <div className="flex gap-1.5">
                {BADMINTON_INTENSITY.map(lvl => {
                  const active = b.intensity === lvl;
                  const color = INTENSITY_COLOR[lvl];
                  return (
                    <button key={lvl} onClick={() => updateBadminton(i, { intensity: lvl })}
                      className="flex-1 py-1.5 rounded-lg text-xs font-medium capitalize transition-all"
                      style={active
                        ? { background: `${color}1f`, color, border: `1px solid ${color}55` }
                        : { background: "rgba(255,255,255,0.03)", color: "#475569", border: "1px solid var(--border)" }}>
                      {lvl}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Breathing exercises ── */}
      <div className="card p-4 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">🫁</span>
          <div>
            <div className="text-sm font-semibold text-white">Breathing exercises</div>
            <div className="text-xs" style={{ color: "#475569" }}>Tap + to log each round as you complete it</div>
          </div>
        </div>

        {([
          {
            key: "box_4444" as keyof BreathingLog,
            label: "Box breathing (4-4-4-4)",
            pattern: "Inhale 4s · Hold 4s · Exhale 4s · Hold 4s",
            target: 5,
            targetLabel: "5–6 rounds/day",
            color: "#14b8a6",
          },
          {
            key: "long_exhale_478" as keyof BreathingLog,
            label: "Long exhale (4-7-8)",
            pattern: "Inhale 4s · Hold 7s · Exhale 8s",
            target: 2,
            targetLabel: "2 rounds/day",
            color: "#818cf8",
          },
        ]).map(ex => {
          const count = activity.breathing?.[ex.key] ?? 0;
          const pct = Math.min(100, (count / ex.target) * 100);
          const met = count >= ex.target;
          return (
            <div key={ex.key} className="p-3 rounded-xl space-y-2.5"
              style={{ background: met ? `${ex.color}0a` : "rgba(255,255,255,0.02)", border: `1px solid ${met ? `${ex.color}30` : "var(--border)"}` }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white">{ex.label}</div>
                  <div className="text-xs mt-0.5" style={{ color: "#475569" }}>{ex.pattern}</div>
                  <div className="text-xs mt-0.5" style={{ color: "#334155" }}>Target: {ex.targetLabel}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => updateBreathing(ex.key, count - 1)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-base font-bold transition-all"
                    style={{ background: "rgba(255,255,255,0.05)", color: "#64748b", border: "1px solid var(--border)" }}>
                    −
                  </button>
                  <span className="text-lg font-bold w-7 text-center tabular-nums" style={{ color: met ? ex.color : "white" }}>
                    {count}
                  </span>
                  <button
                    onClick={() => updateBreathing(ex.key, count + 1)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-base font-bold transition-all"
                    style={{ background: `${ex.color}15`, color: ex.color, border: `1px solid ${ex.color}35` }}>
                    +
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <div className="rounded-full overflow-hidden" style={{ height: 5, background: "rgba(255,255,255,0.06)" }}>
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: ex.color }} />
                </div>
                <div className="text-xs" style={{ color: met ? ex.color : "#475569" }}>
                  {met ? `✓ Target met (${count} rounds)` : `${ex.target - count} more round${ex.target - count !== 1 ? "s" : ""} to reach target`}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
