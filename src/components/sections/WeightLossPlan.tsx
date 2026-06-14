"use client";
import { useState, useEffect } from "react";
import type { WeightPlan, BloodWorkData, UserProfile } from "@/types";

function genId() {
  return (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function bmiOf(weightKg: number, heightFt: number): number | null {
  if (!heightFt || heightFt <= 0 || weightKg <= 0) return null;
  const m = heightFt * 0.3048;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

interface Props {
  plan: WeightPlan;
  onUpdatePlan: (plan: WeightPlan) => void;
  checks: string[];
  onUpdateChecks: (ids: string[]) => void;
  profile: UserProfile | null;
}

export default function WeightLossPlan({ plan, onUpdatePlan, checks, onUpdateChecks, profile }: Props) {
  const [bw, setBw] = useState<BloodWorkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  // Always read the latest weight/target straight from Blood Work & Vitals
  useEffect(() => {
    fetch("/api/bloodwork")
      .then(r => r.json())
      .then((d: { data: BloodWorkData }) => setBw(d.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const target = bw?.weight_target_kg ?? null;
  const latest = (bw?.weight_readings ?? [])[0] ?? null;
  const current = latest?.weight_kg ?? null;
  const heightFt = profile?.height_ft ?? 0;
  const currentBmi = current != null ? bmiOf(current, heightFt) : null;
  const targetBmi = target != null ? bmiOf(target, heightFt) : null;
  const toGo = target != null && current != null ? Math.round((current - target) * 10) / 10 : null;

  const items = plan.checklist;
  const doneCount = items.filter(i => checks.includes(i.id)).length;
  const pct = items.length ? Math.round((doneCount / items.length) * 100) : 0;
  const ringColor = pct >= 80 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444";

  function toggle(id: string) {
    onUpdateChecks(checks.includes(id) ? checks.filter(c => c !== id) : [...checks, id]);
  }
  function addItem() {
    const label = newLabel.trim();
    if (!label) return;
    onUpdatePlan({ checklist: [...items, { id: genId(), label }] });
    setNewLabel("");
  }
  function removeItem(id: string) {
    onUpdatePlan({ checklist: items.filter(i => i.id !== id) });
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Weight Loss Plan</h2>
        <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>
          Your goal at a glance, and the daily habits that get you there
        </p>
      </div>

      {/* ── Weight snapshot (read-only — edit in Blood Work & Vitals) ── */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚖️</span>
            <span className="text-sm font-semibold text-white">Weight goal</span>
          </div>
          <span className="text-xs" style={{ color: "#475569" }}>read-only · set in Blood Work &amp; Vitals</span>
        </div>

        {loading ? (
          <div className="py-4 text-center text-sm" style={{ color: "#475569" }}>Loading…</div>
        ) : current == null && target == null ? (
          <div className="py-4 text-center space-y-1">
            <div className="text-sm font-medium text-white">No weight data yet</div>
            <div className="text-xs" style={{ color: "#475569" }}>
              Add a weight reading and a target in the <strong className="text-white">Blood Work &amp; Vitals → Weight</strong> tab.
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                <div className="text-xs" style={{ color: "#64748b" }}>Current weight</div>
                <div className="text-xl font-bold mt-0.5" style={{ color: "#5eead4" }}>
                  {current != null ? `${current} kg` : "—"}
                </div>
                <div className="text-xs mt-0.5" style={{ color: "#475569" }}>
                  {latest ? new Date(latest.test_date + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "no reading"}
                  {currentBmi != null && <> · BMI {currentBmi}</>}
                </div>
              </div>

              <div className="p-3 rounded-xl text-center" style={{ background: "rgba(20,184,166,0.06)", border: "1px solid rgba(20,184,166,0.2)" }}>
                <div className="text-xs" style={{ color: "#64748b" }}>Target weight</div>
                <div className="text-xl font-bold mt-0.5" style={{ color: "#14b8a6" }}>
                  {target != null ? `${target} kg` : "—"}
                </div>
                <div className="text-xs mt-0.5" style={{ color: "#475569" }}>
                  {target == null ? "not set" : targetBmi != null ? `BMI ${targetBmi}` : "goal"}
                </div>
              </div>

              <div className="p-3 rounded-xl text-center"
                style={{ background: toGo == null ? "rgba(255,255,255,0.03)" : toGo <= 0 ? "rgba(34,197,94,0.08)" : "rgba(245,158,11,0.08)",
                         border: `1px solid ${toGo == null ? "var(--border)" : toGo <= 0 ? "rgba(34,197,94,0.25)" : "rgba(245,158,11,0.25)"}` }}>
                <div className="text-xs" style={{ color: "#64748b" }}>To go</div>
                <div className="text-xl font-bold mt-0.5" style={{ color: toGo == null ? "#475569" : toGo <= 0 ? "#22c55e" : "#fbbf24" }}>
                  {toGo == null ? "—" : toGo === 0 ? "🎉" : `${Math.abs(toGo)} kg`}
                </div>
                <div className="text-xs mt-0.5" style={{ color: "#475569" }}>
                  {toGo == null ? "set both" : toGo === 0 ? "at target!" : toGo > 0 ? "to lose" : "to gain"}
                </div>
              </div>
            </div>

            {/* Progress toward target */}
            {target != null && current != null && latest && (() => {
              const start = (bw?.weight_readings ?? []).slice(-1)[0]?.weight_kg ?? current; // earliest logged
              const totalSpan = start - target;
              const doneSpan = start - current;
              const progress = totalSpan > 0 ? Math.max(0, Math.min(100, Math.round((doneSpan / totalSpan) * 100))) : (current <= target ? 100 : 0);
              if (totalSpan <= 0) return null;
              return (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span style={{ color: "#475569" }}>Progress from {start} kg → {target} kg</span>
                    <span style={{ color: "#14b8a6", fontWeight: 600 }}>{progress}%</span>
                  </div>
                  <div className="rounded-full overflow-hidden" style={{ height: 7, background: "rgba(255,255,255,0.06)" }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progress}%`, background: "#14b8a6" }} />
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>

      {/* ── Daily habits checklist ── */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-lg">✅</span>
            <div>
              <div className="text-sm font-semibold text-white">Today&apos;s habits</div>
              <div className="text-xs" style={{ color: "#475569" }}>Tick the weight-loss practices you stuck to today</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {items.length > 0 && (
              <div className="text-right">
                <div className="text-sm font-bold" style={{ color: ringColor }}>{doneCount}/{items.length}</div>
                <div className="text-xs" style={{ color: "#475569" }}>{pct}% today</div>
              </div>
            )}
            <button onClick={() => setEditMode(e => !e)}
              className="text-xs px-3 py-1.5 rounded-lg transition-all"
              style={editMode
                ? { background: "rgba(20,184,166,0.15)", color: "#14b8a6", border: "1px solid rgba(20,184,166,0.35)" }
                : { background: "var(--bg-input)", color: "#64748b", border: "1px solid var(--border)" }}>
              {editMode ? "✓ Done" : "⚙ Edit list"}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {items.length > 0 && !editMode && (
          <div className="rounded-full overflow-hidden" style={{ height: 6, background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: ringColor }} />
          </div>
        )}

        {/* Items */}
        {items.length === 0 ? (
          <p className="text-xs py-2" style={{ color: "#334155" }}>
            No habits yet. Click <strong style={{ color: "#64748b" }}>⚙ Edit list</strong> to add some.
          </p>
        ) : (
          <div className="space-y-1.5">
            {items.map(item => {
              const done = checks.includes(item.id);
              return (
                <div key={item.id} className="flex items-center gap-3">
                  <button
                    onClick={() => !editMode && toggle(item.id)}
                    disabled={editMode}
                    className="flex-1 flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                    style={done && !editMode
                      ? { background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)" }
                      : { background: "rgba(255,255,255,0.025)", border: "1px solid var(--border)", cursor: editMode ? "default" : "pointer" }}>
                    <span className="w-5 h-5 rounded-md flex items-center justify-center text-xs shrink-0"
                      style={done && !editMode
                        ? { background: "#22c55e", color: "#04210f" }
                        : { background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "transparent" }}>
                      ✓
                    </span>
                    <span className="text-sm" style={{ color: done && !editMode ? "#86efac" : "white" }}>{item.label}</span>
                  </button>
                  {editMode && (
                    <button onClick={() => removeItem(item.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 transition-colors"
                      style={{ color: "#475569" }}
                      onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
                      onMouseLeave={e => (e.currentTarget.style.color = "#475569")}
                      title="Remove habit">✕</button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Add item (edit mode) */}
        {editMode && (
          <div className="flex gap-2 pt-1">
            <input
              type="text"
              className="nb-input flex-1"
              placeholder='Add a habit — e.g. "10k steps", "No fried food", "Track every meal"'
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addItem()}
              autoFocus
            />
            <button onClick={addItem} disabled={!newLabel.trim()}
              className="px-4 py-2 rounded-xl text-sm font-medium shrink-0 transition-all"
              style={newLabel.trim()
                ? { background: "rgba(20,184,166,0.15)", color: "#14b8a6", border: "1px solid rgba(20,184,166,0.35)" }
                : { background: "transparent", color: "#334155", border: "1px solid var(--border)", opacity: 0.5 }}>
              + Add
            </button>
          </div>
        )}

        <div className="text-xs" style={{ color: "#1e3a5f" }}>
          The checklist is shared across days; your ticks are saved per day.
        </div>
      </div>
    </div>
  );
}
