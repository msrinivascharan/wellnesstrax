"use client";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import type { DayAnalysis, DayLog, FoodEntry, FoodPreferenceItem, FoodPreferences, MealType, UserProfile, BloodWorkData } from "@/types";
import { resolveCategory, mapToBalancedPlate, checkAlwaysAvoidRules } from "@/lib/food-utils";
import ActivityTrends from "@/components/sections/ActivityTrends";

interface Props {
  dayLog: DayLog;
  profile: UserProfile;
  onAnalysisComplete: (analysis: DayAnalysis) => void;
  bloodWork?: BloodWorkData;
  alwaysAvoid?: string[];
  foodPrefs?: FoodPreferences;
}

const LOADING_MSGS = [
  "Scanning your food log...",
  "Estimating macros and micronutrients...",
  "Assessing cardiac safety...",
  "Reviewing medication adherence...",
  "Analysing inflammation balance...",
  "Building tomorrow's recommendations...",
];

// ─── Chart palette ────────────────────────────────────────────────────────────

const MEAL_COLORS: Record<MealType, string> = {
  breakfast: "#f59e0b",
  lunch:     "#22c55e",
  dinner:    "#a78bfa",
  snacks:    "#fb923c",
};

// ─── Balanced plate colour palette ───────────────────────────────────────────

const BP_COLORS: Record<string, string> = {
  "Complex Carbohydrates": "#fbbf24",
  "Lean / Plant Proteins": "#a78bfa",
  "Dietary Fiber":         "#2dd4bf",
  "Micronutrients":        "#22c55e",
  "Essential Lipids":      "#fb923c",
  "Beverages & Drinks":    "#34d399",
  "One-Pot (Mixed)":       "#f472b6",
  "Other":                 "#64748b",
};

// ─── Shared chart helpers ─────────────────────────────────────────────────────

function BarRow({
  label, value, max, color, valueSuffix = "", showValue = true,
}: {
  label: string; value: number; max: number; color: string; valueSuffix?: string; showValue?: boolean;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="text-xs shrink-0 truncate" style={{ width: 120, color: "#64748b" }}>{label}</div>
      <div className="flex-1 rounded-full overflow-hidden" style={{ height: 7, background: "rgba(255,255,255,0.06)" }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
      {showValue && (
        <div className="text-xs shrink-0 text-right" style={{ width: 80, color }}>
          {value}{valueSuffix}
          <span style={{ color: "#475569" }}>/{max}{valueSuffix}</span>
        </div>
      )}
      {!showValue && (
        <div className="text-xs shrink-0 text-right" style={{ width: 36, color }}>
          {value}
        </div>
      )}
    </div>
  );
}

// ─── Score arc ────────────────────────────────────────────────────────────────

function ScoreArc({ score, label }: { score: number; label: string }) {
  const r = 36; const circ = 2 * Math.PI * r;
  const fill = circ - (score / 100) * circ;
  const color = score >= 75 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} fill="none" stroke="#1a2540" strokeWidth="6" />
        <circle cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={fill} transform="rotate(-90 44 44)"
          style={{ transition: "stroke-dashoffset 1.2s ease" }} />
        <text x="44" y="48" textAnchor="middle" fill={color} fontSize="18" fontWeight="bold">{score}</text>
      </svg>
      <div className="text-xs text-center font-medium" style={{ color: "#94a3b8" }}>{label}</div>
    </div>
  );
}

function InsightCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="card p-4 space-y-2.5 fade-in-up">
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <span className="text-sm font-semibold text-white">{title}</span>
      </div>
      {children}
    </div>
  );
}

// ─── Meal-wise balanced plate helpers ────────────────────────────────────────

/** Aggregate food entries into balanced-plate buckets for the donut chart. */
function getBalancedPlateData(entries: FoodEntry[]): Array<{ cat: string; count: number; color: string; items: string[] }> {
  const map = new Map<string, string[]>();
  for (const e of entries) {
    const bp = mapToBalancedPlate(resolveCategory(e));
    const arr = map.get(bp) ?? [];
    arr.push(e.name);
    map.set(bp, arr);
  }
  return [...map.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([cat, items]) => ({ cat, count: items.length, color: BP_COLORS[cat] ?? "#64748b", items }));
}

/** Check a food name against the rich avoid list (enabled items only, case-insensitive substring).
 *  Tries the full avoid-item name first, then the base name with parenthetical qualifiers stripped.
 *  e.g. "White Rice" logged → matches avoid item "White Rice (Regular Use)" via the stripped base. */
