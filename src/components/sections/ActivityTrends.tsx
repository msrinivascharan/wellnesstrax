"use client";
import { useState, useEffect } from "react";
import type {
  DailyActivityPoint, BreathingTrendAnalysis, ActivitySectionAnalysis, SectionInsight,
} from "@/types";
import MuscleMap from "@/components/sections/MuscleMap";

type Period = "daily" | "weekly" | "monthly";

interface Bucket {
  label: string;
  gymMin: number; cardioMin: number; strengthSets: number; strengthVolume: number;
  walkMin: number; soleusMin: number; walks: number; soleus: number;
  badmintonMin: number; badmintonGames: number;
  activeMin: number; gymDays: number; activeDays: number;
  boxRounds: number; longExhaleRounds: number; breathTotal: number; breathDays: number;
  dayCount: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const COLORS = {
  gym: "#a78bfa", walk: "#2dd4bf", soleus: "#818cf8", badminton: "#f472b6",
  cardio: "#fb923c", strength: "#a78bfa", box: "#38bdf8", longExhale: "#f472b6",
};

function dmLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getDate()}/${d.getMonth() + 1}`;
}
function startOfWeek(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().split("T")[0];
}
function periodWindow(p: Period): number { return p === "daily" ? 14 : p === "weekly" ? 56 : 180; }
function periodWord(p: Period): string { return p === "daily" ? "14 days" : p === "weekly" ? "8 weeks" : "6 months"; }

function emptyBucket(label: string): Bucket {
  return {
    label, gymMin: 0, cardioMin: 0, strengthSets: 0, strengthVolume: 0,
    walkMin: 0, soleusMin: 0, walks: 0, soleus: 0, badmintonMin: 0, badmintonGames: 0,
    activeMin: 0, gymDays: 0, activeDays: 0,
    boxRounds: 0, longExhaleRounds: 0, breathTotal: 0, breathDays: 0, dayCount: 0,
  };
}
function addPoint(b: Bucket, p: DailyActivityPoint) {
  b.gymMin += p.gymMin; b.cardioMin += p.cardioMin; b.strengthSets += p.strengthSets;
  b.strengthVolume += p.strengthVolume; b.walkMin += p.walkMin; b.soleusMin += p.soleusMin;
  b.walks += p.walks; b.soleus += p.soleus; b.badmintonMin += p.badmintonMin;
  b.badmintonGames += p.badmintonGames; b.activeMin += p.activeMin;
  b.gymDays += p.gymDone ? 1 : 0; b.activeDays += (p.gymDone || p.activeMin > 0) ? 1 : 0;
  b.boxRounds += p.boxRounds; b.longExhaleRounds += p.longExhaleRounds;
  b.breathTotal += p.breathingRounds; b.breathDays += p.breathingRounds > 0 ? 1 : 0;
  b.dayCount += 1;
}

function buildBuckets(points: DailyActivityPoint[], period: Period): Bucket[] {
  if (period === "daily") {
    return points.slice(-14).map(p => { const b = emptyBucket(dmLabel(p.date)); addPoint(b, p); return b; });
  }
  const keyOf = (p: DailyActivityPoint) => period === "weekly" ? startOfWeek(p.date) : p.date.slice(0, 7);
  const map = new Map<string, Bucket>();
  const order: string[] = [];
  for (const p of points) {
    const k = keyOf(p);
    if (!map.has(k)) { map.set(k, emptyBucket(k)); order.push(k); }
    addPoint(map.get(k)!, p);
  }
  const buckets = order.map(k => {
    const b = map.get(k)!;
    if (period === "weekly") b.label = dmLabel(k);
    else { const [y, m] = k.split("-"); b.label = `${MONTHS[parseInt(m, 10) - 1]} ${y.slice(2)}`; }
    return b;
  });
  return period === "weekly" ? buckets.slice(-8) : buckets.slice(-6);
}

/** Streak / gap stats over a window of points. */
function consistency(points: DailyActivityPoint[]) {
  const dd = (a: string, b: string) => Math.round((new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime()) / 86400000);
  const activeDates = points.filter(p => p.gymDone || p.activeMin > 0).map(p => p.date);
  let longestStreak = 0, cur = 0, prev: string | null = null;
  for (const d of activeDates) {
    cur = (prev && dd(prev, d) === 1) ? cur + 1 : 1;
    longestStreak = Math.max(longestStreak, cur); prev = d;
  }
  const last = points[points.length - 1]?.date ?? "";
  const currentGap = activeDates.length ? dd(activeDates[activeDates.length - 1], last) : points.length;
  return { activeCount: activeDates.length, longestStreak, currentGap };
}

// ── Reusable UI bits ──────────────────────────────────────────────────────────

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

function StatTile({ value, label, sub, color }: { value: string; label: string; sub: string; color: string }) {
  return (
    <div className="p-2.5 rounded-xl text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
      <div className="text-lg font-bold" style={{ color }}>{value}</div>
      <div className="text-xs mt-0.5 text-white">{label}</div>
      <div className="text-xs" style={{ color: "#475569" }}>{sub}</div>
    </div>
  );
}

type Series = { color: string; value: (b: Bucket) => number };
function Bars({ buckets, series, height = 150, markerColor, markerOf, fmt }: {
  buckets: Bucket[]; series: Series[]; height?: number;
  markerColor?: string; markerOf?: (b: Bucket) => string | number | null; fmt?: (b: Bucket) => string;
}) {
  const max = Math.max(1, ...buckets.map(b => series.reduce((s, ser) => s + ser.value(b), 0)));
  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height }}>
        {buckets.map((b, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
            <div className="w-full flex flex-col justify-end rounded-t overflow-hidden" style={{ height: "100%" }} title={fmt?.(b)}>
              {series.slice().reverse().map((ser, si) => {
                const v = ser.value(b);
                return v > 0 ? <div key={si} style={{ height: `${(v / max) * 100}%`, background: ser.color }} /> : null;
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 mt-1.5">
        {buckets.map((b, i) => (
          <div key={i} className="flex-1 text-center">
            <div style={{ height: 6 }}>
              {markerOf && markerOf(b) ? <span className="text-xs" style={{ color: markerColor }}>{markerOf(b)}</span> : null}
            </div>
            <div className="text-xs" style={{ color: "#475569", fontSize: 10 }}>{b.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: "#94a3b8" }}>
      {items.map(it => (
        <span key={it.label} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: it.color }} />{it.label}
        </span>
      ))}
    </div>
  );
}

function SectionInsightBlock({ insight }: { insight?: SectionInsight }) {
  if (!insight) return null;
  return (
    <div className="pt-3 space-y-2.5" style={{ borderTop: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2">
        <span className="text-sm">🧠</span>
        <span className="text-xs font-semibold text-white">AI analysis</span>
      </div>
      {insight.summary && <p className="text-xs leading-relaxed" style={{ color: "#94a3b8" }}>{insight.summary}</p>}
      <div className="grid grid-cols-2 gap-3">
        {(insight.whats_good?.length ?? 0) > 0 && (
          <div className="p-3 rounded-xl space-y-1.5" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.18)" }}>
            <div className="text-xs font-semibold" style={{ color: "#86efac" }}>What&apos;s going well</div>
            {insight.whats_good.map((g, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs"><span style={{ color: "#22c55e" }}>✓</span><span style={{ color: "#94a3b8" }}>{g}</span></div>
            ))}
          </div>
        )}
        {(insight.improvements?.length ?? 0) > 0 && (
          <div className="p-3 rounded-xl space-y-1.5" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)" }}>
            <div className="text-xs font-semibold" style={{ color: "#fbbf24" }}>Where to improve</div>
            {insight.improvements.map((g, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs"><span style={{ color: "#f59e0b" }}>↑</span><span style={{ color: "#94a3b8" }}>{g}</span></div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SubCard({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <span className="text-sm font-semibold text-white">{title}</span>
      </div>
      {children}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────────

export default function ActivityTrends({
  sectionAnalysis, breathingAnalysis, todayNote,
}: {
  sectionAnalysis?: ActivitySectionAnalysis;
  breathingAnalysis?: BreathingTrendAnalysis;
  todayNote?: string;
}) {
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
  const win = points.slice(-periodWindow(period));
  const sum = (f: (p: DailyActivityPoint) => number) => win.reduce((s, p) => s + f(p), 0);
  const days = (f: (p: DailyActivityPoint) => boolean) => win.filter(f).length;
  const c = consistency(win);

  // Muscle work aggregated over the strength window
  const muscleWork: Record<string, number> = {};
  for (const p of win) for (const [m, v] of Object.entries(p.muscles ?? {})) muscleWork[m] = (muscleWork[m] ?? 0) + v;

  const hasData = points.some(p => p.activeMin > 0 || p.gymDone);
  const pw = periodWord(period);

  // Breathing
  const breathBuckets = buildBuckets(points, breathPeriod);
  const maxBreath = Math.max(1, ...breathBuckets.map(b => b.breathTotal));
  const bWin = points.slice(-periodWindow(breathPeriod));
  const breathDays = bWin.filter(p => p.breathingRounds > 0).length;
  const avgBox = bWin.length ? (bWin.reduce((s, p) => s + p.boxRounds, 0) / bWin.length).toFixed(1) : "0";
  const avgLong = bWin.length ? (bWin.reduce((s, p) => s + p.longExhaleRounds, 0) / bWin.length).toFixed(1) : "0";
  const totalBreath = bWin.reduce((s, p) => s + p.breathingRounds, 0);
  const hasBreathData = points.some(p => p.breathingRounds > 0);

  const cardioDays = days(p => p.cardioMin > 0);
  const totalCardio = sum(p => p.cardioMin);
  const strengthDays = days(p => p.strengthSets > 0);
  const totalSets = sum(p => p.strengthSets);
  const totalVolume = Math.round(sum(p => p.strengthVolume));
  const badDays = days(p => p.badmintonMin > 0);
  const badMin = sum(p => p.badmintonMin);
  const badGames = sum(p => p.badmintonGames);

  return (
    <>
      {/* ═══ Activity trends ═══ */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="section-header">Activity trends &amp; insights</div>
          {hasData && <PeriodToggle period={period} setPeriod={setPeriod} />}
        </div>

        {loading ? (
          <div className="card p-10 text-center text-sm" style={{ color: "#475569" }}>Loading activity history…</div>
        ) : !hasData ? (
          <div className="card p-10 text-center space-y-2">
            <div className="text-3xl">🏃</div>
            <div className="text-sm font-medium text-white">No activity history yet</div>
            <div className="text-xs" style={{ color: "#475569" }}>
              Log gym, walks, soleus pumps, or badminton over a few days — sectioned trends and AI insights will appear here.
            </div>
          </div>
        ) : (
          <>
            {/* ── Overall ── */}
            <SubCard icon="🏃" title="Overall movement">
              <div className="grid grid-cols-4 gap-2">
                <StatTile value={`${c.activeCount}`} label="Active days" sub={`last ${pw}`} color="#2dd4bf" />
                <StatTile value={`${days(p => p.gymDone)}`} label="Gym days" sub={`last ${pw}`} color="#a78bfa" />
                <StatTile value={`${Math.round(sum(p => p.activeMin) / Math.max(1, win.length))}`} label="Avg active min" sub="per day" color="#34d399" />
                <StatTile value={`${c.currentGap}d`} label="Current gap" sub={`streak best ${c.longestStreak}d`} color={c.currentGap <= 1 ? "#22c55e" : c.currentGap <= 3 ? "#f59e0b" : "#ef4444"} />
              </div>
              <Bars buckets={buckets}
                series={[
                  { color: COLORS.gym, value: b => b.gymMin },
                  { color: COLORS.walk, value: b => b.walkMin },
                  { color: COLORS.soleus, value: b => b.soleusMin },
                  { color: COLORS.badminton, value: b => b.badmintonMin },
                ]}
                fmt={b => `${b.label}\nGym: ${b.gymMin}m\nWalks: ${b.walkMin}m\nSoleus: ${b.soleusMin}m\nBadminton: ${b.badmintonMin}m\nTotal active: ${b.activeMin}m`} />
              <Legend items={[
                { color: COLORS.gym, label: "Gym" }, { color: COLORS.walk, label: "Walks" },
                { color: COLORS.soleus, label: "Soleus" }, { color: COLORS.badminton, label: "Badminton" },
              ]} />

              {(sectionAnalysis?.overall || todayNote) && (
                <div className="pt-3 space-y-3" style={{ borderTop: "1px solid var(--border)" }}>
                  <div className="flex items-center gap-2"><span className="text-sm">🧠</span><span className="text-xs font-semibold text-white">AI overall analysis</span></div>
                  {todayNote && (
                    <div className="text-xs leading-relaxed p-2.5 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", color: "#94a3b8", border: "1px solid var(--border)" }}>
                      <span className="font-semibold text-white">Today: </span>{todayNote}
                    </div>
                  )}
                  {sectionAnalysis?.overall?.summary && <p className="text-xs leading-relaxed" style={{ color: "#94a3b8" }}>{sectionAnalysis.overall.summary}</p>}
                  {sectionAnalysis?.overall?.body_feel && (
                    <div className="p-3 rounded-xl" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.18)" }}>
                      <div className="text-xs font-semibold mb-1" style={{ color: "#86efac" }}>💚 How your body benefits</div>
                      <p className="text-xs leading-relaxed" style={{ color: "#94a3b8" }}>{sectionAnalysis.overall.body_feel}</p>
                    </div>
                  )}
                  {sectionAnalysis?.overall?.balance_note && (
                    <div className="p-3 rounded-xl" style={{ background: "rgba(20,184,166,0.06)", border: "1px solid rgba(20,184,166,0.18)" }}>
                      <div className="text-xs font-semibold mb-1" style={{ color: "#5eead4" }}>⚖️ Activity balance</div>
                      <p className="text-xs leading-relaxed" style={{ color: "#94a3b8" }}>{sectionAnalysis.overall.balance_note}</p>
                    </div>
                  )}
                  {sectionAnalysis?.overall?.consistency_note && (
                    <div className="text-xs leading-relaxed p-2.5 rounded-lg" style={{ background: "rgba(20,184,166,0.06)", color: "#5eead4" }}>📊 {sectionAnalysis.overall.consistency_note}</div>
                  )}
                </div>
              )}
            </SubCard>

            {/* ── Cardio ── */}
            <SubCard icon="❤️" title="Cardio">
              <div className="grid grid-cols-3 gap-2">
                <StatTile value={`${cardioDays}`} label="Cardio days" sub={`last ${pw}`} color={COLORS.cardio} />
                <StatTile value={`${totalCardio}m`} label="Total cardio" sub="treadmill/bike/etc." color="#fdba74" />
                <StatTile value={cardioDays ? `${Math.round(totalCardio / cardioDays)}m` : "—"} label="Avg / session" sub="cardio minutes" color="#fb923c" />
              </div>
              <Bars buckets={buckets} series={[{ color: COLORS.cardio, value: b => b.cardioMin }]}
                fmt={b => `${b.label}\nCardio: ${b.cardioMin} min`} />
              <Legend items={[{ color: COLORS.cardio, label: "Cardio minutes" }]} />
              <SectionInsightBlock insight={sectionAnalysis?.cardio} />
            </SubCard>

            {/* ── Strength + muscle map ── */}
            <SubCard icon="🏋️" title="Strength &amp; muscles worked">
              <MuscleMap work={muscleWork} />
              <div className="grid grid-cols-3 gap-2">
                <StatTile value={`${strengthDays}`} label="Strength days" sub={`last ${pw}`} color={COLORS.strength} />
                <StatTile value={`${totalSets}`} label="Total sets" sub="resistance work" color="#c4b5fd" />
                <StatTile value={`${totalVolume}`} label="Volume (kg)" sub="reps × weight" color="#ddd6fe" />
              </div>
              <Bars buckets={buckets} series={[{ color: COLORS.strength, value: b => b.strengthSets }]}
                fmt={b => `${b.label}\nSets: ${b.strengthSets}\nVolume: ${Math.round(b.strengthVolume)} kg`} />
              <Legend items={[{ color: COLORS.strength, label: "Sets per period" }]} />
              <SectionInsightBlock insight={sectionAnalysis?.strength} />
            </SubCard>

            {/* ── Indoor (walks + soleus) ── */}
            <SubCard icon="🚶" title="Indoor glucose-control activity">
              <div className="grid grid-cols-3 gap-2">
                <StatTile value={`${days(p => p.walks > 0)}`} label="Walk days" sub={`last ${pw}`} color={COLORS.walk} />
                <StatTile value={`${days(p => p.soleus > 0)}`} label="Soleus days" sub={`last ${pw}`} color={COLORS.soleus} />
                <StatTile value={`${sum(p => p.walks) + sum(p => p.soleus)}`} label="Total sessions" sub="walks + soleus" color="#5eead4" />
              </div>
              <Bars buckets={buckets}
                series={[{ color: COLORS.walk, value: b => b.walkMin }, { color: COLORS.soleus, value: b => b.soleusMin }]}
                fmt={b => `${b.label}\nWalk: ${b.walkMin}m (${b.walks})\nSoleus: ${b.soleusMin}m (${b.soleus})`} />
              <Legend items={[{ color: COLORS.walk, label: "Walk minutes" }, { color: COLORS.soleus, label: "Soleus minutes" }]} />
              <SectionInsightBlock insight={sectionAnalysis?.indoor} />
            </SubCard>

            {/* ── Badminton ── */}
            <SubCard icon="🏸" title="Badminton">
              {badDays === 0 ? (
                <p className="text-xs py-2" style={{ color: "#475569" }}>No badminton logged in the last {pw}. Log a session in the Activity tab to see trends here.</p>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-2">
                    <StatTile value={`${badDays}`} label="Days played" sub={`last ${pw}`} color={COLORS.badminton} />
                    <StatTile value={`${badMin}m`} label="Total time" sub="on court" color="#f9a8d4" />
                    <StatTile value={`${badGames}`} label="Games" sub="played" color="#f472b6" />
                    <StatTile value={badDays ? `${Math.round(badMin / badDays)}m` : "—"} label="Avg / day" sub="court time" color="#fbcfe8" />
                  </div>
                  <Bars buckets={buckets} series={[{ color: COLORS.badminton, value: b => b.badmintonMin }]}
                    markerColor={COLORS.badminton} markerOf={b => b.badmintonGames > 0 ? `${b.badmintonGames}g` : null}
                    fmt={b => `${b.label}\nBadminton: ${b.badmintonMin} min\nGames: ${b.badmintonGames}`} />
                  <Legend items={[{ color: COLORS.badminton, label: "Badminton minutes" }, { color: "#475569", label: "Ng = games" }]} />
                </>
              )}
              <SectionInsightBlock insight={sectionAnalysis?.badminton} />
            </SubCard>
          </>
        )}
      </div>

      {/* ═══ Breathing insights (separate) ═══ */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="section-header">Breathing insights</div>
          {hasBreathData && <PeriodToggle period={breathPeriod} setPeriod={setBreathPeriod} />}
        </div>

        <div className="card p-5 space-y-5">
          <div className="flex items-center gap-2">
            <span className="text-lg">🫁</span>
            <span className="text-sm font-semibold text-white">Breathing practice over time</span>
          </div>

          {loading ? (
            <div className="py-8 text-center text-sm" style={{ color: "#475569" }}>Loading…</div>
          ) : !hasBreathData ? (
            <div className="py-8 text-center space-y-2">
              <div className="text-3xl">🫁</div>
              <div className="text-sm font-medium text-white">No breathing practice logged yet</div>
              <div className="text-xs" style={{ color: "#475569" }}>Log Box (4-4-4-4) and 4-7-8 rounds in the Activity section.</div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-2">
                <StatTile value={String(breathDays)} label="Days practiced" sub={`last ${periodWord(breathPeriod)}`} color="#38bdf8" />
                <StatTile value={avgBox} label="Avg Box / day" sub="4-4-4-4 rounds" color="#7dd3fc" />
                <StatTile value={avgLong} label="Avg 4-7-8 / day" sub="long-exhale rounds" color="#f472b6" />
                <StatTile value={String(totalBreath)} label="Total rounds" sub="box + 4-7-8" color="#c084fc" />
              </div>
              <div>
                <div className="flex items-end gap-1.5" style={{ height: 150 }}>
                  {breathBuckets.map((b, i) => {
                    const seg = (v: number, color: string) => v > 0 ? <div style={{ height: `${(v / maxBreath) * 100}%`, background: color }} /> : null;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                        <div className="w-full flex flex-col justify-end rounded-t overflow-hidden" style={{ height: "100%" }}
                          title={`${b.label}\nBox: ${b.boxRounds}\n4-7-8: ${b.longExhaleRounds}\nTotal: ${b.breathTotal}`}>
                          {seg(b.longExhaleRounds, COLORS.longExhale)}
                          {seg(b.boxRounds, COLORS.box)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-1.5 mt-1.5">
                  {breathBuckets.map((b, i) => (
                    <div key={i} className="flex-1 text-center">
                      <div style={{ height: 6 }}>{b.breathDays > 0 && <span className="text-xs" style={{ color: COLORS.box }}>●{breathPeriod !== "daily" ? b.breathDays : ""}</span>}</div>
                      <div className="text-xs" style={{ color: "#475569", fontSize: 10 }}>{b.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <Legend items={[{ color: COLORS.box, label: "Box 4-4-4-4" }, { color: COLORS.longExhale, label: "4-7-8 long-exhale" }]} />
            </>
          )}

          {breathingAnalysis && (
            <div className="pt-4 space-y-3" style={{ borderTop: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2"><span className="text-base">🧠</span><span className="text-sm font-semibold text-white">AI breathing analysis</span></div>
              {breathingAnalysis.summary && <p className="text-xs leading-relaxed" style={{ color: "#94a3b8" }}>{breathingAnalysis.summary}</p>}
              <div className="grid grid-cols-2 gap-3">
                {(breathingAnalysis.whats_good?.length ?? 0) > 0 && (
                  <div className="p-3 rounded-xl space-y-1.5" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.18)" }}>
                    <div className="text-xs font-semibold" style={{ color: "#86efac" }}>What&apos;s going well</div>
                    {breathingAnalysis.whats_good.map((g, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs"><span style={{ color: "#22c55e" }}>✓</span><span style={{ color: "#94a3b8" }}>{g}</span></div>
                    ))}
                  </div>
                )}
                {(breathingAnalysis.improvements?.length ?? 0) > 0 && (
                  <div className="p-3 rounded-xl space-y-1.5" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)" }}>
                    <div className="text-xs font-semibold" style={{ color: "#fbbf24" }}>Where to improve</div>
                    {breathingAnalysis.improvements.map((g, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs"><span style={{ color: "#f59e0b" }}>↑</span><span style={{ color: "#94a3b8" }}>{g}</span></div>
                    ))}
                  </div>
                )}
              </div>
              {breathingAnalysis.benefit_note && (
                <div className="p-3 rounded-xl" style={{ background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.18)" }}>
                  <div className="text-xs font-semibold mb-1" style={{ color: "#7dd3fc" }}>🫀 Why it helps you</div>
                  <p className="text-xs leading-relaxed" style={{ color: "#94a3b8" }}>{breathingAnalysis.benefit_note}</p>
                </div>
              )}
              {breathingAnalysis.consistency_note && (
                <div className="text-xs leading-relaxed p-2.5 rounded-lg" style={{ background: "rgba(20,184,166,0.06)", color: "#5eead4" }}>📊 {breathingAnalysis.consistency_note}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
