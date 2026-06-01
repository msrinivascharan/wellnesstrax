"use client";
import { useState, useEffect } from "react";
import type { DailyActivityPoint, TrendInsight } from "@/types";
import {
  type Period, periodWindow, periodWord, groupByPeriod,
  PeriodToggle, StatTile, SimpleBarChart, TrendInsightBlock,
} from "@/components/sections/trends-common";

const BLUE = "#60a5fa";

export default function HydrationTrends({ waterTarget, insight, todayNote }: {
  waterTarget: number; insight?: TrendInsight; todayNote?: string;
}) {
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
  const avgWaterOf = (items: DailyActivityPoint[]) => {
    const logged = items.filter(p => p.waterMl > 0);
    return logged.length ? Math.round(logged.reduce((s, p) => s + p.waterMl, 0) / logged.length) : 0;
  };

  const win = points.slice(-periodWindow(period));
  const loggedDays = win.filter(p => p.waterMl > 0);
  const avgWater = loggedDays.length ? Math.round(loggedDays.reduce((s, p) => s + p.waterMl, 0) / loggedDays.length) : 0;
  const targetMet = waterTarget > 0 ? win.filter(p => p.waterMl >= waterTarget).length : 0;
  const bestDay = win.reduce((m, p) => Math.max(m, p.waterMl), 0);
  const hasData = points.some(p => p.waterMl > 0);
  const pw = periodWord(period);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="section-header">Hydration trends</div>
        {hasData && <PeriodToggle period={period} setPeriod={setPeriod} />}
      </div>

      <div className="card p-5 space-y-5">
        <div className="flex items-center gap-2">
          <span className="text-lg">💧</span>
          <span className="text-sm font-semibold text-white">Water intake over time</span>
          <span className="ml-auto text-xs" style={{ color: "#475569" }}>target {waterTarget}ml/day</span>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm" style={{ color: "#475569" }}>Loading…</div>
        ) : !hasData ? (
          <div className="py-8 text-center space-y-2">
            <div className="text-3xl">💧</div>
            <div className="text-sm font-medium text-white">No hydration history yet</div>
            <div className="text-xs" style={{ color: "#475569" }}>Log water in the Water &amp; Sleep section over a few days.</div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2">
              <StatTile value={`${avgWater}`} label="Avg ml/day" sub={`last ${pw}`} color={BLUE} />
              <StatTile value={`${targetMet}`} label="Target met" sub={`days, last ${pw}`} color="#22c55e" />
              <StatTile value={`${bestDay}`} label="Best day" sub="ml" color="#93c5fd" />
              <StatTile value={`${loggedDays.length}`} label="Days logged" sub={`last ${pw}`} color="#3b82f6" />
            </div>
            <SimpleBarChart groups={groups} valueOf={g => avgWaterOf(g.items)} color={BLUE} target={waterTarget}
              fmt={(g, v) => `${g.label}\nAvg water: ${v}ml\nTarget: ${waterTarget}ml`} />
            <div className="text-xs" style={{ color: "#475569" }}>Bars show average daily intake; the dashed line is your {waterTarget}ml target.</div>
          </>
        )}

        <TrendInsightBlock insight={insight} todayNote={todayNote} />
      </div>
    </div>
  );
}