function checkSimpleAvoid(foodName: string, avoidList: FoodPreferenceItem[]): string | null {
  const lc = foodName.toLowerCase().trim();
  for (const item of avoidList.filter(a => a.enabled)) {
    const full = item.name.toLowerCase().trim();
    // 1. Full name match (e.g. "Ice Cream" matches "Ice Cream")
    if (full.length >= 2 && lc.includes(full)) return item.name;
    // 2. Base name match — strip parenthetical qualifiers like "(Regular Use)", "(Excess)", "(All Forms)"
    const base = full.replace(/\s*\([^)]*\)/g, "").trim();
    if (base.length >= 3 && base !== full && lc.includes(base)) return item.name;
  }
  return null;
}

/** Score a meal against the 5 balanced plate categories (max 100 pts). */
function mealBalanceScore(entries: FoodEntry[]): { score: number; missing: string[] } {
  if (entries.length === 0) return { score: 0, missing: [] };
  const bpCats = new Set(entries.map(e => mapToBalancedPlate(resolveCategory(e))));

  const hasProtein = bpCats.has("Lean / Plant Proteins");
  const hasMicro   = bpCats.has("Micronutrients");
  const hasCarbs   = bpCats.has("Complex Carbohydrates");
  const hasFiber   = bpCats.has("Dietary Fiber");
  const hasLipids  = bpCats.has("Essential Lipids");

  let pts = 0;
  const missing: string[] = [];

  if (hasProtein) pts += 25; else missing.push("Proteins");
  if (hasMicro)   pts += 25; else missing.push("Micronutrients");
  if (hasCarbs)   pts += 20; else missing.push("Complex Carbs");
  if (hasFiber)   pts += 15; else missing.push("Dietary Fiber");
  if (hasLipids)  pts += 15; else missing.push("Essential Lipids");

  return { score: pts, missing };
}

