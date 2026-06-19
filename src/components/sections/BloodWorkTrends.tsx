"use client";
import type { BloodWorkData, UserProfile } from "@/types";

// ─── Date / series helpers ──────────────────────────────────────────────────────
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDate(d: string) { const x = new Date(d + "T12:00:00"); return `${x.getDate()} ${MON[x.getMonth()]}`; }
function fmtFull(d: string) { return new Date(d + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
function daysBetween(a: string, b: string) { return Math.round((new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime()) / 86400000); }
const r1 = (x: number) => Math.round(x * 10) / 10;

type Pt = { date: string; value: number };
/** Sort readings oldest → newest (arrays arrive newest-first). */
function chrono<T extends { test_date: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => a.test_date.localeCompare(b.test_date));
}

type GoodDir = "down" | "up" | "range";
interface Trend {
  first: Pt; last: Pt; prev?: Pt;
  delta: number; pct: number; perWeek: number;
  dir: "improving" | "worsening" | "stable"; days: number; n: number;
}
function analyze(points: Pt[], goodDir: GoodDir, center?: number): Trend | null {
  if (points.length === 0) return null;
  const last = points[points.length - 1];
  const first = points[0];
  const prev = points.length >= 2 ? points[points.length - 2] : undefined;
  const delta = last.value - first.value;
  const pct = first.value !== 0 ? (delta / first.value) * 100 : 0;
  const days = daysBetween(first.date, last.date) || 0;
  const perWeek = days > 0 ? (delta / days) * 7 : 0;
  const eps = Math.max(Math.abs(first.value) * 0.02, 0.01);
  let dir: Trend["dir"];
  if (points.length < 2 || Math.abs(delta) <= eps) dir = "stable";
  else if (goodDir === "down") dir = delta < 0 ? "improving" : "worsening";
  else if (goodDir === "up") dir = delta > 0 ? "improving" : "worsening";
  else if (center != null) {
    // range metric: improving = moving closer to the healthy midpoint
    const dFirst = Math.abs(first.value - center), dLast = Math.abs(last.value - center);
    dir = Math.abs(dLast - dFirst) <= eps ? "stable" : dLast < dFirst ? "improving" : "worsening";
  } else dir = "stable";
  return { first, last, prev, delta, pct, perWeek, dir, days, n: points.length };
}
const DIR_COLOR: Record<string, string> = { improving: "#22c55e", worsening: "#ef4444", stable: "#94a3b8" };
const DIR_WORD: Record<string, string> = { improving: "improving", worsening: "worsening", stable: "steady" };
const numArrow = (d: number) => (d < 0 ? "▼" : d > 0 ? "▲" : "■");

// ─── Line chart with reference band + target line ───────────────────────────────
function LineChart({ points, color, band, target, unit = "", height = 132 }: {
  points: Pt[]; color: string;
  band?: { low?: number; high?: number };   // shaded healthy zone
  target?: number;                           // dashed target line
  unit?: string; height?: number;
}) {
  const pts = points.slice(-12);
  if (pts.length === 0) return null;
  const W = 320, H = height, padL = 6, padR = 6, padT = 14, padB = 20;
  const vals = pts.map(p => p.value);
  const los = [Math.min(...vals)], his = [Math.max(...vals)];
  if (band?.low != null) los.push(band.low);
  if (band?.high != null) { his.push(band.high); los.push(band.high); }
  if (band?.low != null) his.push(band.low);
  if (target != null) { los.push(target); his.push(target); }
  let min = Math.min(...los), max = Math.max(...his);
  const range = (max - min) || Math.abs(max) || 1;
  min -= range * 0.18; max += range * 0.18;
  const span = max - min || 1;
  const X = (i: number) => (pts.length === 1 ? W / 2 : padL + (i / (pts.length - 1)) * (W - padL - padR));
  const Y = (v: number) => padT + (1 - (v - min) / span) * (H - padT - padB);
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${X(i).toFixed(1)} ${Y(p.value).toFixed(1)}`).join(" ");
  const showBand = band && (band.low != null || band.high != null);
  const bandTop = band?.high != null ? Y(band.high) : padT;
  const bandBot = band?.low != null ? Y(band.low) : H - padB;
  const labelIdx = pts.length <= 4 ? pts.map((_, i) => i) : [0, Math.floor((pts.length - 1) / 2), pts.length - 1];
  const lastP = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
      {showBand && (
        <rect x={padL} y={Math.min(bandTop, bandBot)} width={W - padL - padR} height={Math.abs(bandBot - bandTop)}
          fill="rgba(34,197,94,0.10)" />
      )}
      {showBand && band?.high != null && <line x1={padL} x2={W - padR} y1={bandTop} y2={bandTop} stroke="rgba(34,197,94,0.4)" strokeDasharray="3 3" strokeWidth={1} />}
      {showBand && band?.low != null && <line x1={padL} x2={W - padR} y1={bandBot} y2={bandBot} stroke="rgba(34,197,94,0.4)" strokeDasharray="3 3" strokeWidth={1} />}
      {target != null && <line x1={padL} x2={W - padR} y1={Y(target)} y2={Y(target)} stroke="rgba(96,165,250,0.7)" strokeDasharray="4 3" strokeWidth={1} />}
      {pts.length > 1 && <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
      {pts.map((p, i) => <circle key={i} cx={X(i)} cy={Y(p.value)} r={pts.length > 8 ? 2 : 2.8} fill={color} />)}
      <text x={X(pts.length - 1)} y={Math.max(Y(lastP.value) - 6, 10)} textAnchor="end" fontSize={11} fontWeight={700} fill={color}>{lastP.value}{unit}</text>
      {labelIdx.map(i => (
        <text key={i} x={X(i)} y={H - 5} textAnchor={i === 0 ? "start" : i === pts.length - 1 ? "end" : "middle"} fontSize={9} fill="#475569">{fmtDate(pts[i].date)}</text>
      ))}
    </svg>
  );
}

// ─── Small status tile ──────────────────────────────────────────────────────────
function Tile({ label, value, color, minW = 86 }: { label: string; value: string; color: string; minW?: number }) {
  return (
    <div className="text-center px-2.5 py-1.5 rounded-lg" style={{ background: `${color}12`, border: `1px solid ${color}30`, minWidth: minW }}>
      <div className="text-xs whitespace-nowrap" style={{ color: "#64748b" }}>{label}</div>
      <div className="text-sm font-bold" style={{ color }}>{value}</div>
    </div>
  );
}

function InsightRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs leading-relaxed p-2.5 rounded-lg mt-2" style={{ background: "rgba(20,184,166,0.06)", color: "#5eead4", border: "1px solid rgba(20,184,166,0.15)" }}>
      💡 {children}
    </div>
  );
}

function TrendBadge({ t }: { t: Trend | null }) {
  if (!t || t.n < 2) return null;
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: `${DIR_COLOR[t.dir]}18`, color: DIR_COLOR[t.dir] }}>
      {DIR_WORD[t.dir]} · {numArrow(t.delta)}{r1(Math.abs(t.delta))} over {t.n} readings
    </span>
  );
}

function PanelHead({ title, date }: { title: string; date: string }) {
  return (
    <div className="text-xs font-semibold mb-2" style={{ color: "#cbd5e1" }}>
      {title} <span style={{ color: "#475569", fontWeight: 400 }}>· latest {date}</span>
    </div>
  );
}

// ─── Status colour helpers (cardiac-patient targets) ────────────────────────────
const tri = (good: boolean, warn: boolean) => (good ? "#22c55e" : warn ? "#f59e0b" : "#ef4444");
const LIPID_RANGE = {
  ldl:               { label: "LDL", band: { high: 70 }, good: (v: number) => v < 70, warn: (v: number) => v <= 100, dir: "down" as GoodDir },
  hdl:               { label: "HDL", band: { low: 60 }, good: (v: number) => v >= 60, warn: (v: number) => v >= 40, dir: "up" as GoodDir },
  triglycerides:     { label: "Triglycerides", band: { high: 100 }, good: (v: number) => v < 100, warn: (v: number) => v <= 150, dir: "down" as GoodDir },
  total_cholesterol: { label: "Total cholesterol", band: { high: 150 }, good: (v: number) => v < 150, warn: (v: number) => v <= 200, dir: "down" as GoodDir },
};

function bpClass(sys: number, dia: number): { label: string; color: string } {
  if (sys >= 160 || dia >= 100) return { label: "stage-2 high", color: "#ef4444" };
  if (sys >= 140 || dia >= 90) return { label: "stage-1 high", color: "#ef4444" };
  if (sys >= 130 || dia >= 85) return { label: "elevated", color: "#f59e0b" };
  if (sys >= 120) return { label: "high-normal", color: "#f59e0b" };
  return { label: "normal", color: "#22c55e" };
}

// ─── Main component ─────────────────────────────────────────────────────────────
export default function BloodWorkTrends({ bloodWork, profile }: { bloodWork: BloodWorkData; profile: UserProfile }) {
  const lipids = chrono(bloodWork.lipid_profile ?? []);
  const thyroid = chrono(bloodWork.thyroid_profile ?? []);
  const bps = chrono(bloodWork.bp_readings ?? []);
  const weights = chrono(bloodWork.weight_readings ?? []);
  const moods = chrono(bloodWork.mood_entries ?? []);

  const has = lipids.length || thyroid.length || bps.length || weights.length || moods.length;
  if (!has) return null;

  const hFt = profile.height_ft ?? 0;
  const hM = hFt * 0.3048;
  const bmiOf = (kg: number) => (hM > 0 ? r1(kg / (hM * hM)) : null);

  return (
    <div className="card p-4 space-y-5 fade-in-up">
      <div className="flex items-center gap-2">
        <span className="text-lg">🩸</span>
        <span className="text-sm font-semibold text-white">Blood Work &amp; Vitals — trends &amp; insights</span>
      </div>
      <p className="text-xs -mt-3" style={{ color: "#475569" }}>
        Each chart plots your history against cardiac-patient targets — the <span style={{ color: "#86efac" }}>green band</span> is the healthy zone,
        the <span style={{ color: "#60a5fa" }}>blue dashed line</span> is your target. Add entries in Blood Work &amp; Vitals.
      </p>

      {/* ── Weight & BMI ─────────────────────────────────────────────────────── */}
      {weights.length > 0 && (() => {
        const pts: Pt[] = weights.map(w => ({ date: w.test_date, value: w.weight_kg }));
        const latest = weights[weights.length - 1];
        const t = analyze(pts, "down");
        const bmi = bmiOf(latest.weight_kg);
        const target = bloodWork.weight_target_kg ?? undefined;
        const bmiColor = bmi == null ? "#64748b" : bmi >= 18.5 && bmi < 25 ? "#22c55e" : (bmi >= 25 && bmi < 30) || (bmi >= 17 && bmi < 18.5) ? "#f59e0b" : "#ef4444";
        // ETA to target at current weekly rate (only if moving toward it)
        let eta = "";
        if (target != null && t && t.perWeek < -0.05 && latest.weight_kg > target) {
          const weeks = Math.ceil((latest.weight_kg - target) / Math.abs(t.perWeek));
          if (weeks > 0 && weeks < 200) eta = ` At ~${r1(Math.abs(t.perWeek))} kg/week, about ${weeks} week${weeks !== 1 ? "s" : ""} from your ${target} kg target.`;
        } else if (target != null && latest.weight_kg <= target) {
          eta = ` You're at or below your ${target} kg target. 🎉`;
        }
        return (
          <div>
            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
              <PanelHead title="⚖️ Weight & BMI" date={fmtFull(latest.test_date)} />
              <TrendBadge t={t} />
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              <Tile label={target != null ? `Weight (target ${target})` : "Weight"} value={`${latest.weight_kg} kg`} color="#14b8a6" />
              {bmi != null && <Tile label={profile.target_bmi_range ? `BMI (${profile.target_bmi_range})` : "BMI"} value={`${bmi}`} color={bmiColor} />}
              {t && t.n >= 2 && <Tile label="Since start" value={`${numArrow(t.delta)}${r1(Math.abs(t.delta))} kg`} color={DIR_COLOR[t.dir]} />}
            </div>
            {pts.length >= 2 ? <LineChart points={pts} color="#14b8a6" target={target} unit=" kg" /> : <div className="text-xs" style={{ color: "#475569" }}>One reading so far — add another to see the trend.</div>}
            {t && t.n >= 2 && (
              <InsightRow>
                {t.dir === "stable" ? "Weight is holding steady" : `${DIR_WORD[t.dir]} — ${numArrow(t.delta)}${r1(Math.abs(t.delta))} kg (${r1(Math.abs(t.pct))}%)`} over {t.days} days ({t.n} readings).{eta}
              </InsightRow>
            )}
          </div>
        );
      })()}

      {/* ── Blood pressure ───────────────────────────────────────────────────── */}
      {bps.length > 0 && (() => {
        const latest = bps[bps.length - 1];
        const sysPts: Pt[] = bps.map(b => ({ date: b.test_date, value: b.systolic }));
        const diaPts: Pt[] = bps.map(b => ({ date: b.test_date, value: b.diastolic }));
        const tSys = analyze(sysPts, "down");
        const recent = bps.slice(-5);
        const avgSys = Math.round(recent.reduce((s, b) => s + b.systolic, 0) / recent.length);
        const avgDia = Math.round(recent.reduce((s, b) => s + b.diastolic, 0) / recent.length);
        const cls = bpClass(avgSys, avgDia);
        // morning (<12:00) vs later pattern
        const timed = bps.filter(b => b.time && /^\d{1,2}:/.test(b.time));
        let pattern = "";
        if (timed.length >= 4) {
          const am = timed.filter(b => parseInt(b.time!.split(":")[0], 10) < 12);
          const pm = timed.filter(b => parseInt(b.time!.split(":")[0], 10) >= 12);
          if (am.length >= 2 && pm.length >= 2) {
            const amS = Math.round(am.reduce((s, b) => s + b.systolic, 0) / am.length);
            const pmS = Math.round(pm.reduce((s, b) => s + b.systolic, 0) / pm.length);
            if (Math.abs(amS - pmS) >= 6) pattern = ` Pattern: ${amS > pmS ? "mornings" : "afternoons/evenings"} run higher (${Math.max(amS, pmS)} vs ${Math.min(amS, pmS)} systolic).`;
          }
        }
        return (
          <div>
            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
              <PanelHead title="🫀 Blood pressure" date={fmtFull(latest.test_date)} />
              <TrendBadge t={tSys} />
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              <Tile label="Systolic" value={`${latest.systolic}`} color={tri(latest.systolic < 120, latest.systolic <= 139)} minW={78} />
              <Tile label="Diastolic" value={`${latest.diastolic}`} color={tri(latest.diastolic < 80, latest.diastolic <= 89)} minW={78} />
              {latest.pulse != null && <Tile label="Pulse" value={`${latest.pulse}`} color="#94a3b8" minW={70} />}
              <Tile label={`Avg of last ${recent.length}`} value={`${avgSys}/${avgDia}`} color={cls.color} minW={92} />
            </div>
            {bps.length >= 2 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs mb-1" style={{ color: "#64748b" }}>Systolic (target &lt;120)</div>
                  <LineChart points={sysPts} color="#fb923c" band={{ high: 120 }} />
                </div>
                <div>
                  <div className="text-xs mb-1" style={{ color: "#64748b" }}>Diastolic (target &lt;80)</div>
                  <LineChart points={diaPts} color="#60a5fa" band={{ high: 80 }} />
                </div>
              </div>
            ) : <div className="text-xs" style={{ color: "#475569" }}>One reading so far — add another to see the trend.</div>}
            {bps.length >= 2 && (
              <InsightRow>
                Last {recent.length} average <strong style={{ color: cls.color }}>{avgSys}/{avgDia}</strong> ({cls.label}); systolic {DIR_WORD[tSys?.dir ?? "stable"]}.{pattern}
              </InsightRow>
            )}
          </div>
        );
      })()}

      {/* ── Lipid panel ──────────────────────────────────────────────────────── */}
      {lipids.length > 0 && (() => {
        const latest = lipids[lipids.length - 1];
        const keys = Object.keys(LIPID_RANGE) as (keyof typeof LIPID_RANGE)[];
        const ldlT = analyze(lipids.map(l => ({ date: l.test_date, value: l.ldl })), "down");
        const ratioColor = tri(latest.chol_hdl_ratio < 3.5, latest.chol_hdl_ratio <= 5);
        return (
          <div>
            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
              <PanelHead title="🧪 Lipid panel" date={fmtFull(latest.test_date)} />
              <TrendBadge t={ldlT} />
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {keys.map(k => {
                const cfg = LIPID_RANGE[k]; const v = latest[k] as number;
                return <Tile key={k} label={cfg.label} value={`${v}`} color={tri(cfg.good(v), cfg.warn(v))} minW={72} />;
              })}
              <Tile label="Chol/HDL" value={`${latest.chol_hdl_ratio}`} color={ratioColor} minW={72} />
            </div>
            {lipids.length >= 2 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                {keys.map(k => {
                  const cfg = LIPID_RANGE[k];
                  const pts: Pt[] = lipids.map(l => ({ date: l.test_date, value: l[k] as number }));
                  return (
                    <div key={k}>
                      <div className="text-xs mb-1" style={{ color: "#64748b" }}>{cfg.label}</div>
                      <LineChart points={pts} color={k === "ldl" ? "#ef4444" : k === "hdl" ? "#22c55e" : k === "triglycerides" ? "#f59e0b" : "#a78bfa"} band={cfg.band} height={108} />
                    </div>
                  );
                })}
              </div>
            ) : <div className="text-xs" style={{ color: "#475569" }}>One panel so far — add another to see trends.</div>}
            {lipids.length >= 2 && ldlT && (
              <InsightRow>
                LDL is <strong style={{ color: DIR_COLOR[ldlT.dir] }}>{DIR_WORD[ldlT.dir]}</strong> — {numArrow(ldlT.delta)}{Math.abs(Math.round(ldlT.delta))} mg/dL ({r1(Math.abs(ldlT.pct))}%) from {ldlT.first.value} to {ldlT.last.value} over {ldlT.n} panels.
                {latest.ldl < 70 ? " Now within the <70 cardiac target." : latest.ldl <= 100 ? " Approaching the <70 cardiac target." : " Still above the <70 cardiac target — the priority marker."}
              </InsightRow>
            )}
          </div>
        );
      })()}

      {/* ── Thyroid ──────────────────────────────────────────────────────────── */}
      {thyroid.length > 0 && (() => {
        const latest = thyroid[thyroid.length - 1];
        const tshPts: Pt[] = thyroid.map(t => ({ date: t.test_date, value: t.tsh_uiu_ml }));
        const tshT = analyze(tshPts, "range", 1.5);   // 1.5 = midpoint of 0.5–2.5 target
        const tshColor = tri(latest.tsh_uiu_ml >= 0.5 && latest.tsh_uiu_ml <= 2.5, latest.tsh_uiu_ml >= 0.3 && latest.tsh_uiu_ml <= 4.0);
        const inRange = latest.tsh_uiu_ml >= 0.5 && latest.tsh_uiu_ml <= 2.5;
        return (
          <div>
            <PanelHead title="🦋 Thyroid (TSH)" date={fmtFull(latest.test_date)} />
            <div className="flex flex-wrap gap-2 mb-3">
              <Tile label="TSH (0.5–2.5)" value={`${latest.tsh_uiu_ml}`} color={tshColor} minW={92} />
              {latest.t3_ng_ml != null && <Tile label="T3" value={`${latest.t3_ng_ml}`} color={tri(latest.t3_ng_ml >= 0.8 && latest.t3_ng_ml <= 2.0, true)} minW={64} />}
              {latest.t4_ug_dl != null && <Tile label="T4" value={`${latest.t4_ug_dl}`} color={tri(latest.t4_ug_dl >= 5.1 && latest.t4_ug_dl <= 14.1, true)} minW={64} />}
            </div>
            {thyroid.length >= 2 ? <LineChart points={tshPts} color="#a78bfa" band={{ low: 0.5, high: 2.5 }} unit="" /> : <div className="text-xs" style={{ color: "#475569" }}>One test so far — add another to see the trend.</div>}
            {thyroid.length >= 2 && tshT && (
              <InsightRow>
                TSH moved from {tshT.first.value} to {tshT.last.value} over {tshT.n} tests — {inRange ? "currently within the 0.5–2.5 target range." : "currently outside the 0.5–2.5 target range."}
              </InsightRow>
            )}
          </div>
        );
      })()}

      {/* ── Mood ─────────────────────────────────────────────────────────────── */}
      {moods.length > 0 && (() => {
        const latest = moods[moods.length - 1];
        const pts: Pt[] = moods.map(m => ({ date: m.test_date, value: m.valence }));
        const t = analyze(pts, "up");
        const recent = moods.slice(-14);
        const avg = r1(recent.reduce((s, m) => s + m.valence, 0) / recent.length);
        const highStress = recent.filter(m => m.stress === "high").length;
        const stressPct = Math.round((highStress / recent.length) * 100);
        const moodColor = avg >= 4 ? "#22c55e" : avg >= 3 ? "#14b8a6" : avg >= 2 ? "#f59e0b" : "#ef4444";
        return (
          <div>
            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
              <PanelHead title="🧠 Mood" date={fmtFull(latest.test_date)} />
              <TrendBadge t={t} />
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              <Tile label={`Avg of last ${recent.length}`} value={`${avg}/5`} color={moodColor} minW={92} />
              <Tile label="High-stress days" value={`${stressPct}%`} color={stressPct >= 40 ? "#ef4444" : stressPct >= 20 ? "#f59e0b" : "#22c55e"} minW={104} />
            </div>
            {moods.length >= 2 ? <LineChart points={pts} color="#5eead4" band={{ low: 3 }} unit="/5" height={108} /> : <div className="text-xs" style={{ color: "#475569" }}>One check-in so far — add more to see the trend.</div>}
            {moods.length >= 2 && t && (
              <InsightRow>
                Mood is {DIR_WORD[t.dir]} (avg {avg}/5 over last {recent.length}); {stressPct}% logged high stress.
                {stressPct >= 40 ? " Elevated stress is cardiac-relevant — worth watching alongside BP." : ""}
              </InsightRow>
            )}
          </div>
        );
      })()}
    </div>
  );
}
