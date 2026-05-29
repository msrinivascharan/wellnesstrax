"use client";
import { useState, useEffect } from "react";
import type { DailyActivityPoint, ActivityTrendAnalysis, BreathingTrendAnalysis } from "@/types";

type Period = "daily" | "weekly" | "monthly";

interface Bucket {
  label: string;
  gymMin: number;
  walkMin: number;
  soleusMin: number;
  total: number;
  gymDays: number;
  boxRounds: number;
  longExhaleRounds: number;
  breathTotal: number;
  breathDays: number;
  dayCount: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const COLORS = { gym: "#a78bfa", walk: "#2dd4bf", soleus: "#818cf8", box: "#38bdf8", longExhale: "#f472b6" };

function dmLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

/** Sunday-anchored start of the week for a YYYY-MM-DD string. */
function startOfWeek(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().split("T")[0];
}

function buildBuckets(points: DailyActivityPoint[], period: Period): Bucket[] {
  if (period === "daily") {
    return points.slice(-14).map(p => ({
      label: dmLabel(p.date),
      gymMin: p.gymMin, walkMin: p.walkMin, soleusMin: p.soleusMin,
      total: p.activeMin, gymDays: p.gymDone ? 1 : 0,
      boxRounds: p.boxRounds, longExhaleRounds: p.longExhaleRounds,
      breathTotal: p.breathingRounds, breathDays: p.breathingRounds > 0 ? 1 : 0,
      dayCount: 1,
    }));
  }
  const keyOf = (p: DailyActivityPoint) =>
    period === "weekly" ? startOfWeek(p.date) : p.date.slice(0, 7);
  const map = new Map<string, Bucket>();
  const order: string[] = [];
  for (const p of points) {
    const k = keyOf(p);
    if (!map.has(k)) {
      map.set(k, { label: "", gymMin: 0, walkMin: 0, soleusMin: 0, total: 0, gymDays: 0, boxRounds: 0, longExhaleRounds: 0, breathTotal: 0, breathDays: 0, dayCount: 0 });
      order.push(k);
    }
    const b = map.get(k)!;
    b.gymMin += p.gymMin; b.walkMin += p.walkMin; b.soleusMin += p.soleusMin;
    b.total += p.activeMin; b.gymDays += p.gymDone ? 1 : 0;
    b.boxRounds += p.boxRounds; b.longExhaleRounds += p.longExhaleRounds;
    b.breathTotal += p.breathingRounds; b.breathDays += p.breathingRounds > 0 ? 1 : 0;
    b.dayCount += 1;
  }
  const buckets = order.map(k => {
    const b = map.get(k)!;
    if (period === "weekly") {
      b.label = dmLabel(k);
    } else {
      const [y, m] = k.split("-");
      b.label = `${MONTHS[parseInt(m, 10) - 1]} ${y.slice(2)}`;
    }
    return b;
  });
  return period === "weekly" ? buckets.slice(-8) : buckets.slice(-6);
}

function StatTile({ value, label, sub, color }: { value: string; label: string; sub: string; color: string }) {
  return (
    <div className="p-2.5 rounded-xl text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
      <div className="text-lg font-bold" style={{ color }}>{value}</div>
      <div className="text-xs mt-0.5 text-white">{label}</div>
      <div className="text-xs" style={{ color: "#475569" }}>{sub}</div>
    </div>
  );
}

function periodWindow(period: Period): number {
  return period === "daily" ? 14 : period === "weekly" ? 56 : 180;
}
function periodWord(period: Period): string {
  return period === "daily" ? "14 days" : period === "weekly" ? "8 weeks" : "6 months";
}

function PeriodToggle({ period, setPeriod }: { period: Period; setPeriod: (p: Period) => void }) {
  return (
    <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
      {(["daily", "weekly", "monthly"] as Period[]).map(p => (
        <button key={p} onClick={() => setPeriod(p)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize"
          style={period === p
            ? { background: "rgba(20,184,166,0.15)", color: "#14b8a6", border: "1px solid rgba(20,184,166,0.35)" }
            : { color: "#64748b" }}>
          {p}
        </button>
      ))}
    </div>
  );
}

export default function ActivityTrends({ trendAnalysis, breathingAnalysis, todayNote }: { trendAnalysis?: ActivityTrendAnalysis; breathingAnalysis?: BreathingTrendAnalysis; todayNote?: string }) {
  const [points, setPoints] = useState<DailyActivityPoint[]>([]);
  const [period, setPeriod] = useState<Period>("daily");
  const [breathPeriod, setBreathPeriod] = useState<Period>("daily");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/activity-trends?days=180")
      .then(r => r.json())
      .then((d: { data?: DailyActivityPoint[] }) => setPoints(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const buckets = buildBuckets(points, period);
  const maxTotal = Math.max(1, ...buckets.map(b => b.total));

  const win = points.slice(-periodWindow(period));
  const gymDays = win.filter(p => p.gymDone).length;
  const gymMins = win.filter(p => p.gymMin > 0).map(p => p.gymMin);
  const avgGym = gymMins.length ? Math.round(gymMins.reduce((a, b) => a + b, 0) / gymMins.length) : 0;
  const totalActive = win.reduce((s, p) => s + p.activeMin, 0);
  const walkDays = win.filter(p => p.walks > 0).length;
  const hasData = points.some(p => p.activeMin > 0 || p.gymDone);

  // ── Breathing derived data ────────────────────────────────────────────────
  const breathBuckets = buildBuckets(points, breathPeriod);
  const maxBreath = Math.max(1, ...breathBuckets.map(b => b.breathTotal));
  const bWin = points.slice(-periodWindow(breathPeriod));
  const breathDays = bWin.filter(p => p.breathingRounds > 0).length;
  const avgBox = bWin.length ? (bWin.reduce((s, p) => s + p.boxRounds, 0) / bWin.length).toFixed(1) : "0";
  const avgLong = bWin.length ? (bWin.reduce((s, p) => s + p.longExhaleRounds, 0) / bWin.length).toFixed(1) : "0";
  const totalBreath = bWin.reduce((s, p) => s + p.breathingRounds, 0);
  const hasBreathData = points.some(p => p.breathingRounds > 0);

  return (
   <>
   {/* ═══ Activity (movement) section ═══ */}
    <div className="space-y-4">
      <div className="section-header">Activity trends &amp; insights</div>

      <div className="card p-5 space-y-5">
        {/* Header + period toggle */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏃</span>
            <span className="text-sm font-semibold text-white">Movement over time</span>
          </div>
          <PeriodToggle period={period} setPeriod={setPeriod} />
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm" style={{ color: "#475569" }}>Loading activity history…</div>
        ) : !hasData ? (
          <div className="py-10 text-center space-y-2">
            <div className="text-3xl">🏃</div>
            <div className="text-sm font-medium text-white">No activity history yet</div>
            <div className="text-xs" style={{ color: "#475569" }}>
              Log gym sessions, walks, and soleus pumps over a few days — trends will appear here.
            </div>
          </div>
        ) : (
          <>
            {/* Stat tiles */}
            <div className="grid grid-cols-4 gap-2">
              <StatTile value={String(gymDays)} label="Gym days" sub={`last ${periodWord(period)}`} color="#a78bfa" />
              <StatTile value={avgGym ? `${avgGym}m` : "—"} label="Avg session" sub="gym duration" color="#c4b5fd" />
              <StatTile value={`${totalActive}`} label="Active min" sub="gym+walk+soleus" color="#2dd4bf" />
              <StatTile value={String(walkDays)} label="Walk days" sub={`last ${periodWord(period)}`} color="#34d399" />
            </div>

            {/* Stacked bar chart */}
            <div>
              <div className="flex items-end gap-1.5" style={{ height: 170 }}>
                {buckets.map((b, i) => {
                  const seg = (v: number, color: string) =>
                    v > 0 ? <div style={{ height: `${(v / maxTotal) * 100}%`, background: color }} /> : null;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                      <div className="w-full flex flex-col justify-end rounded-t overflow-hidden"
                        style={{ height: "100%" }}
                        title={`${b.label}\nGym: ${b.gymMin}m\nWalks: ${b.walkMin}m\nSoleus: ${b.soleusMin}m\nTotal active: ${b.total}m${b.gymDays ? `\nGym days: ${b.gymDays}` : ""}`}>
                        {seg(b.soleusMin, COLORS.soleus)}
                        {seg(b.walkMin, COLORS.walk)}
                        {seg(b.gymMin, COLORS.gym)}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Labels + gym markers */}
              <div className="flex gap-1.5 mt-1.5">
                {buckets.map((b, i) => (
                  <div key={i} className="flex-1 text-center">
                    <div style={{ height: 6 }}>
                      {b.gymDays > 0 && (
                        <span className="text-xs" style={{ color: COLORS.gym }}>
                          ●{period !== "daily" ? b.gymDays : ""}
                        </span>
                      )}
                    </div>
                    <div className="text-xs" style={{ color: "#475569", fontSize: 10 }}>{b.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: "#94a3b8" }}>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: COLORS.gym }} />Gym min</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: COLORS.walk }} />Walk min</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: COLORS.soleus }} />Soleus min</span>
              <span className="flex items-center gap-1.5" style={{ color: "#475569" }}><span style={{ color: COLORS.gym }}>●</span> gym day</span>
            </div>
          </>
        )}

        {/* LLM trend analysis — only after Re-analyse */}
        {(trendAnalysis || todayNote) && (
          <div className="pt-4 space-y-3" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2">
              <span className="text-base">🧠</span>
              <span className="text-sm font-semibold text-white">AI activity analysis</span>
            </div>

            {todayNote && (
              <div className="text-xs leading-relaxed p-2.5 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", color: "#94a3b8", border: "1px solid var(--border)" }}>
                <span className="font-semibold text-white">Today: </span>{todayNote}
              </div>
            )}

            {trendAnalysis?.summary && (
              <p className="text-xs leading-relaxed" style={{ color: "#94a3b8" }}>{trendAnalysis.summary}</p>
            )}

            <div className="grid grid-cols-2 gap-3">
              {(trendAnalysis?.whats_good?.length ?? 0) > 0 && (
                <div className="p-3 rounded-xl space-y-1.5" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.18)" }}>
                  <div className="text-xs font-semibold" style={{ color: "#86efac" }}>What&apos;s going well</div>
                  {trendAnalysis!.whats_good.map((g, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs">
                      <span style={{ color: "#22c55e" }}>✓</span>
                      <span style={{ color: "#94a3b8" }}>{g}</span>
                    </div>
                  ))}
                </div>
              )}
              {(trendAnalysis?.improvements?.length ?? 0) > 0 && (
                <div className="p-3 rounded-xl space-y-1.5" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)" }}>
                  <div className="text-xs font-semibold" style={{ color: "#fbbf24" }}>Where to improve</div>
                  {trendAnalysis!.improvements.map((g, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs">
                      <span style={{ color: "#f59e0b" }}>↑</span>
                      <span style={{ color: "#94a3b8" }}>{g}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {trendAnalysis?.gym_insight && (
              <div className="p-3 rounded-xl space-y-1" style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.18)" }}>
                <div className="text-xs font-semibold" style={{ color: "#c4b5fd" }}>🏋️ Gym time insight</div>
                <p className="text-xs leading-relaxed" style={{ color: "#94a3b8" }}>{trendAnalysis.gym_insight}</p>
              </div>
            )}

            {trendAnalysis?.consistency_note && (
              <div className="text-xs leading-relaxed p-2.5 rounded-lg" style={{ background: "rgba(20,184,166,0.06)", color: "#5eead4" }}>
                📊 {trendAnalysis.consistency_note}
              </div>
            )}
          </div>
        )}
      </div>
    </div>

    {/* ═══ Breathing practice section (separate) ═══ */}
    <div className="space-y-4">
      <div className="section-header">Breathing insights</div>

      <div className="card p-5 space-y-5">
        {/* Header + period toggle */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🫁</span>
            <span className="text-sm font-semibold text-white">Breathing practice over time</span>
          </div>
          <PeriodToggle period={breathPeriod} setPeriod={setBreathPeriod} />
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm" style={{ color: "#475569" }}>Loading breathing history…</div>
        ) : !hasBreathData ? (
          <div className="py-10 text-center space-y-2">
            <div className="text-3xl">🫁</div>
            <div className="text-sm font-medium text-white">No breathing practice logged yet</div>
            <div className="text-xs" style={{ color: "#475569" }}>
              Log Box (4-4-4-4) and 4-7-8 rounds in the Activity section — trends will appear here.
            </div>
          </div>
        ) : (
          <>
            {/* Stat tiles */}
            <div className="grid grid-cols-4 gap-2">
              <StatTile value={String(breathDays)} label="Days practiced" sub={`last ${periodWord(breathPeriod)}`} color="#38bdf8" />
              <StatTile value={avgBox} label="Avg Box / day" sub="4-4-4-4 rounds" color="#7dd3fc" />
              <StatTile value={avgLong} label="Avg 4-7-8 / day" sub="long-exhale rounds" color="#f472b6" />
              <StatTile value={String(totalBreath)} label="Total rounds" sub="box + 4-7-8" color="#c084fc" />
            </div>

            {/* Stacked bar chart — box + long-exhale rounds */}
            <div>
              <div className="flex items-end gap-1.5" style={{ height: 150 }}>
                {breathBuckets.map((b, i) => {
                  const seg = (v: number, color: string) =>
                    v > 0 ? <div style={{ height: `${(v / maxBreath) * 100}%`, background: color }} /> : null;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                      <div className="w-full flex flex-col justify-end rounded-t overflow-hidden"
                        style={{ height: "100%" }}
                        title={`${b.label}\nBox 4-4-4-4: ${b.boxRounds} rounds\n4-7-8: ${b.longExhaleRounds} rounds\nTotal: ${b.breathTotal} rounds${b.breathDays ? `\nDays practiced: ${b.breathDays}` : ""}`}>
                        {seg(b.longExhaleRounds, COLORS.longExhale)}
                        {seg(b.boxRounds, COLORS.box)}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Labels + practiced markers */}
              <div className="flex gap-1.5 mt-1.5">
                {breathBuckets.map((b, i) => (
                  <div key={i} className="flex-1 text-center">
                    <div style={{ height: 6 }}>
                      {b.breathDays > 0 && (
                        <span className="text-xs" style={{ color: COLORS.box }}>
                          ●{breathPeriod !== "daily" ? b.breathDays : ""}
                        </span>
                      )}
                    </div>
                    <div className="text-xs" style={{ color: "#475569", fontSize: 10 }}>{b.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: "#94a3b8" }}>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: COLORS.box }} />Box 4-4-4-4</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: COLORS.longExhale }} />4-7-8 long-exhale</span>
              <span style={{ color: "#475569" }}>Targets: Box ~5–6/day · 4-7-8 ~2/day</span>
            </div>
          </>
        )}

        {/* LLM breathing analysis — only after Re-analyse */}
        {breathingAnalysis && (
          <div className="pt-4 space-y-3" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2">
              <span className="text-base">🧠</span>
              <span className="text-sm font-semibold text-white">AI breathing analysis</span>
            </div>

            {breathingAnalysis.summary && (
              <p className="text-xs leading-relaxed" style={{ color: "#94a3b8" }}>{breathingAnalysis.summary}</p>
            )}

            <div className="grid grid-cols-2 gap-3">
              {(breathingAnalysis.whats_good?.length ?? 0) > 0 && (
                <div className="p-3 rounded-xl space-y-1.5" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.18)" }}>
                  <div className="text-xs font-semibold" style={{ color: "#86efac" }}>What&apos;s going well</div>
                  {breathingAnalysis.whats_good.map((g, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs">
                      <span style={{ color: "#22c55e" }}>✓</span>
                      <span style={{ color: "#94a3b8" }}>{g}</span>
                    </div>
                  ))}
                </div>
              )}
              {(breathingAnalysis.improvements?.length ?? 0) > 0 && (
                <div className="p-3 rounded-xl space-y-1.5" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)" }}>
                  <div className="text-xs font-semibold" style={{ color: "#fbbf24" }}>Where to improve</div>
                  {breathingAnalysis.improvements.map((g, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs">
                      <span style={{ color: "#f59e0b" }}>↑</span>
                      <span style={{ color: "#94a3b8" }}>{g}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {breathingAnalysis.benefit_note && (
              <div className="p-3 rounded-xl space-y-1" style={{ background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.18)" }}>
                <div className="text-xs font-semibold" style={{ color: "#7dd3fc" }}>🫀 Why it helps you</div>
                <p className="text-xs leading-relaxed" style={{ color: "#94a3b8" }}>{breathingAnalysis.benefit_note}</p>
              </div>
            )}

            {breathingAnalysis.consistency_note && (
              <div className="text-xs leading-relaxed p-2.5 rounded-lg" style={{ background: "rgba(20,184,166,0.06)", color: "#5eead4" }}>
                📊 {breathingAnalysis.consistency_note}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
   </>
  );
}
