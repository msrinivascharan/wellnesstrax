"use client";
import { useState } from "react";
import type { DayAnalysis, DayLog, MealType, UserProfile } from "@/types";
import { resolveCategory } from "@/lib/food-utils";

interface Props {
  dayLog: DayLog;
  profile: UserProfile;
  onAnalysisComplete: (analysis: DayAnalysis) => void;
}

const LOADING_MSGS = [
  "Scanning your food log...",
  "Checking drug-food interactions...",
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

const CAT_COLOR_MAP: Record<string, string> = {
  "Protein":             "#a78bfa",
  "Fruits":              "#fb923c",
  "Vegetables":          "#22c55e",
  "Nuts & Seeds":        "#f59e0b",
  "Dairy":               "#60a5fa",
  "Grains & Carbs":      "#fbbf24",
  "Beverages & Drinks":  "#34d399",
  "One-Pot Dish":        "#f472b6",
  "Legumes & Beans":     "#84cc16",
  "Spices & Condiments": "#fde68a",
  "Dietary Fiber":       "#2dd4bf",
  "Custom":              "#64748b",
  "Other":               "#64748b",
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

function AlertBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = { CRITICAL: "badge-critical", HIGH: "badge-high", MEDIUM: "badge-medium", LOW: "badge-low" };
  return <span className={map[severity] ?? "badge-low"}>{severity}</span>;
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

// ─── Main component ────────────────────────────────────────────────────────────

export default function Reports({ dayLog, profile, onAnalysisComplete }: Props) {
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState("");
  const [backingUp, setBackingUp] = useState(false);

  const analysis = dayLog.analysis;

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
      a.download = `nutritrack-backup-${new Date().toISOString().split("T")[0]}.json`;
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

  // ── Chart data computations ───────────────────────────────────────────────
  const totalFood = Object.values(dayLog.food).flat().length;
  const takenMeds = dayLog.medications.filter(m => m.taken).length;

  // Plate balance: count items per category across all meals.
  // resolveCategory re-maps stale "custom" labels from old sessions on-the-fly.
  const allEntries = Object.values(dayLog.food).flat();
  const catMap = new Map<string, number>();
  for (const e of allEntries) {
    const cat = resolveCategory(e);
    catMap.set(cat, (catMap.get(cat) ?? 0) + 1);
  }
  const plateCats = [...catMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7);

  const gymDone   = dayLog.activity.gym.did_gym;
  const walksDone = dayLog.activity.post_prandial_walks.length;
  const soleusDone = dayLog.activity.soleus_pumps.length;

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
          {/* Backup button */}
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

          {/* Analyse button */}
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
        </div>
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

      {/* ── No analysis prompt ───────────────────────────────────────────────── */}
      {!analysis && !loading && (
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

      {/* ══════════════════════════════════════════════════════════════════════
          TODAY'S DATA SNAPSHOT — always visible
         ══════════════════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        <div className="section-header">Today&apos;s data snapshot</div>

        {/* Row 1: Meal composition + Plate balance */}
        <div className="grid grid-cols-2 gap-4">
          {/* Meal composition */}
          <div className="card p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <span>🍽️</span>
              <span className="text-sm font-semibold text-white">Meal composition</span>
            </div>
            {(["breakfast", "lunch", "dinner", "snacks"] as MealType[]).map(m => {
              const count = dayLog.food[m]?.length ?? 0;
              return (
                <BarRow
                  key={m}
                  label={m.charAt(0).toUpperCase() + m.slice(1)}
                  value={count}
                  max={Math.max(8, ...Object.values(dayLog.food).map(a => a.length))}
                  color={MEAL_COLORS[m]}
                  valueSuffix=""
                  showValue={false}
                />
              );
            })}
            <div className="flex flex-wrap gap-2 pt-1">
              {(["breakfast", "lunch", "dinner", "snacks"] as MealType[]).map(m => {
                const count = dayLog.food[m]?.length ?? 0;
                return count > 0 ? (
                  <span key={m} className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: `${MEAL_COLORS[m]}18`, color: MEAL_COLORS[m] }}>
                    {m.charAt(0).toUpperCase() + m.slice(1)}: {count}
                  </span>
                ) : null;
              })}
              {totalFood === 0 && (
                <span className="text-xs" style={{ color: "#475569" }}>No items logged yet</span>
              )}
            </div>
          </div>

          {/* Plate balance */}
          <div className="card p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <span>🥗</span>
              <span className="text-sm font-semibold text-white">Plate balance</span>
            </div>
            {plateCats.length === 0 ? (
              <p className="text-xs" style={{ color: "#475569" }}>No items logged yet</p>
            ) : plateCats.map(([cat, count]) => (
              <BarRow
                key={cat}
                label={cat}
                value={count}
                max={totalFood || 1}
                color={CAT_COLOR_MAP[cat] ?? "#64748b"}
                showValue={false}
              />
            ))}
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
              value={dayLog.water_ml}
              max={profile.daily_targets.water_ml}
              color="#60a5fa"
              valueSuffix="ml"
            />
            <div className="text-xs" style={{ color: "#475569" }}>
              {dayLog.water_ml >= profile.daily_targets.water_ml
                ? "✓ Daily target reached!"
                : `${profile.daily_targets.water_ml - dayLog.water_ml}ml remaining to hit target`}
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

          {/* Drug-food alerts */}
          {analysis.nutrition.drug_food_alerts.length > 0 && (
            <InsightCard title="Drug-food interaction alerts" icon="🚨">
              <div className="space-y-2">
                {analysis.nutrition.drug_food_alerts.map((a, i) => (
                  <div key={i} className="p-2.5 rounded-xl" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
                    <div className="flex items-center gap-2 mb-1">
                      <AlertBadge severity={a.severity} />
                      <span className="text-xs font-medium text-white">{a.drug} + {a.food}</span>
                    </div>
                    <p className="text-xs" style={{ color: "#fca5a5" }}>{a.action}</p>
                  </div>
                ))}
              </div>
            </InsightCard>
          )}

          {/* 3-column row: Activity, Water, Sleep */}
          <div className="grid grid-cols-3 gap-4">
            <InsightCard title="Activity" icon="🏃">
              <p className="text-xs" style={{ color: "#94a3b8" }}>{analysis.activity_note}</p>
            </InsightCard>
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

          {/* Foods to avoid permanently */}
          {(analysis.foods_to_avoid_forever ?? []).length > 0 && (
            <InsightCard title="Foods to avoid permanently" icon="🚫">
              <p className="text-xs mb-2" style={{ color: "#64748b" }}>
                Specific items from today's log that your cardiac profile says to eliminate for good.
              </p>
              <div className="space-y-2">
                {(analysis.foods_to_avoid_forever ?? []).map((item, i) => (
                  <div key={i} className="p-2.5 rounded-xl"
                    style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)" }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-red-400 text-xs font-bold shrink-0">✕</span>
                      <span className="text-xs font-semibold text-red-300">{item.food}</span>
                    </div>
                    <p className="text-xs" style={{ color: "#fca5a5" }}>{item.reason}</p>
                  </div>
                ))}
              </div>
            </InsightCard>
          )}

          {/* Add from tomorrow */}
          {(analysis.add_from_tomorrow ?? []).length > 0 && (
            <InsightCard title="Start adding from tomorrow" icon="🌱">
              <p className="text-xs mb-2" style={{ color: "#64748b" }}>
                Specific foods or habits to introduce based on gaps in today's log.
              </p>
              <div className="space-y-2">
                {(analysis.add_from_tomorrow ?? []).map((item, i) => (
                  <div key={i} className="p-2.5 rounded-xl"
                    style={{ background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.2)" }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-green-400 text-xs font-bold shrink-0">+</span>
                      <span className="text-xs font-semibold text-green-300">{item.item}</span>
                    </div>
                    <p className="text-xs" style={{ color: "#86efac" }}>{item.benefit}</p>
                  </div>
                ))}
              </div>
            </InsightCard>
          )}

          {/* Tomorrow's focus */}
          <InsightCard title="Tomorrow's focus" icon="🎯">
            <div className="space-y-2">
              {analysis.tomorrow_focus.map((t, i) => (
                <div key={i} className="flex items-start gap-2.5 p-2 rounded-xl" style={{ background: "rgba(20,184,166,0.06)", border: "1px solid rgba(20,184,166,0.15)" }}>
                  <span className="text-teal-400 font-bold text-xs mt-0.5 shrink-0">{i + 1}.</span>
                  <span className="text-xs" style={{ color: "#94a3b8" }}>{t}</span>
                </div>
              ))}
            </div>
          </InsightCard>
        </div>
      )}
    </div>
  );
}
