"use client";
import type { DayLog, SleepLog, UserProfile } from "@/types";

interface Props {
  dayLog: DayLog;
  profile: UserProfile;
  onUpdate: (water: number, sleep: SleepLog) => void;
}

const SLEEP_QUALITY = ["excellent", "good", "fair", "poor"] as const;
type SleepQuality = typeof SLEEP_QUALITY[number];

const QUALITY_META: Record<SleepQuality, { label: string; color: string; icon: string }> = {
  excellent: { label: "Excellent", color: "#22c55e", icon: "🌟" },
  good:      { label: "Good",      color: "#86efac", icon: "✓" },
  fair:      { label: "Fair",      color: "#f59e0b", icon: "~" },
  poor:      { label: "Poor",      color: "#ef4444", icon: "↓" },
};

// Post-lunch dip (postprandial somnolence) — 3-level scale
const PLS_LEVELS = ["none", "controllable", "uncontrollable"] as const;
type PlsLevel = typeof PLS_LEVELS[number];

const PLS_META: Record<PlsLevel, { label: string; color: string; icon: string }> = {
  none:            { label: "None",           color: "#22c55e", icon: "😀" },
  controllable:    { label: "Controllable",   color: "#f59e0b", icon: "😐" },
  uncontrollable:  { label: "Uncontrollable", color: "#ef4444", icon: "😴" },
};

const QUICK_ADD = [250, 500, 750, 1000];

function calcHours(bedtime: string, wakeTime: string): number {
  if (!bedtime || !wakeTime) return 0;
  const [bh, bm] = bedtime.split(":").map(Number);
  const [wh, wm] = wakeTime.split(":").map(Number);
  let diffMin = (wh * 60 + wm) - (bh * 60 + bm);
  if (diffMin < 0) diffMin += 24 * 60; // crossed midnight
  return Math.round((diffMin / 60) * 10) / 10;
}

