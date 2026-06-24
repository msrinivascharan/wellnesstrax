"use client";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import type { DayAnalysis, DayLog, FoodEntry, MealFood, MealType, UserProfile, BloodWorkData } from "@/types";
import { resolveCategory, mapToBalancedPlate } from "@/lib/food-utils";
import ActivityTrends from "@/components/sections/ActivityTrends";
import HydrationTrends from "@/components/sections/HydrationTrends";
import SleepTrends from "@/components/sections/SleepTrends";
import BloodWorkTrends from "@/components/sections/BloodWorkTrends";

interface Props {
  dayLog: DayLog;
  profile: UserProfile;
  onAnalysisComplete: (analysis: DayAnalysis) => void;
  bloodWork?: BloodWorkData;
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

/** Round to one decimal (for grams). */
const r1 = (x: number) => Math.round(x * 10) / 10;

/** Per-100g macro lookup keyed by lowercased item name (built from the meal Foods DBs). */
export type MacroLookup = Record<string, { kcal: number; protein: number; carbs: number; fiber: number }>;

/** Deterministically sum a meal's nutrition straight from the hardcoded Foods DB —
 *  no AI. Mirrors the planner's own math: (qty_g / 100) × per-100g value, matching
 *  each logged item by name. Items not in the DB are counted (unmatched) but not summed. */
function computeMealNutrition(entries: FoodEntry[], macros: MacroLookup) {
  let kcal = 0, protein = 0, carbs = 0, fiber = 0, matched = 0, unmatched = 0;
  for (const e of entries) {
    const m = macros[e.name.toLowerCase().trim()];
    if (!m) { unmatched++; continue; }
    const q = (e.quantity_g || 0) / 100;
    kcal += q * m.kcal; protein += q * m.protein; carbs += q * m.carbs; fiber += q * m.fiber;
    matched++;
  }
  return { kcal, protein, carbs, fiber, matched, unmatched };
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

export default function Reports({ dayLog, profile, onAnalysisComplete, bloodWork }: Props) {
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState("");
  const [backingUp, setBackingUp] = useState(false);
  const [backupMsg, setBackupMsg] = useState("");
  const [lastBackup, setLastBackup] = useState("");   // ISO timestamp of last successful backup (this device)
  const [hoveredCell, setHoveredCell] = useState<{ meal: MealType; cat: string } | null>(null);
  // Per-100g macro lookup, built from the planner Foods DBs (breakfast/lunch/dinner).
  // Calories & macros are computed deterministically from this — never from AI.
  const [foodMacros, setFoodMacros] = useState<MacroLookup>({});
  const macrosReady = Object.keys(foodMacros).length > 0;

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

  // Load the per-100g Foods DBs once and flatten into a name→macros lookup.
  useEffect(() => {
    Promise.all(
      (["breakfast", "lunch", "dinner"] as const).map(m =>
        fetch(`/api/meal-foods/${m}`).then(r => (r.ok ? r.json() : { data: null })).catch(() => ({ data: null }))
      )
    ).then(results => {
      const map: MacroLookup = {};
      for (const res of results) {
        const foods: MealFood[] = res?.data?.foods ?? [];
        for (const f of foods) {
          map[f.item.toLowerCase().trim()] = {
            kcal: f.kcal_100g, protein: f.protein_100g, carbs: f.carbs_100g, fiber: f.fiber_100g,
          };
        }
      }
      setFoodMacros(map);
    }).catch(() => {});
  }, []);

  // Remember the last successful backup (this device) for the button tooltip.
  useEffect(() => {
    try { setLastBackup(localStorage.getItem("wt-last-backup") || ""); } catch {}
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

  // ── Backup: mirror data/ to the external folder + download the JSON bundle ──
  async function runBackup() {
    setBackingUp(true);
    setBackupMsg("");
    try {
      // Write the JSON file + mirror the data/ folder to the external backup folder.
      // No browser download — the backup lives only in the Drive folder.
      const m = await fetch("/api/backup", { method: "POST" });
      const mirror = await m.json() as { mirrored: boolean; dest?: string; file?: string; at?: string; reason?: string };
      if (mirror.mirrored) {
        const at = mirror.at || new Date().toISOString();
        try { localStorage.setItem("wt-last-backup", at); } catch {}
        setLastBackup(at);
        setBackupMsg(`✓ Saved ${mirror.file ?? "backup"} + data folder to ${mirror.dest}`);
      } else {
        setBackupMsg(`⚠ Backup failed — couldn't write to ${mirror.dest ?? "the backup folder"} (${mirror.reason ?? "unavailable"})`);
      }
    } catch {
      setBackupMsg("⚠ Backup failed — could not reach the server");
    } finally {
      setBackingUp(false);
    }
  }

  function fmtBackupTime(iso: string): string {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? "" : d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  // ── Chart data computations (uses activeLog so history works) ────────────
  const totalFood  = Object.values(activeLog?.food ?? dayLog.food).flat().length;
  const takenMeds  = (activeLog?.medications ?? dayLog.medications).filter(m => m.taken).length;
  const logForChart = activeLog ?? dayLog;

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
              onClick={runBackup}
              disabled={backingUp}
              title={lastBackup
                ? `Last backup: ${fmtBackupTime(lastBackup)}\nClick to back up again (writes the file & data folder to your Drive folder)`
                : "No backup yet on this device. Click to write the file & data folder to your Drive folder"}
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

      {backupMsg && (
        <div className="text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", color: backupMsg.includes("⚠") ? "#fbbf24" : "#86efac", border: "1px solid var(--border)" }}>
          {backupMsg}
        </div>
      )}

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
              const nut       = computeMealNutrition(entries, foodMacros);

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

                  {/* Calories & macros — computed straight from the Foods DB (no AI) */}
                  {!isEmpty && macrosReady && (
                    nut.matched > 0 ? (
                      <div className="flex items-center justify-between rounded-lg px-2 py-1.5"
                        style={{ background: "rgba(251,146,60,0.06)", border: "1px solid rgba(251,146,60,0.15)" }}>
                        <span className="text-xs font-bold tabular-nums" style={{ color: "#fb923c" }}>
                          {Math.round(nut.kcal)} kcal
                        </span>
                        <span className="text-xs tabular-nums" style={{ color: "#64748b" }}>
                          {r1(nut.protein)}P · {r1(nut.carbs)}C · {r1(nut.fiber)}F g
                          {nut.unmatched > 0 && (
                            <span style={{ color: "#475569" }}> · {nut.unmatched} not in DB</span>
                          )}
                        </span>
                      </div>
                    ) : (
                      <div className="text-xs px-2 py-1.5 rounded-lg" style={{ color: "#475569", background: "rgba(255,255,255,0.02)" }}>
                        {nut.unmatched} item{nut.unmatched !== 1 ? "s" : ""} not in your Foods DB — no kcal
                      </div>
                    )
                  )}

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
                          {hd.items.map(name => (
                            <span key={name}
                              className="px-1.5 py-0.5 rounded text-xs"
                              style={{ background: "rgba(255,255,255,0.05)", color: "#94a3b8" }}>
                              {name}
                            </span>
                          ))}
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
                  {!isEmpty && missing.length === 0 && (
                    <div className="text-xs px-2 py-1 rounded-lg"
                      style={{ background: "rgba(34,197,94,0.08)", color: "#86efac" }}>
                      ✓ Well-balanced plate
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        </div>

        {/* Nutrition — calories & macros computed straight from the Foods DB (no AI).
            Shows live as soon as food is logged; AI adds only the qualitative commentary. */}
        {(() => {
          const meals: MealType[] = ["breakfast", "lunch", "dinner", "snacks"];
          const hasFood = meals.some(m => (logForChart.food[m]?.length ?? 0) > 0);
          if (!hasFood) return null;
          const day = meals.reduce((a, m) => {
            const n = computeMealNutrition(logForChart.food[m] ?? [], foodMacros);
            return {
              kcal: a.kcal + n.kcal, protein: a.protein + n.protein,
              carbs: a.carbs + n.carbs, fiber: a.fiber + n.fiber, unmatched: a.unmatched + n.unmatched,
            };
          }, { kcal: 0, protein: 0, carbs: 0, fiber: 0, unmatched: 0 });
          const tiles = [
            { label: "Calories", val: `${Math.round(day.kcal)} kcal`, target: `target ${profile.daily_targets.calories}`, color: "#fb923c" },
            { label: "Protein",  val: `${r1(day.protein)}g`, target: `target ${profile.daily_targets.protein_g}g`, color: "#a78bfa" },
            { label: "Carbs",    val: `${r1(day.carbs)}g`,   target: "", color: "#60a5fa" },
            { label: "Fiber",    val: `${r1(day.fiber)}g`,   target: `target ${profile.daily_targets.fiber_g}g`, color: "#86efac" },
          ];
          return (
            <InsightCard title="Nutrition" icon="🍽️">
              {!macrosReady ? (
                <p className="text-xs" style={{ color: "#475569" }}>Loading your Foods database…</p>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-3">
                    {tiles.map(n => (
                      <div key={n.label} className="p-2.5 rounded-xl text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                        <div className="text-base font-bold" style={{ color: n.color }}>{n.val}</div>
                        <div className="text-xs mt-0.5 text-white">{n.label}</div>
                        <div className="text-xs" style={{ color: "#475569" }}>{n.target || "from Foods DB"}</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs" style={{ color: "#475569" }}>
                    🧮 Calculated from your planner Foods DB — not AI
                    {day.unmatched > 0 && ` · ${day.unmatched} logged item${day.unmatched !== 1 ? "s" : ""} not in the DB (not counted)`}
                  </div>
                </>
              )}
              {analysis && analysis.nutrition.highlights.length > 0 && (
                <div className="space-y-1">
                  {analysis.nutrition.highlights.map((h, i) => (
                    <div key={i} className="text-xs flex gap-1.5"><span style={{ color: "#22c55e" }}>+</span><span style={{ color: "#94a3b8" }}>{h}</span></div>
                  ))}
                </div>
              )}
              {analysis && analysis.nutrition.concerns.length > 0 && (
                <div className="space-y-1">
                  {analysis.nutrition.concerns.map((c, i) => (
                    <div key={i} className="text-xs flex gap-1.5"><span style={{ color: "#f59e0b" }}>⚠</span><span style={{ color: "#94a3b8" }}>{c}</span></div>
                  ))}
                </div>
              )}
            </InsightCard>
          );
        })()}

      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          ACTIVITY TRENDS & INSIGHTS — charts always; AI text after Re-analyse
         ══════════════════════════════════════════════════════════════════════ */}
      <ActivityTrends sectionAnalysis={analysis?.activity_section_analysis} breathingAnalysis={analysis?.breathing_trend_analysis} todayNote={analysis?.activity_note} />

      {/* ── Hydration & Sleep trend sections ── */}
      <HydrationTrends waterTarget={profile.daily_targets.water_ml} insight={analysis?.hydration_trend_analysis} todayNote={analysis?.water_note} />
      <SleepTrends insight={analysis?.sleep_trend_analysis} todayNote={analysis?.sleep_note} />

      {/* ══════════════════════════════════════════════════════════════════════
          AI ANALYSIS RESULTS — only when analysis exists
         ══════════════════════════════════════════════════════════════════════ */}
      {analysis && !loading && (
        <div className="space-y-5 fade-in-up">
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

          {/* ── Blood Work & Vitals — trends, charts & insights ── */}
          {bloodWork && <BloodWorkTrends bloodWork={bloodWork} profile={profile} />}
        </div>
      )}
    </div>
  );
}
