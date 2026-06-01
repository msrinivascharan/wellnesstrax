"use client";
import type { TrendInsight } from "@/types";

export type Period = "daily" | "weekly" | "monthly";

export function periodWindow(p: Period): number { return p === "daily" ? 14 : p === "weekly" ? 56 : 180; }
export function periodWord(p: Period): string { return p === "daily" ? "14 days" : p === "weekly" ? "8 weeks" : "6 months"; }

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function dmLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getDate()}/${d.getMonth() + 1}`;
}
function startOfWeek(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().split("T")[0];
}

export interface TrendGroup<T> { label: string; items: T[]; }

/** Group dated points into daily (last 14) / weekly (last 8) / monthly (last 6) buckets. */
export function groupByPeriod<T extends { date: string }>(points: T[], period: Period): TrendGroup<T>[] {
  if (period === "daily") {
    return points.slice(-14).map(p => ({ label: dmLabel(p.date), items: [p] }));
  }
  const keyOf = (p: T) => period === "weekly" ? startOfWeek(p.date) : p.date.slice(0, 7);
  const map = new Map<string, T[]>();
  const order: string[] = [];
  for (const p of points) {
    const k = keyOf(p);
    if (!map.has(k)) { map.set(k, []); order.push(k); }
    map.get(k)!.push(p);
  }
  const groups = order.map(k => {
    let label = k;
    if (period === "weekly") label = dmLabel(k);
    else { const [y, m] = k.split("-"); label = `${MONTHS[parseInt(m, 10) - 1]} ${y.slice(2)}`; }
    return { label, items: map.get(k)! };
  });
  return period === "weekly" ? groups.slice(-8) : groups.slice(-6);
}

export function PeriodToggle({ period, setPeriod }: { period: Period; setPeriod: (p: Period) => void }) {
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

export function StatTile({ value, label, sub, color }: { value: string; label: string; sub: string; color: string }) {
  return (
    <div className="p-2.5 rounded-xl text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
      <div className="text-lg font-bold" style={{ color }}>{value}</div>
      <div className="text-xs mt-0.5 text-white">{label}</div>
      <div className="text-xs" style={{ color: "#475569" }}>{sub}</div>
    </div>
  );
}

/** Single-series bar chart with an optional dashed target line. */
export function SimpleBarChart<T>({ groups, valueOf, color, target, fmt, height = 150 }: {
  groups: TrendGroup<T>[];
  valueOf: (g: TrendGroup<T>) => number;
  color: string;
  target?: number;
  fmt?: (g: TrendGroup<T>, v: number) => string;
  height?: number;
}) {
  const vals = groups.map(valueOf);
  const max = Math.max(target ?? 0, 1, ...vals);
  const targetPct = target && target > 0 ? (target / max) * 100 : null;
  return (
    <div>
      <div className="relative flex items-end gap-1.5" style={{ height }}>
        {targetPct != null && (
          <div className="absolute left-0 right-0" style={{ bottom: `${targetPct}%`, borderTop: "1px dashed rgba(96,165,250,0.5)", zIndex: 1 }}>
            <span className="absolute right-0 -top-4 text-xs" style={{ color: "#60a5fa" }}>target</span>
          </div>
        )}
        {groups.map((g, i) => {
          const v = valueOf(g);
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
              <div className="w-full rounded-t" style={{ height: `${(v / max) * 100}%`, background: color }}
                title={fmt ? fmt(g, v) : `${g.label}: ${v}`} />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5 mt-1.5">
        {groups.map((g, i) => (
          <div key={i} className="flex-1 text-center text-xs" style={{ color: "#475569", fontSize: 10 }}>{g.label}</div>
        ))}
      </div>
    </div>
  );
}

/** AI insight block for hydration / sleep (summary + good/improve + consistency). */
export function TrendInsightBlock({ insight, todayNote, todayLabel }: {
  insight?: TrendInsight; todayNote?: string; todayLabel?: string;
}) {
  if (!insight && !todayNote) return null;
  return (
    <div className="pt-4 space-y-3" style={{ borderTop: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2">
        <span className="text-base">🧠</span>
        <span className="text-sm font-semibold text-white">AI analysis</span>
      </div>
      {todayNote && (
        <div className="text-xs leading-relaxed p-2.5 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", color: "#94a3b8", border: "1px solid var(--border)" }}>
          <span className="font-semibold text-white">{todayLabel ?? "Today"}: </span>{todayNote}
        </div>
      )}
      {insight?.summary && <p className="text-xs leading-relaxed" style={{ color: "#94a3b8" }}>{insight.summary}</p>}
      <div className="grid grid-cols-2 gap-3">
        {(insight?.whats_good?.length ?? 0) > 0 && (
          <div className="p-3 rounded-xl space-y-1.5" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.18)" }}>
            <div className="text-xs font-semibold" style={{ color: "#86efac" }}>What&apos;s going well</div>
            {insight!.whats_good.map((g, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs"><span style={{ color: "#22c55e" }}>✓</span><span style={{ color: "#94a3b8" }}>{g}</span></div>
            ))}
          </div>
        )}
        {(insight?.improvements?.length ?? 0) > 0 && (
          <div className="p-3 rounded-xl space-y-1.5" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)" }}>
            <div className="text-xs font-semibold" style={{ color: "#fbbf24" }}>Where to improve</div>
            {insight!.improvements.map((g, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs"><span style={{ color: "#f59e0b" }}>↑</span><span style={{ color: "#94a3b8" }}>{g}</span></div>
            ))}
          </div>
        )}
      </div>
      {insight?.consistency_note && (
        <div className="text-xs leading-relaxed p-2.5 rounded-lg" style={{ background: "rgba(20,184,166,0.06)", color: "#5eead4" }}>📊 {insight.consistency_note}</div>
      )}
    </div>
  );
}
