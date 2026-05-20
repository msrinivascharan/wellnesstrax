"use client";
import { useState } from "react";
import type { ActivityLog, ActivitiesData, DayLog, ExerciseEntry, ExerciseSet, MealType, PrandialActivity } from "@/types";

interface Props {
  dayLog: DayLog;
  activitiesData: ActivitiesData;
  onUpdate: (activity: ActivityLog) => void;
}

const MEAL_LABELS: Record<string, string> = { breakfast: "After breakfast", lunch: "After lunch", dinner: "After dinner" };
const MEAL_ICONS: Record<string, string> = { breakfast: "☀️", lunch: "🌤️", dinner: "🌙" };

function genId() { return Math.random().toString(36).slice(2); }

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
    const defaultMin = activitiesData.daily_activities[type === "post_prandial_walks" ? "post_prandial_walk" : "soleus_pump"]?.default_duration_min ?? 10;
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

  const addedNames = new Set(activity.gym.exercises.map(e => e.name));

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Activity Log</h2>
        <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>
          Track gym, walks, and soleus pump exercises
        </p>
      </div>

      {/* ── Gym ── */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏋️</span>
            <div>
              <div className="text-sm font-semibold text-white">Gym session</div>
              <div className="text-xs" style={{ color: "#475569" }}>
                {activity.gym.did_gym
                  ? `${activity.gym.exercises.length} exercise${activity.gym.exercises.length !== 1 ? "s" : ""} logged`
                  : "Log today's gym workout"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {activity.gym.did_gym && (
              <input
                type="time"
                className="nb-input-sm"
                style={{ width: 104 }}
                value={activity.gym.started_at}
                onChange={e => onUpdate({ ...activity, gym: { ...activity.gym, started_at: e.target.value } })}
              />
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
            <div className="text-xs" style={{ color: "#475569" }}>10-min walk after meals to lower blood glucose</div>
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
    </div>
  );
}