function DonutChart({ data, size = 100 }: {
  data: Array<{ cat: string; count: number; color: string }>;
  size?: number;
}) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) {
    return (
      <div className="flex items-center justify-center rounded-full flex-shrink-0"
        style={{ width: size, height: size, background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.08)" }}>
        <span style={{ fontSize: size * 0.12, color: "#334155" }}>empty</span>
      </div>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const R  = size * 0.40;
  const ri = size * 0.24;
  let angle = -Math.PI / 2;

  const segments = data.map(d => {
    const pct = d.count / total;
    const a0  = angle;
    angle += pct * 2 * Math.PI;
    const a1    = angle;
    const large = pct > 0.5 ? 1 : 0;
    const path  = [
      `M ${cx + R  * Math.cos(a0)} ${cy + R  * Math.sin(a0)}`,
      `A ${R}  ${R}  0 ${large} 1 ${cx + R  * Math.cos(a1)} ${cy + R  * Math.sin(a1)}`,
      `L ${cx + ri * Math.cos(a1)} ${cy + ri * Math.sin(a1)}`,
      `A ${ri} ${ri} 0 ${large} 0 ${cx + ri * Math.cos(a0)} ${cy + ri * Math.sin(a0)}`,
      "Z",
    ].join(" ");
    return { path, color: d.color };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
      {segments.map((s, i) => (
        <path key={i} d={s.path} fill={s.color} stroke="#0f1729" strokeWidth="1.5" />
      ))}
      <text x={cx} y={cy - 4} textAnchor="middle" dominantBaseline="middle"
        fill="white" fontSize={Math.round(size * 0.18)} fontWeight="bold">{total}</text>
      <text x={cx} y={cy + size * 0.16} textAnchor="middle" dominantBaseline="middle"
        fill="#475569" fontSize={Math.round(size * 0.11)}>items</text>
    </svg>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function Reports({ dayLog, profile, onAnalysisComplete, bloodWork, alwaysAvoid, foodPrefs }: Props) {
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState("");
  const [backingUp, setBackingUp] = useState(false);
  const [hoveredCell, setHoveredCell] = useState<{ meal: MealType; cat: string } | null>(null);

  // ── History navigation ────────────────────────────────────────────────────
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const [viewDate, setViewDate] = useState(todayStr);
  const [availDates, setAvailDates] = useState<string[]>([]);
  const [histLog, setHistLog]       = useState<DayLog | null>(null);
  const [histLoading, setHistLoading] = useState(false);

  const isToday   = viewDate === todayStr;
  const activeLog = isToday ? dayLog : histLog;
  const analysis  = activeLog?.analysis;

  useEffect(() => {
    fetch("/api/sessions")
      .then(r => r.json())
      .then((d: { sessions?: string[] }) => setAvailDates(d.sessions ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isToday) { setHistLog(null); return; }
    setHistLoading(true);
    fetch(`/api/sessions/${viewDate}`)
      .then(r => r.ok ? r.json() : null)
      .then((d: { log?: DayLog } | null) => setHistLog(d?.log ?? null))
      .catch(() => setHistLog(null))
      .finally(() => setHistLoading(false));
  }, [viewDate, isToday]);

  function goPrev() {
    const idx = availDates.indexOf(viewDate);
    if (idx < availDates.length - 1) setViewDate(availDates[idx + 1]);
    else if (idx === -1 && availDates.length > 0) setViewDate(availDates[0]);
  }
  function goNext() {
    const idx = availDates.indexOf(viewDate);
    if (idx > 0) setViewDate(availDates[idx - 1]);
  }
  const hasPrev = (() => { const i = availDates.indexOf(viewDate); return i < availDates.length - 1 || i === -1; })();
  const hasNext = availDates.indexOf(viewDate) > 0;

  // ── AI analysis ───────────────────────────────────────────────────────────
  async function runAnalysis() {
    setLoading(true);
    setError("");
    let i = 0;
    const ticker = setInterval(() => {
      if (i < LOADING_MSGS.length) { setLoadingMsg(LOADING_MSGS[i]); i++; }
    }, 2800);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ log: dayLog }),
      });
      const data = await res.json() as { analysis?: DayAnalysis; error?: string };
      if (data.error) { setError(data.error); }
      else if (data.analysis) { onAnalysisComplete(data.analysis); }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      clearInterval(ticker);
      setLoading(false);
      setLoadingMsg("");
    }
  }

  // ── Backup download ───────────────────────────────────────────────────────
  async function downloadBackup() {
    setBackingUp(true);
    try {
      const res = await fetch("/api/backup");
      if (!res.ok) throw new Error("Backup request failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wellnesstrax-backup-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silently ignore — backup is non-critical
    } finally {
      setBackingUp(false);
    }
  }

  // ── Chart data computations (uses activeLog so history works) ────────────
  const totalFood  = Object.values(activeLog?.food ?? dayLog.food).flat().length;
  const takenMeds  = (activeLog?.medications ?? dayLog.medications).filter(m => m.taken).length;
  const logForChart = activeLog ?? dayLog;

  const gymDone    = logForChart.activity.gym.did_gym;
  const walksDone  = logForChart.activity.post_prandial_walks.length;
  const soleusDone = logForChart.activity.soleus_pumps.length;

  return (
    <div className="p-6 max-w-4xl space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">AI Health Report</h2>
          <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>
            Powered by Groq LLaMA 3.3-70B · {dayLog.day}, {dayLog.date}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Backup button — today only */}
          {isToday && (
            <button
              onClick={downloadBackup}
              disabled={backingUp}
              title="Download all data as JSON backup"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
              style={backingUp
                ? { background: "rgba(255,255,255,0.04)", color: "#475569", border: "1px solid var(--border)", cursor: "not-allowed" }
                : { background: "rgba(255,255,255,0.04)", color: "#94a3b8", border: "1px solid var(--border)" }}>
              {backingUp ? (
                <><span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /></>
              ) : "📦 Backup"}
            </button>
          )}

          {/* Analyse button — today only */}
          {isToday && (
            <button
              onClick={runAnalysis}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={loading
                ? { background: "rgba(20,184,166,0.08)", color: "#475569", border: "1px solid var(--border)", cursor: "not-allowed" }
                : { background: "rgba(20,184,166,0.15)", color: "#14b8a6", border: "1px solid rgba(20,184,166,0.35)" }}>
              {loading ? (
                <><span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /> Analysing</>
              ) : (
                <>🔬 {analysis ? "Re-analyse" : "Generate analysis"}</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ── Date navigation bar ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 p-3 rounded-2xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
        <button onClick={goPrev} disabled={!hasPrev}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-all"
          style={hasPrev
            ? { background: "rgba(255,255,255,0.06)", color: "#94a3b8", border: "1px solid var(--border)" }
            : { background: "transparent", color: "#1e3a5f", border: "1px solid transparent", cursor: "not-allowed" }}>
          ←
        </button>

        <div className="flex-1 text-center">
          {isToday ? (
            <span className="text-sm font-semibold text-white">Today — {format(new Date(todayStr + "T12:00:00"), "EEEE, dd MMM yyyy")}</span>
          ) : (
            <span className="text-sm font-semibold" style={{ color: "#f59e0b" }}>
              {histLoading ? "Loading…" : viewDate
                ? format(new Date(viewDate + "T12:00:00"), "EEEE, dd MMM yyyy")
                : "Pick a date"}
            </span>
          )}
        </div>

        <button onClick={goNext} disabled={!hasNext}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-all"
          style={hasNext
            ? { background: "rgba(255,255,255,0.06)", color: "#94a3b8", border: "1px solid var(--border)" }
            : { background: "transparent", color: "#1e3a5f", border: "1px solid transparent", cursor: "not-allowed" }}>
          →
        </button>

        <input
          type="date"
          max={todayStr}
          value={viewDate}
          onChange={e => e.target.value && setViewDate(e.target.value)}
          title="Pick any date"
          className="nb-input-sm"
          style={{ width: 36, padding: "4px", cursor: "pointer", color: "transparent", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}
        />
        <span className="text-xs" style={{ color: "#334155", marginLeft: -24 }}>📅</span>

        {!isToday && (
          <button onClick={() => setViewDate(todayStr)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{ background: "rgba(20,184,166,0.12)", color: "#14b8a6", border: "1px solid rgba(20,184,166,0.3)" }}>
            Today
          </button>
        )}
      </div>

      {/* ── Loading ─────────────────────────────────────────────────────────── */}
      {loading && (
        <div className="card p-6 text-center space-y-3 fade-in-up">
          <div className="text-3xl spin-slow inline-block">🧬</div>
          <div className="text-sm font-medium text-white">{loadingMsg}</div>
          <div className="flex justify-center gap-1.5 mt-1">
            {LOADING_MSGS.map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full" style={{
                background: LOADING_MSGS.indexOf(loadingMsg) >= i ? "#14b8a6" : "#1a2540"
              }} />
            ))}
          </div>
        </div>
      )}

      {/* ── Error ───────────────────────────────────────────────────────────── */}
      {error && !loading && (
        <div className="card p-4 fade-in-up" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)" }}>
          <div className="flex items-start gap-2">
            <span className="text-red-400 mt-0.5">⚠</span>
            <div>
              <div className="text-sm font-medium text-red-300">Analysis failed</div>
              <div className="text-xs mt-1" style={{ color: "#f87171" }}>{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── History: no data for selected date ───────────────────────────────── */}
      {!isToday && !histLoading && !histLog && (
        <div className="card p-8 text-center space-y-3">
          <div className="text-3xl">📭</div>
          <div className="text-base font-semibold text-white">No data for this date</div>
          <div className="text-sm" style={{ color: "#64748b" }}>Nothing was logged on {viewDate}.</div>
          <button onClick={() => setViewDate(todayStr)}
            className="mt-2 px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: "rgba(20,184,166,0.12)", color: "#14b8a6", border: "1px solid rgba(20,184,166,0.3)" }}>
            ← Back to today
          </button>
        </div>
      )}

      {/* ── No analysis prompt (today only) ─────────────────────────────────── */}
      {isToday && !analysis && !loading && (
        <div className="card p-8 text-center space-y-4">
          <div className="text-4xl">📊</div>
          <div>
            <div className="text-base font-semibold text-white">Ready when you are</div>
            <div className="text-sm mt-1.5" style={{ color: "#64748b" }}>
              You have <strong className="text-white">{totalFood}</strong> food items and{" "}
              <strong className="text-white">{takenMeds}/{dayLog.medications.length}</strong> medications logged today.

            </div>
            <div className="text-xs mt-2" style={{ color: "#475569" }}>
              Log your meals, medications, activity, water, and sleep, then hit Generate.
            </div>
          </div>
        </div>
      )}

      {/* ── History: no analysis run ─────────────────────────────────────────── */}
      {!isToday && histLog && !analysis && !histLoading && (
        <div className="card p-6 text-center space-y-2" style={{ border: "1px solid rgba(245,158,11,0.2)", background: "rgba(245,158,11,0.04)" }}>
          <div className="text-2xl">📋</div>
          <div className="text-sm font-medium text-white">Data logged but no AI analysis was run</div>
          <div className="text-xs" style={{ color: "#64748b" }}>
            {totalFood} food items · {takenMeds} meds taken
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TODAY'S DATA SNAPSHOT — always visible
         ══════════════════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        <div className="section-header">Today&apos;s data snapshot</div>

        {/* Meal-wise plate balance */}
        <div className="card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <span>🥗</span>
            <span className="text-sm font-semibold text-white">Meal-wise plate balance</span>
            <span className="ml-auto text-xs" style={{ color: "#475569" }}>
              vs. cardiac-safe plate standard
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {(["breakfast", "lunch", "dinner", "snacks"] as MealType[]).map(meal => {
              const entries   = logForChart.food[meal] ?? [];
              const catData   = getBalancedPlateData(entries);
              const isEmpty   = entries.length === 0;
              const { score, missing } = mealBalanceScore(entries);
              // Flags from complex food_rules (alwaysAvoid)
              const rulesFlags = alwaysAvoid && entries.length > 0
                ? entries
                    .map(e => ({ name: e.name, rule: checkAlwaysAvoidRules(e.name, alwaysAvoid), source: "rules" as const }))
                    .filter(f => f.rule !== null)
                : [];
              // Flags from user's simple avoid list (foodPrefs.avoid)
              const simpleFlags = foodPrefs?.avoid?.length && entries.length > 0
                ? entries
                    .map(e => ({ name: e.name, rule: checkSimpleAvoid(e.name, foodPrefs.avoid), source: "prefs" as const }))
                    .filter(f => f.rule !== null && !rulesFlags.some(r => r.name === f.name))
                : [];
              const avoidFlags = [...rulesFlags, ...simpleFlags];

              const scoreColor = isEmpty    ? "#334155"
                : score >= 80 ? "#22c55e"
                : score >= 60 ? "#14b8a6"
                : score >= 35 ? "#f59e0b"
                : "#ef4444";
              const scoreLabel = isEmpty    ? "Not logged"
                : score >= 80 ? "Excellent"
                : score >= 60 ? "Good"
                : score >= 35 ? "Needs work"
                : "Unbalanced";

              return (
                <div key={meal} className="p-3 rounded-2xl space-y-3"
                  style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>

                  {/* Meal header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0 inline-block"
                        style={{ background: MEAL_COLORS[meal] }} />
                      <span className="text-xs font-semibold text-white capitalize">{meal}</span>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: `${scoreColor}20`, color: scoreColor }}>
                      {scoreLabel}
                    </span>
                  </div>

                  {/* Donut chart + category legend */}
                  <div className="flex items-center gap-3">
                    <DonutChart data={catData} size={100} />
                    <div className="flex-1 space-y-1.5 min-w-0">
                      {catData.length === 0 ? (
                        <p className="text-xs" style={{ color: "#334155" }}>Nothing logged yet</p>
                      ) : catData.slice(0, 5).map(d => (
                        <div key={d.cat}
                          className="flex items-center gap-1.5 min-w-0 cursor-pointer rounded px-1 -mx-1 transition-colors"
                          style={hoveredCell?.meal === meal && hoveredCell.cat === d.cat
                            ? { background: `${d.color}14` }
                            : undefined}
                          onMouseEnter={() => setHoveredCell({ meal, cat: d.cat })}
                          onMouseLeave={() => setHoveredCell(null)}>
                          <span className="w-1.5 h-1.5 rounded-full shrink-0 inline-block"
                            style={{ background: d.color }} />
                          <span className="text-xs truncate" style={{ color: "#94a3b8" }}>{d.cat}</span>
                          <span className="text-xs ml-auto shrink-0 tabular-nums" style={{ color: d.color }}>
                            {d.count}
                          </span>
                        </div>
                      ))}
                      {catData.length > 5 && (
                        <div className="text-xs" style={{ color: "#334155" }}>+{catData.length - 5} more</div>
                      )}
                    </div>
                  </div>

                  {/* Hover: item breakdown for the hovered category */}
                  {hoveredCell?.meal === meal && (() => {
                    const hd = catData.find(d => d.cat === hoveredCell.cat);
                    if (!hd) return null;
                    return (
                      <div className="px-2 py-2 rounded-lg text-xs space-y-1.5 fade-in-up"
                        style={{ background: `${hd.color}10`, border: `1px solid ${hd.color}28` }}>
                        <div className="font-semibold" style={{ color: hd.color }}>
                          {hd.cat} — {hd.count} item{hd.count !== 1 ? "s" : ""}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {hd.items.map(name => {
                            const isAvoid = avoidFlags.some(f => f.name === name);
                            return (
                              <span key={name}
                                className="px-1.5 py-0.5 rounded text-xs"
                                style={isAvoid
                                  ? { background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }
                                  : { background: "rgba(255,255,255,0.05)", color: "#94a3b8" }}>
                                {isAvoid && "⚠ "}{name}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Balance score bar */}
                  {!isEmpty && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs" style={{ color: "#475569" }}>Balance score</span>
                        <span className="text-xs font-semibold" style={{ color: scoreColor }}>{score}%</span>
                      </div>
                      <div className="rounded-full overflow-hidden"
                        style={{ height: 5, background: "rgba(255,255,255,0.06)" }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${score}%`, background: scoreColor }} />
                      </div>
                    </div>
                  )}

                  {/* Missing food groups */}
                  {!isEmpty && missing.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-xs" style={{ color: "#475569" }}>Add to balance:</div>
                      <div className="flex flex-wrap gap-1">
                        {missing.map(m => (
                          <span key={m} className="text-xs px-1.5 py-0.5 rounded-md"
                            style={{ background: "rgba(239,68,68,0.1)", color: "#f87171" }}>
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Full balance celebration */}
                  {!isEmpty && missing.length === 0 && avoidFlags.length === 0 && (
                    <div className="text-xs px-2 py-1 rounded-lg"
                      style={{ background: "rgba(34,197,94,0.08)", color: "#86efac" }}>
                      ✓ Well-balanced plate
                    </div>
                  )}

                  {/* Avoid violations (rules + simple list) */}
                  {avoidFlags.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-xs font-semibold" style={{ color: "#ef4444" }}>⚠ Avoid list:</div>
                      {avoidFlags.map(f => (
                        <div key={f.name} className="p-1.5 rounded-lg space-y-0.5"
                          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                          <div className="text-xs font-semibold" style={{ color: "#f87171" }}>✕ {f.name}</div>
                          <div className="text-xs" style={{ color: "#94a3b8" }}>
                            {f.source === "prefs" ? "In your Must Avoid list" : f.rule}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Next-day suggestions — only after analysis */}
                  {(() => {
                    const suggestions = analysis?.next_day_meal_suggestions?.[meal];
                    if (!suggestions || suggestions.length === 0) return null;
                    return (
                      <div className="pt-1 border-t space-y-1.5"
                        style={{ borderColor: "rgba(20,184,166,0.12)" }}>
                        <div className="text-xs font-medium" style={{ color: "#14b8a6" }}>
                          🌱 Try tomorrow
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {suggestions.map(item => (
                            <span key={item} className="text-xs px-2 py-0.5 rounded-full"
                              style={{ background: "rgba(20,184,166,0.08)", color: "#2dd4bf", border: "1px solid rgba(20,184,166,0.18)" }}>
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>

        {/* Row 2: Hydration + Activity */}
        <div className="grid grid-cols-2 gap-4">
          {/* Hydration */}
          <div className="card p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <span>💧</span>
              <span className="text-sm font-semibold text-white">Hydration</span>
            </div>
            <BarRow
              label="Water intake"
              value={logForChart.water_ml}
              max={profile.daily_targets.water_ml}
              color="#60a5fa"
              valueSuffix="ml"
            />
            <div className="text-xs" style={{ color: "#475569" }}>
              {logForChart.water_ml >= profile.daily_targets.water_ml
                ? "✓ Daily target reached!"
                : `${profile.daily_targets.water_ml - logForChart.water_ml}ml remaining to hit target`}
            </div>
          </div>

          {/* Activity */}
          <div className="card p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <span>🏃</span>
              <span className="text-sm font-semibold text-white">Activity summary</span>
            </div>
            <div className="space-y-2">
              {/* Gym */}
              <div className="flex items-center gap-3">
                <div className="text-xs shrink-0" style={{ width: 120, color: "#64748b" }}>Gym session</div>
                <div className={`text-xs font-semibold px-2 py-0.5 rounded-full ${gymDone ? "bg-green-900/40 text-green-400" : "bg-slate-800 text-slate-500"}`}>
                  {gymDone ? "✓ Done" : "Not logged"}
                </div>
              </div>
              {/* Walks */}
              <BarRow
                label="Post-meal walks"
                value={walksDone}
                max={3}
                color="#14b8a6"
                valueSuffix=" / 3"
                showValue={false}
              />
              <div className="text-xs -mt-1" style={{ color: "#475569" }}>
                {walksDone} of 3 meals walked
              </div>
              {/* Soleus */}
              <BarRow
                label="Soleus pumps"
                value={soleusDone}
                max={3}
                color="#818cf8"
                valueSuffix=" / 3"
                showValue={false}
              />
              <div className="text-xs -mt-1" style={{ color: "#475569" }}>
                {soleusDone} of 3 sessions done
              </div>
            </div>
          </div>
        </div>

        {/* Row 3: Macro bars — only when analysis exists */}
        {analysis && (
          <div className="card p-4 space-y-3 fade-in-up">
            <div className="flex items-center gap-2 mb-1">
              <span>📐</span>
              <span className="text-sm font-semibold text-white">Macro targets</span>
              <span className="text-xs ml-auto" style={{ color: "#475569" }}>estimated vs daily target</span>
            </div>
            <BarRow
              label="Calories"
              value={analysis.nutrition.estimated_calories}
              max={profile.daily_targets.calories}
              color="#fb923c"
              valueSuffix=" kcal"
            />
            <BarRow
              label="Protein"
              value={analysis.nutrition.estimated_protein_g}
              max={profile.daily_targets.protein_g}
              color="#a78bfa"
              valueSuffix="g"
            />
            <BarRow
              label="Fiber"
              value={analysis.nutrition.estimated_fiber_g}
              max={profile.daily_targets.fiber_g}
              color="#86efac"
              valueSuffix="g"
            />
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          ACTIVITY TRENDS & INSIGHTS — charts always; AI text after Re-analyse
         ══════════════════════════════════════════════════════════════════════ */}
      <ActivityTrends trendAnalysis={analysis?.activity_trend_analysis} breathingAnalysis={analysis?.breathing_trend_analysis} todayNote={analysis?.activity_note} />

      {/* ══════════════════════════════════════════════════════════════════════
          AI ANALYSIS RESULTS — only when analysis exists
         ══════════════════════════════════════════════════════════════════════ */}
      {analysis && !loading && (
        <div className="space-y-5 fade-in-up">
          <div className="section-header">AI analysis results</div>

          {/* Overall score */}
          <div className="card p-5">
            <div className="flex items-center gap-6">
              <ScoreArc score={analysis.overall_score} label="Overall score" />
              <div className="flex-1 space-y-2">
                <div className="text-sm font-semibold text-white">Today&apos;s health score</div>
                <p className="text-xs" style={{ color: "#94a3b8" }}>{analysis.nutrition.assessment}</p>
                <div className="text-xs" style={{ color: "#475569" }}>
                  Analysed at {new Date(analysis.analyzed_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          </div>

          {/* Top wins + improve */}
          <div className="grid grid-cols-2 gap-4">
            <InsightCard title="Top wins" icon="🏆">
              <div className="space-y-1.5">
                {analysis.top_wins.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="shrink-0" style={{ color: "#22c55e" }}>✓</span>
                    <span style={{ color: "#94a3b8" }}>{w}</span>
                  </div>
                ))}
              </div>
            </InsightCard>
            <InsightCard title="Areas to improve" icon="📈">
              <div className="space-y-1.5">
                {analysis.areas_to_improve.map((a, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span style={{ color: "#f59e0b" }}>↑</span>
                    <span style={{ color: "#94a3b8" }}>{a}</span>
                  </div>
                ))}
              </div>
            </InsightCard>
          </div>

          {/* Cardiac safety — highest priority */}
          <div className="card p-4 space-y-2" style={{ border: "1px solid rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.04)" }}>
            <div className="flex items-center gap-2">
              <span>❤️</span>
              <span className="text-sm font-semibold text-red-300">Cardiac Safety</span>
            </div>
            <p className="text-xs" style={{ color: "#fca5a5" }}>{analysis.cardiac_safety_note}</p>
          </div>

          {/* Nutrition card */}
          <InsightCard title="Nutrition" icon="🍽️">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Est. Calories", val: `${analysis.nutrition.estimated_calories} kcal`, target: `target ${profile.daily_targets.calories}`, color: "#fb923c" },
                { label: "Protein", val: `${analysis.nutrition.estimated_protein_g}g`, target: `target ${profile.daily_targets.protein_g}g`, color: "#a78bfa" },
                { label: "Fiber", val: `${analysis.nutrition.estimated_fiber_g}g`, target: `target ${profile.daily_targets.fiber_g}g`, color: "#86efac" },
              ].map(n => (
                <div key={n.label} className="p-2.5 rounded-xl text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                  <div className="text-base font-bold" style={{ color: n.color }}>{n.val}</div>
                  <div className="text-xs mt-0.5 text-white">{n.label}</div>
                  <div className="text-xs" style={{ color: "#475569" }}>{n.target}</div>
                </div>
              ))}
            </div>
            {analysis.nutrition.highlights.length > 0 && (
              <div className="space-y-1 mt-1">
                {analysis.nutrition.highlights.map((h, i) => (
                  <div key={i} className="text-xs flex gap-1.5"><span style={{ color: "#22c55e" }}>+</span><span style={{ color: "#94a3b8" }}>{h}</span></div>
                ))}
              </div>
            )}
            {analysis.nutrition.concerns.length > 0 && (
              <div className="space-y-1">
                {analysis.nutrition.concerns.map((c, i) => (
                  <div key={i} className="text-xs flex gap-1.5"><span style={{ color: "#f59e0b" }}>⚠</span><span style={{ color: "#94a3b8" }}>{c}</span></div>
                ))}
              </div>
            )}
          </InsightCard>

          {/* 2-column row: Water, Sleep (Activity now has its own trends section above) */}
          <div className="grid grid-cols-2 gap-4">
            <InsightCard title="Hydration" icon="💧">
              <p className="text-xs" style={{ color: "#94a3b8" }}>{analysis.water_note}</p>
            </InsightCard>
            <InsightCard title="Sleep" icon="😴">
              <p className="text-xs" style={{ color: "#94a3b8" }}>{analysis.sleep_note}</p>
            </InsightCard>
          </div>

          {/* Medication adherence */}
          <InsightCard title="Medication adherence" icon="💊">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold"
                  style={{ color: analysis.medication_adherence.score === 100 ? "#22c55e" : analysis.medication_adherence.score >= 60 ? "#f59e0b" : "#ef4444" }}>
                  {analysis.medication_adherence.score}%
                </div>
                <div className="text-xs" style={{ color: "#475569" }}>Adherence</div>
              </div>
              <div className="flex-1 text-xs" style={{ color: "#94a3b8" }}>
                {analysis.medication_adherence.notes}
                {analysis.medication_adherence.missed.length > 0 && (
                  <div className="mt-1 text-red-400">
                    Missed: {analysis.medication_adherence.missed.join(", ")}
                  </div>
                )}
              </div>
            </div>
          </InsightCard>

          {/* Inflammation */}
          <InsightCard title="Inflammation balance" icon="🔥">
            <p className="text-xs" style={{ color: "#94a3b8" }}>{analysis.inflammation_note}</p>
          </InsightCard>

          {/* ── Blood work snapshot (if data exists) ── */}
          {bloodWork && (bloodWork.lipid_profile.length > 0 || bloodWork.thyroid_profile.length > 0) && (
            <InsightCard title="Latest blood work" icon="🩸">
              <p className="text-xs mb-3" style={{ color: "#64748b" }}>
                Most recent lab results vs. cardiac-patient targets. Go to Blood Work section to add new results.
              </p>
              {bloodWork.lipid_profile.length > 0 && (() => {
                const latest = bloodWork.lipid_profile[0];
                type LipidKey = "total_cholesterol" | "hdl" | "ldl" | "triglycerides" | "chol_hdl_ratio";
                const ranges: Record<LipidKey, { label: string; good: (v: number) => boolean; warn: (v: number) => boolean }> = {
                  total_cholesterol: { label: "Total Chol", good: v => v < 150, warn: v => v <= 200 },
                  hdl:               { label: "HDL",        good: v => v >= 60,  warn: v => v >= 40  },
                  ldl:               { label: "LDL",        good: v => v < 70,   warn: v => v <= 100 },
                  triglycerides:     { label: "Triglyc.",   good: v => v < 100,  warn: v => v <= 150 },
                  chol_hdl_ratio:    { label: "Chol/HDL",   good: v => v < 3.5,  warn: v => v <= 5.0 },
                };
                return (
                  <div className="mb-3">
                    <div className="text-xs font-semibold mb-2" style={{ color: "#94a3b8" }}>
                      Lipid panel · {new Date(latest.test_date + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(Object.keys(ranges) as LipidKey[]).map(k => {
                        const v = latest[k] as number;
                        const s = ranges[k].good(v) ? "good" : ranges[k].warn(v) ? "warn" : "risk";
                        const c = s === "good" ? "#22c55e" : s === "warn" ? "#f59e0b" : "#ef4444";
                        return (
                          <div key={k} className="text-center px-2 py-1.5 rounded-lg" style={{ background: `${c}10`, border: `1px solid ${c}25`, minWidth: 68 }}>
                            <div className="text-xs" style={{ color: "#64748b" }}>{ranges[k].label}</div>
                            <div className="text-sm font-bold" style={{ color: c }}>{v}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              {bloodWork.thyroid_profile.length > 0 && (() => {
                const latest = bloodWork.thyroid_profile[0];
                type ThyKey = "t3_ng_ml" | "t4_ug_dl" | "tsh_uiu_ml";
                const ranges: Record<ThyKey, { label: string; unit: string; good: (v: number) => boolean; warn: (v: number) => boolean }> = {
                  t3_ng_ml:    { label: "T3",  unit: "ng/mL",  good: v => v >= 0.8 && v <= 2.0, warn: v => v >= 0.6 && v <= 2.5 },
                  t4_ug_dl:    { label: "T4",  unit: "μg/dL",  good: v => v >= 5.1 && v <= 14.1, warn: v => v >= 3.0 && v <= 16.0 },
                  tsh_uiu_ml:  { label: "TSH", unit: "μIU/mL", good: v => v >= 0.5 && v <= 2.5, warn: v => v >= 0.3 && v <= 4.0 },
                };
                return (
                  <div>
                    <div className="text-xs font-semibold mb-2" style={{ color: "#94a3b8" }}>
                      Thyroid panel · {new Date(latest.test_date + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </div>
                    <div className="flex gap-2">
                      {(Object.keys(ranges) as ThyKey[]).map(k => {
                        const v = latest[k] as number;
                        const s = ranges[k].good(v) ? "good" : ranges[k].warn(v) ? "warn" : "risk";
                        const c = s === "good" ? "#22c55e" : s === "warn" ? "#f59e0b" : "#ef4444";
                        return (
                          <div key={k} className="flex-1 text-center px-2 py-1.5 rounded-lg" style={{ background: `${c}10`, border: `1px solid ${c}25` }}>
                            <div className="text-xs" style={{ color: "#64748b" }}>{ranges[k].label}</div>
                            <div className="text-sm font-bold" style={{ color: c }}>{v}</div>
                            <div className="text-xs" style={{ color: "#334155" }}>{ranges[k].unit}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </InsightCard>
          )}
        </div>
      )}
    </div>
  );
}
