"use client";
import { useState, useEffect } from "react";
import type { DailyActivityPoint, TrendInsight } from "@/types";
import {
  type Period, periodWindow, periodWord, groupByPeriod,
  PeriodToggle, StatTile, SimpleBarChart, TrendInsightBlock,
} from "@/components/sections/trends-common";

const PURPLE = "#a78bfa";
const QUALITY_META: Record<string, { label: string; color: string }> = {
  excellent: { label: "Excellent", color: "#22c55e" },
  good:      { label: "Good",      color: "#86efac" },
  fair:      { label: "Fair",      color: "#f59e0b" },
  poor:      { label: "Poor",      color: "#ef4444" },
};
const DIP_META: Record<string, { label: string; color: string }> = {
  none:           { label: "None",           color: "#22c55e" },
  controllable:   { label: "Controllable",   color: "#f59e0b" },
  uncontrollable: { label: "Uncontrollable", color: "#ef4444" },
};

export default function SleepTrends({ insight, todayNote }: { insight?: TrendInsight; todayNote?: string }) {
  const [points, setPoints] = useState<DailyActivityPoint[]>([]);
  const [period, setPeriod] = useState<Period>("daily");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/activity-trends?days=180")
      .then(r => r.json())
      .then((d: { data?: DailyActivityPoint[] }) => setPoints(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const groups = groupByPeriod(points, period);
  const avgSleepOf = (items: DailyActivityPoint[]) => {
    const logged = items.filter(p => p.sleepHours > 0);
    return logged.length ? logged.reduce((s, p) => s + p.sleepHours, 0) / logged.length : 0;
  };

  const win = points.slice(-periodWindow(period));
  const sleepDays = win.filter(p => p.sleepHours > 0);
  const avgSleep = sleepDays.length ? (sleepDays.reduce((s, p) => s + p.sleepHours, 0) / sleepDays.length).toFixed(1) : "0";
  const nights7 = win.filter(p => p.sleepHours >= 7).length;
  const napDays = win.filter(p => p.napHours > 0);
  const avgNap = napDays.length ? (napDays.reduce((s, p) => s + p.napHours, 0) / napDays.length).toFixed(1) : "0";

  const qualityCounts: Record<string, number> = {};
  for (const p of win) if (p.sleepQuality) qualityCounts[p.sleepQuality] = (qualityCounts[p.sleepQuality] ?? 0) + 1;
  const qualityTotal = Object.values(qualityCounts).reduce((a, b) => a + b, 0);

  const dipCounts: Record<string, number> = {};
  for (const p of win) if (p.postLunchDip) dipCounts[p.postLunchDip] = (dipCounts[p.postLunchDip] ?? 0) + 1;
  const dipTotal = Object.values(dipCounts).reduce((a, b) => a + b, 0);

  const hasData = points.some(p => p.sleepHours > 0);
  const pw = periodWord(period);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="section-header">Sleep trends</div>
        {hasData && <PeriodToggle period={period} setPeriod={setPeriod} />}
      </div>

      <div className="card p-5 space-y-5">
        <div className="flex items-center gap-2">
          <span className="text-lg">😴</span>
          <span className="text-sm font-semibold text-white">Sleep over time</span>
          <span className="ml-auto text-xs" style={{ color: "#475569" }}>target 7–8 h/night</span>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm" style={{ color: "#475569" }}>Loading…</div>
        ) : !hasData ? (
          <div className="py-8 text-center space-y-2">
            <div className="text-3xl">😴</div>
            <div className="text-sm font-medium text-white">No sleep history yet</div>
            <div className="text-xs" style={{ color: "#475569" }}>Log sleep in the Water &amp; Sleep section over a few days.</div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2">
              <StatTile value={`${avgSleep}h`} label="Avg sleep" sub={`last ${pw}`} color={PURPLE} />
              <StatTile value={`${nights7}`} label="Nights ≥7h" sub={`last ${pw}`} color="#22c55e" />
              <StatTile value={`${avgNap}h`} label="Avg nap" sub={`${napDays.length} nap days`} color="#c4b5fd" />
              <StatTile value={`${dipCounts.uncontrollable ?? 0}`} label="Strong dips" sub="post-lunch" color="#ef4444" />
            </div>

            <SimpleBarChart groups={groups} valueOf={g => avgSleepOf(g.items)} color={PURPLE} target={7}
              fmt={(g, v) => `${g.label}\nAvg sleep: ${v.toFixed(1)}h`} />

            {/* Quality distribution */}
            {qualityTotal > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs" style={{ color: "#64748b" }}>Sleep quality distribution</div>
                <div className="flex rounded-full overflow-hidden" style={{ height: 10 }}>
                  {(["excellent", "good", "fair", "poor"] as const).map(q => {
                    const v = qualityCounts[q] ?? 0;
                    if (v === 0) return null;
                    return <div key={q} style={{ width: `${(v / qualityTotal) * 100}%`, background: QUALITY_META[q].color }} title={`${QUALITY_META[q].label}: ${v} nights`} />;
                  })}
                </div>
                <div className="flex flex-wrap gap-3 text-xs" style={{ color: "#94a3b8" }}>
                  {(["excellent", "good", "fair", "poor"] as const).filter(q => qualityCounts[q]).map(q => (
                    <span key={q} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: QUALITY_META[q].color }} />
                      {QUALITY_META[q].label} ({qualityCounts[q]})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Post-lunch dip distribution */}
            {dipTotal > 0 && (
              <div className="flex flex-wrap gap-3 text-xs items-center" style={{ color: "#94a3b8" }}>
                <span style={{ color: "#64748b" }}>Post-lunch dip:</span>
                {(["none", "controllable", "uncontrollable"] as const).filter(d => dipCounts[d]).map(d => (
                  <span key={d} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: DIP_META[d].color }} />
                    {DIP_META[d].label} ({dipCounts[d]})
                  </span>
                ))}
              </div>
            )}
          </>
        )}

        <TrendInsightBlock insight={insight} todayNote={todayNote} />
      </div>
    </div>
  );
}