export default function WaterSleep({ dayLog, profile, onUpdate }: Props) {
  const { water_ml, sleep } = dayLog;
  const target = profile.daily_targets.water_ml;
  const waterPct = Math.min(100, (water_ml / target) * 100);

  function addWater(ml: number) {
    onUpdate(Math.min(target + 500, water_ml + ml), sleep);
  }

  function setWater(ml: number) {
    onUpdate(Math.max(0, ml), sleep);
  }

  function updateSleep(updates: Partial<SleepLog>) {
    const next = { ...sleep, ...updates };
    // Auto-calculate night hours when bedtime / wake_time change
    if (updates.bedtime !== undefined || updates.wake_time !== undefined) {
      const hours = calcHours(next.bedtime, next.wake_time);
      if (hours > 0) next.hours = hours;
    }
    // Auto-calculate nap hours when nap start / end change
    if (updates.nap_start !== undefined || updates.nap_end !== undefined) {
      if (next.nap_start && next.nap_end) {
        const napH = calcHours(next.nap_start, next.nap_end);
        if (napH > 0) next.nap_hours = napH;
      }
    }
    onUpdate(water_ml, next);
  }

  const waterColor = waterPct >= 80 ? "#22c55e" : waterPct >= 50 ? "#60a5fa" : "#f59e0b";
  const sleepColor = sleep.hours >= 7 ? "#22c55e" : sleep.hours >= 6 ? "#f59e0b" : "#ef4444";

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Water & Sleep</h2>
        <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>Track hydration and rest quality</p>
      </div>

      {/* ── Water ── */}
      <div className="card p-5 space-y-5">
        <div className="flex items-center gap-2">
          <span className="text-xl">💧</span>
          <div>
            <div className="text-sm font-semibold text-white">Water intake</div>
            <div className="text-xs" style={{ color: "#475569" }}>Target: {target}ml per day</div>
          </div>
        </div>

        {/* Visual fill bar */}
        <div>
          <div className="flex justify-between text-xs mb-2">
            <span style={{ color: "#64748b" }}>{water_ml}ml consumed</span>
            <span style={{ color: waterColor, fontWeight: 600 }}>{Math.round(waterPct)}%</span>
          </div>
          <div className="relative h-8 rounded-full overflow-hidden" style={{ background: "#0e1629", border: "1px solid var(--border)" }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${waterPct}%`, background: `linear-gradient(90deg, #1d4ed8, ${waterColor})` }}
            />
            {/* Wave label */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-white drop-shadow">{water_ml}ml / {target}ml</span>
            </div>
          </div>
        </div>

        {/* Quick add buttons */}
        <div>
          <div className="section-header mb-2">Quick add</div>
          <div className="flex gap-2">
            {QUICK_ADD.map(ml => (
              <button key={ml} onClick={() => addWater(ml)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all"
                style={{ background: "rgba(96,165,250,0.08)", color: "#93c5fd", border: "1px solid rgba(96,165,250,0.2)" }}>
                +{ml}ml
              </button>
            ))}
          </div>
        </div>

        {/* Manual input */}
        <div>
          <div className="section-header mb-2">Set exact amount</div>
          <div className="flex gap-2 items-center">
            <input
              type="number"
              min="0"
              max="6000"
              step="50"
              className="nb-input"
              style={{ maxWidth: 160 }}
              placeholder="e.g. 1500"
              value={water_ml || ""}
              onChange={e => setWater(parseInt(e.target.value) || 0)}
            />
            <span className="text-sm" style={{ color: "#64748b" }}>ml</span>
            {water_ml > 0 && (
              <button onClick={() => setWater(0)}
                className="text-xs px-3 py-2 rounded-lg transition-colors"
                style={{ color: "#475569", border: "1px solid var(--border)" }}>
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Status message */}
        <div className="text-xs font-medium"
          style={{ color: waterPct >= 100 ? "#22c55e" : waterPct >= 66 ? "#86efac" : waterPct >= 33 ? "#f59e0b" : "#ef4444" }}>
          {waterPct >= 100 ? "🎉 Target reached! Excellent hydration." :
           waterPct >= 66  ? "💧 Good — keep going!" :
           waterPct >= 33  ? "⚠ Under halfway — drink more." :
                             "🔴 Very low — hydration is critical, especially with cardiac meds."}
        </div>
      </div>

      {/* ── Sleep ── */}
      <div className="card p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">😴</span>
            <div>
              <div className="text-sm font-semibold text-white">Sleep</div>
              <div className="text-xs" style={{ color: "#475569" }}>Target: 7–8 hours</div>
            </div>
          </div>
          {sleep.hours > 0 && (
            <div className="text-right">
              <div className="text-2xl font-bold" style={{ color: sleepColor }}>{sleep.hours}h</div>
              <div className="text-xs" style={{ color: "#475569" }}>
                {sleep.hours >= 7 ? "Well rested ✓" : sleep.hours >= 6 ? "Fair" : "Short — at risk"}
              </div>
            </div>
          )}
        </div>

        {/* Bedtime + wake time */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="section-header mb-2">Bedtime</div>
            <input
              type="time"
              className="nb-input"
              value={sleep.bedtime}
              onChange={e => updateSleep({ bedtime: e.target.value })}
            />
          </div>
          <div>
            <div className="section-header mb-2">Wake time</div>
            <input
              type="time"
              className="nb-input"
              value={sleep.wake_time}
              onChange={e => updateSleep({ wake_time: e.target.value })}
            />
          </div>
        </div>

        {/* Manual hours override */}
        <div>
          <div className="section-header mb-2">Hours slept</div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              max="14"
              step="0.5"
              className="nb-input"
              style={{ maxWidth: 120 }}
              value={sleep.hours || ""}
              placeholder="e.g. 7"
              onChange={e => updateSleep({ hours: parseFloat(e.target.value) || 0 })}
            />
            <span className="text-sm" style={{ color: "#64748b" }}>hours</span>
            {sleep.bedtime && sleep.wake_time && (
              <span className="text-xs" style={{ color: "#475569" }}>
                (auto: {calcHours(sleep.bedtime, sleep.wake_time)}h)
              </span>
            )}
          </div>
        </div>

        {/* Quality selector */}
        <div>
          <div className="section-header mb-2">Sleep quality</div>
          <div className="flex gap-2">
            {SLEEP_QUALITY.map(q => {
              const m = QUALITY_META[q];
              const active = sleep.quality === q;
              return (
                <button key={q} onClick={() => updateSleep({ quality: q as SleepLog["quality"] })}
                  className="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-medium transition-all"
                  style={active
                    ? { background: `${m.color}18`, color: m.color, border: `1px solid ${m.color}45` }
                    : { background: "rgba(255,255,255,0.03)", color: "#475569", border: "1px solid var(--border)" }}>
                  <span className="text-base">{m.icon}</span>
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Daytime nap */}
        <div className="p-4 rounded-xl space-y-3"
          style={{ background: "rgba(167,139,250,0.05)", border: "1px solid rgba(167,139,250,0.15)" }}>
          <div className="flex items-center gap-2">
            <span className="text-base">😴</span>
            <div>
              <div className="text-xs font-semibold text-white">Daytime nap</div>
              <div className="text-xs" style={{ color: "#475569" }}>Afternoon rest or siesta</div>
            </div>
            {(sleep.nap_hours ?? 0) > 0 && (
              <div className="ml-auto text-right">
                <div className="text-lg font-bold tabular-nums" style={{ color: "#a78bfa" }}>{sleep.nap_hours}h</div>
              </div>
            )}
          </div>

          {/* Nap start + end times */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="section-header mb-1.5">Nap start</div>
              <input
                type="time"
                className="nb-input"
                value={sleep.nap_start ?? ""}
                onChange={e => updateSleep({ nap_start: e.target.value })}
              />
            </div>
            <div>
              <div className="section-header mb-1.5">Nap end</div>
              <input
                type="time"
                className="nb-input"
                value={sleep.nap_end ?? ""}
                onChange={e => updateSleep({ nap_end: e.target.value })}
              />
            </div>
          </div>

          {/* Nap duration — manual override, auto-filled from times */}
          <div>
            <div className="section-header mb-1.5">Nap duration</div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="4"
                step="0.5"
                className="nb-input"
                style={{ maxWidth: 100 }}
                value={sleep.nap_hours || ""}
                placeholder="0"
                onChange={e => updateSleep({ nap_hours: parseFloat(e.target.value) || 0 })}
              />
              <span className="text-sm" style={{ color: "#64748b" }}>hours</span>
              {sleep.nap_start && sleep.nap_end && (
                <span className="text-xs" style={{ color: "#475569" }}>
                  (auto: {calcHours(sleep.nap_start, sleep.nap_end)}h)
                </span>
              )}
            </div>
          </div>

          {(sleep.nap_hours ?? 0) > 0 && (
            <div className="text-xs pt-1" style={{ color: "#a78bfa", borderTop: "1px solid rgba(167,139,250,0.12)" }}>
              Total sleep today: <strong>{(sleep.hours + (sleep.nap_hours ?? 0)).toFixed(1)}h</strong>
              <span className="ml-1" style={{ color: "#64748b" }}>({sleep.hours}h night + {sleep.nap_hours}h nap)</span>
            </div>
          )}
        </div>

        {/* Post-lunch sleepiness */}
        <div className="p-4 rounded-xl space-y-3"
          style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.15)" }}>
          <div className="flex items-center gap-2">
            <span className="text-base">🍽️</span>
            <div>
              <div className="text-xs font-semibold text-white">Post-lunch dip</div>
              <div className="text-xs" style={{ color: "#475569" }}>How drowsy did you feel after lunch?</div>
            </div>
            {sleep.post_lunch_sleepiness && (
              <button
                onClick={() => updateSleep({ post_lunch_sleepiness: "" })}
                className="ml-auto text-xs transition-colors"
                style={{ color: "#475569" }}
                title="Clear">
                ✕ Clear
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {PLS_LEVELS.map(lvl => {
              const m = PLS_META[lvl];
              const active = sleep.post_lunch_sleepiness === lvl;
              return (
                <button key={lvl} onClick={() => updateSleep({ post_lunch_sleepiness: lvl })}
                  className="flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-medium transition-all"
                  style={active
                    ? { background: `${m.color}18`, color: m.color, border: `1px solid ${m.color}45` }
                    : { background: "rgba(255,255,255,0.03)", color: "#475569", border: "1px solid var(--border)" }}>
                  <span className="text-base">{m.icon}</span>
                  {m.label}
                </button>
              );
            })}
          </div>
          {sleep.post_lunch_sleepiness === "uncontrollable" && (
            <div className="text-xs" style={{ color: "#fca5a5" }}>
              Frequent uncontrollable post-lunch drowsiness can relate to meal size, refined carbs, or blood sugar swings — worth noting the pattern for your doctor.
            </div>
          )}
        </div>

        {/* Evening dip */}
        <div className="p-4 rounded-xl space-y-3"
          style={{ background: "rgba(167,139,250,0.05)", border: "1px solid rgba(167,139,250,0.15)" }}>
          <div className="flex items-center gap-2">
            <span className="text-base">🌆</span>
            <div>
              <div className="text-xs font-semibold text-white">Evening dip</div>
              <div className="text-xs" style={{ color: "#475569" }}>How drowsy / low-energy did you feel in the evening?</div>
            </div>
            {sleep.evening_dip && (
              <button
                onClick={() => updateSleep({ evening_dip: "" })}
                className="ml-auto text-xs transition-colors"
                style={{ color: "#475569" }}
                title="Clear">
                ✕ Clear
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {PLS_LEVELS.map(lvl => {
              const m = PLS_META[lvl];
              const active = sleep.evening_dip === lvl;
              return (
                <button key={lvl} onClick={() => updateSleep({ evening_dip: lvl })}
                  className="flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-medium transition-all"
                  style={active
                    ? { background: `${m.color}18`, color: m.color, border: `1px solid ${m.color}45` }
                    : { background: "rgba(255,255,255,0.03)", color: "#475569", border: "1px solid var(--border)" }}>
                  <span className="text-base">{m.icon}</span>
                  {m.label}
                </button>
              );
            })}
          </div>
          {sleep.evening_dip === "uncontrollable" && (
            <div className="text-xs" style={{ color: "#fca5a5" }}>
              Strong evening drowsiness can reflect poor sleep debt, blood-sugar swings, or medication timing — worth noting the pattern for your doctor.
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <div className="section-header mb-2">Notes (optional)</div>
          <textarea
            className="nb-input resize-none"
            rows={2}
            placeholder="e.g. woke up twice, vivid dreams, stress before bed..."
            value={sleep.notes}
            onChange={e => updateSleep({ notes: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
