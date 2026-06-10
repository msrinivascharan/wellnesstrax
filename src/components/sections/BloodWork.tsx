"use client";
import { useState, useEffect, useCallback } from "react";
import type { BloodWorkData, LipidProfile, ThyroidProfile, BloodPressureReading, WeightReading, UserProfile } from "@/types";

// ─── Reference range helpers ──────────────────────────────────────────────────

type Status = "good" | "warn" | "risk";

const LIPID_RANGES: Record<keyof Omit<LipidProfile, "id" | "test_date">, { label: string; unit: string; good: string; status: (v: number) => Status }> = {
  total_cholesterol: {
    label: "Total Cholesterol", unit: "mg/dL", good: "<150 optimal",
    status: v => v < 150 ? "good" : v <= 200 ? "warn" : "risk",
  },
  hdl: {
    label: "HDL (Good Cholesterol)", unit: "mg/dL", good: ">60 optimal",
    status: v => v >= 60 ? "good" : v >= 40 ? "warn" : "risk",
  },
  ldl: {
    label: "LDL (Bad Cholesterol)", unit: "mg/dL", good: "<70 (cardiac target)",
    status: v => v < 70 ? "good" : v <= 100 ? "warn" : "risk",
  },
  vldl: {
    label: "VLDL", unit: "mg/dL", good: "<25 optimal",
    status: v => v < 25 ? "good" : v <= 40 ? "warn" : "risk",
  },
  triglycerides: {
    label: "Triglycerides", unit: "mg/dL", good: "<100 optimal",
    status: v => v < 100 ? "good" : v <= 150 ? "warn" : "risk",
  },
  chol_hdl_ratio: {
    label: "Chol / HDL-C Ratio", unit: "", good: "<3.5 optimal",
    status: v => v < 3.5 ? "good" : v <= 5.0 ? "warn" : "risk",
  },
  non_hdl: {
    label: "Non-HDL-C", unit: "mg/dL", good: "<100 (cardiac target)",
    status: v => v < 100 ? "good" : v <= 130 ? "warn" : "risk",
  },
};

const THYROID_RANGES: Record<keyof Omit<ThyroidProfile, "id" | "test_date">, { label: string; unit: string; good: string; status: (v: number) => Status }> = {
  t3_ng_ml: {
    label: "T3", unit: "ng/mL", good: "0.8 – 2.0",
    status: v => v >= 0.8 && v <= 2.0 ? "good" : v >= 0.6 && v <= 2.5 ? "warn" : "risk",
  },
  t4_ug_dl: {
    label: "T4", unit: "μg/dL", good: "5.1 – 14.1",
    status: v => v >= 5.1 && v <= 14.1 ? "good" : v >= 3.0 && v <= 16.0 ? "warn" : "risk",
  },
  tsh_uiu_ml: {
    label: "TSH", unit: "μIU/mL", good: "0.5 – 2.5",
    status: v => v >= 0.5 && v <= 2.5 ? "good" : v >= 0.3 && v <= 4.0 ? "warn" : "risk",
  },
};

type BpMetric = "systolic" | "diastolic" | "pulse";
const BP_RANGES: Record<BpMetric, { label: string; unit: string; good: string; status: (v: number) => Status }> = {
  systolic: {
    label: "Systolic", unit: "mmHg", good: "<130 (cardiac target)",
    status: v => v < 120 ? "good" : v <= 139 ? "warn" : "risk",
  },
  diastolic: {
    label: "Diastolic", unit: "mmHg", good: "<80 optimal",
    status: v => v < 80 ? "good" : v <= 89 ? "warn" : "risk",
  },
  pulse: {
    label: "Pulse", unit: "bpm", good: "60 – 100",
    status: v => v >= 60 && v <= 100 ? "good" : (v >= 50 && v <= 110) ? "warn" : "risk",
  },
};
const BP_OPTIONAL = new Set<BpMetric>(["pulse"]);

function StatusDot({ s }: { s: Status | "none" }) {
  if (s === "none") return <span className="w-2 h-2 rounded-full shrink-0 inline-block" style={{ background: "#334155" }} />;
  const color = s === "good" ? "#22c55e" : s === "warn" ? "#f59e0b" : "#ef4444";
  return <span className="w-2 h-2 rounded-full shrink-0 inline-block" style={{ background: color }} />;
}

function trendArrow(curr: number, prev: number, higherIsBetter: boolean): string {
  const pct = (curr - prev) / (prev || 1);
  if (Math.abs(pct) < 0.03) return "→";
  const up = pct > 0;
  if (higherIsBetter) return up ? "↑" : "↓";
  return up ? "↑" : "↓";
}

function trendColor(curr: number, prev: number, higherIsBetter: boolean): string {
  const pct = (curr - prev) / (prev || 1);
  if (Math.abs(pct) < 0.03) return "#475569";
  const improved = higherIsBetter ? curr > prev : curr < prev;
  return improved ? "#22c55e" : "#ef4444";
}

// ─── Empty form states ────────────────────────────────────────────────────────

/** Today's date as YYYY-MM-DD — date fields default to today, editable. */
function todayISO() { return new Date().toISOString().split("T")[0]; }

function emptyLipid(): Omit<LipidProfile, "id"> {
  return { test_date: todayISO(), total_cholesterol: 0, hdl: 0, ldl: 0, vldl: 0, triglycerides: 0, chol_hdl_ratio: 0, non_hdl: 0 };
}

// T3 and T4 are optional — not every panel tests them
const THYROID_OPTIONAL = new Set<keyof Omit<ThyroidProfile, "id" | "test_date">>(["t3_ng_ml", "t4_ug_dl"]);

function emptyThyroid(): Omit<ThyroidProfile, "id"> {
  return { test_date: todayISO(), t3_ng_ml: null, t4_ug_dl: null, tsh_uiu_ml: 0 };
}

function emptyBP(): Omit<BloodPressureReading, "id"> {
  return { test_date: todayISO(), systolic: 0, diastolic: 0, pulse: null, arm: null };
}

function emptyWeight(): Omit<WeightReading, "id"> {
  return { test_date: todayISO(), weight_kg: 0 };
}

/** BMI from weight (kg) and height (decimal feet). Returns null if height unknown. */
function calcBMI(weightKg: number, heightFt: number): number | null {
  if (!heightFt || heightFt <= 0 || weightKg <= 0) return null;
  const m = heightFt * 0.3048;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}
function bmiStatus(bmi: number): Status {
  return bmi >= 18.5 && bmi < 25 ? "good" : (bmi >= 25 && bmi < 30) || (bmi >= 17 && bmi < 18.5) ? "warn" : "risk";
}

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

// ─── Main component ────────────────────────────────────────────────────────────

export default function BloodWork({ profile }: { profile?: UserProfile }) {
  const [data, setData]         = useState<BloodWorkData>({ lipid_profile: [], thyroid_profile: [] });
  const [tab, setTab]           = useState<"lipid" | "thyroid" | "bp" | "weight">("lipid");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);

  const [lipidForm, setLipidForm]     = useState(emptyLipid);
  const [thyroidForm, setThyroidForm] = useState(emptyThyroid);
  const [bpForm, setBpForm]           = useState(emptyBP);
  const [weightForm, setWeightForm]   = useState(emptyWeight);
  const [targetInput, setTargetInput] = useState("");

  const persist = useCallback(async (next: BloodWorkData) => {
    setSaving(true);
    try {
      await fetch("/api/bloodwork", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: next }),
      });
    } finally {
      setSaving(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/bloodwork")
      .then(r => r.json())
      .then((d: { data: BloodWorkData }) => {
        setData(d.data);
        setTargetInput(d.data.weight_target_kg != null ? String(d.data.weight_target_kg) : "");
      })
      .catch(() => {});
  }, []);

  function saveLipid() {
    if (!lipidForm.test_date || lipidForm.total_cholesterol <= 0) return;
    const entry: LipidProfile = { id: genId(), ...lipidForm };
    const next: BloodWorkData = {
      ...data,
      lipid_profile: [entry, ...data.lipid_profile].sort((a, b) => b.test_date.localeCompare(a.test_date)),
    };
    setData(next);
    persist(next);
    setLipidForm(emptyLipid());
    setShowForm(false);
  }

  function saveThyroid() {
    if (!thyroidForm.test_date || thyroidForm.tsh_uiu_ml <= 0) return;
    const entry: ThyroidProfile = { id: genId(), ...thyroidForm };
    const next: BloodWorkData = {
      ...data,
      thyroid_profile: [entry, ...data.thyroid_profile].sort((a, b) => b.test_date.localeCompare(a.test_date)),
    };
    setData(next);
    persist(next);
    setThyroidForm(emptyThyroid());
    setShowForm(false);
  }

  function deleteLipid(id: string) {
    const next = { ...data, lipid_profile: data.lipid_profile.filter(e => e.id !== id) };
    setData(next);
    persist(next);
  }

  function deleteThyroid(id: string) {
    const next = { ...data, thyroid_profile: data.thyroid_profile.filter(e => e.id !== id) };
    setData(next);
    persist(next);
  }

  function saveBP() {
    if (!bpForm.test_date || bpForm.systolic <= 0 || bpForm.diastolic <= 0) return;
    const entry: BloodPressureReading = { id: genId(), ...bpForm };
    const next: BloodWorkData = {
      ...data,
      bp_readings: [entry, ...(data.bp_readings ?? [])].sort((a, b) => b.test_date.localeCompare(a.test_date)),
    };
    setData(next);
    persist(next);
    setBpForm(emptyBP());
    setShowForm(false);
  }

  function deleteBP(id: string) {
    const next = { ...data, bp_readings: (data.bp_readings ?? []).filter(e => e.id !== id) };
    setData(next);
    persist(next);
  }

  function saveWeight() {
    if (!weightForm.test_date || weightForm.weight_kg <= 0) return;
    const entry: WeightReading = { id: genId(), ...weightForm };
    const next: BloodWorkData = {
      ...data,
      weight_readings: [entry, ...(data.weight_readings ?? [])].sort((a, b) => b.test_date.localeCompare(a.test_date)),
    };
    setData(next);
    persist(next);
    setWeightForm(emptyWeight());
    setShowForm(false);
  }

  function deleteWeight(id: string) {
    const next = { ...data, weight_readings: (data.weight_readings ?? []).filter(e => e.id !== id) };
    setData(next);
    persist(next);
  }

  function saveTargetWeight() {
    const v = parseFloat(targetInput);
    const target = !isNaN(v) && v > 0 ? Math.round(v * 10) / 10 : null;
    const next = { ...data, weight_target_kg: target };
    setData(next);
    persist(next);
  }

  const lipids   = data.lipid_profile;
  const thyroids = data.thyroid_profile;
  const bps      = data.bp_readings ?? [];
  const weights  = data.weight_readings ?? [];
  const heightFt = profile?.height_ft ?? 0;

  return (
    <div className="p-6 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Blood Work &amp; Vitals</h2>
          <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>
            Track over time — Lipid, Thyroid, Blood Pressure &amp; Weight
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs" style={{ color: "#475569" }}>Saving…</span>}
          <button
            onClick={() => { setShowForm(f => !f); }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ background: "rgba(20,184,166,0.15)", color: "#14b8a6", border: "1px solid rgba(20,184,166,0.35)" }}>
            {showForm ? "✕ Cancel" : "+ Add test result"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(["lipid", "thyroid", "bp", "weight"] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setShowForm(false); }}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={tab === t
              ? { background: "rgba(20,184,166,0.15)", color: "#14b8a6", border: "1px solid rgba(20,184,166,0.35)" }
              : { background: "rgba(255,255,255,0.04)", color: "#64748b", border: "1px solid var(--border)" }}>
            {t === "lipid" ? "🧪 Lipid Profile" : t === "thyroid" ? "🦋 Thyroid Profile" : t === "bp" ? "🩺 Blood Pressure" : "⚖️ Weight"}
          </button>
        ))}
      </div>

      {/* ── Add form ── */}
      {showForm && tab === "lipid" && (
        <div className="card p-4 space-y-4 fade-in-up">
          <div className="section-header">Add lipid profile result</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs mb-1" style={{ color: "#64748b" }}>Test date *</label>
              <input type="date" className="nb-input w-full"
                max={new Date().toISOString().split("T")[0]}
                value={lipidForm.test_date}
                onChange={e => setLipidForm(f => ({ ...f, test_date: e.target.value }))} />
            </div>
            {(Object.keys(LIPID_RANGES) as Array<keyof typeof LIPID_RANGES>).map(k => (
              <div key={k}>
                <label className="block text-xs mb-1" style={{ color: "#64748b" }}>
                  {LIPID_RANGES[k].label} {LIPID_RANGES[k].unit && `(${LIPID_RANGES[k].unit})`}
                </label>
                <input type="number" min="0" step="0.1" className="nb-input w-full"
                  placeholder={{ total_cholesterol: "e.g. 160", hdl: "e.g. 50", ldl: "e.g. 80", vldl: "e.g. 20", triglycerides: "e.g. 120", chol_hdl_ratio: "e.g. 3.2", non_hdl: "e.g. 110" }[k]}
                  value={lipidForm[k] || ""}
                  onChange={e => setLipidForm(f => ({ ...f, [k]: parseFloat(e.target.value) || 0 }))} />
                <div className="text-xs mt-0.5" style={{ color: "#334155" }}>{LIPID_RANGES[k].good}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={saveLipid} disabled={!lipidForm.test_date || lipidForm.total_cholesterol <= 0}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={lipidForm.test_date && lipidForm.total_cholesterol > 0
                ? { background: "rgba(20,184,166,0.15)", color: "#14b8a6", border: "1px solid rgba(20,184,166,0.35)" }
                : { background: "rgba(255,255,255,0.04)", color: "#334155", border: "1px solid var(--border)", cursor: "not-allowed" }}>
              Save result
            </button>
            <button onClick={() => { setShowForm(false); setLipidForm(emptyLipid()); }}
              className="px-4 py-2 rounded-xl text-sm transition-all"
              style={{ background: "rgba(255,255,255,0.04)", color: "#64748b", border: "1px solid var(--border)" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {showForm && tab === "thyroid" && (
        <div className="card p-4 space-y-4 fade-in-up">
          <div className="section-header">Add thyroid profile result</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs mb-1" style={{ color: "#64748b" }}>Test date *</label>
              <input type="date" className="nb-input w-full"
                max={new Date().toISOString().split("T")[0]}
                value={thyroidForm.test_date}
                onChange={e => setThyroidForm(f => ({ ...f, test_date: e.target.value }))} />
            </div>
            {(Object.keys(THYROID_RANGES) as Array<keyof typeof THYROID_RANGES>).map(k => {
              const optional = THYROID_OPTIONAL.has(k);
              return (
                <div key={k}>
                  <label className="block text-xs mb-1" style={{ color: "#64748b" }}>
                    {THYROID_RANGES[k].label} ({THYROID_RANGES[k].unit})
                    {optional && <span className="ml-1" style={{ color: "#334155" }}>— optional</span>}
                  </label>
                  <input type="number" min="0" step="0.01" className="nb-input w-full"
                    placeholder={optional ? "Leave blank if not tested" : "e.g. 1.5"}
                    value={thyroidForm[k] || ""}
                    onChange={e => {
                      const raw = e.target.value;
                      setThyroidForm(f => ({
                        ...f,
                        [k]: raw === "" ? (optional ? null : 0) : parseFloat(raw),
                      }));
                    }} />
                  <div className="text-xs mt-0.5" style={{ color: "#334155" }}>{THYROID_RANGES[k].good}</div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={saveThyroid} disabled={!thyroidForm.test_date || thyroidForm.tsh_uiu_ml <= 0}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={thyroidForm.test_date && thyroidForm.tsh_uiu_ml > 0
                ? { background: "rgba(20,184,166,0.15)", color: "#14b8a6", border: "1px solid rgba(20,184,166,0.35)" }
                : { background: "rgba(255,255,255,0.04)", color: "#334155", border: "1px solid var(--border)", cursor: "not-allowed" }}>
              Save result
            </button>
            <button onClick={() => { setShowForm(false); setThyroidForm(emptyThyroid()); }}
              className="px-4 py-2 rounded-xl text-sm transition-all"
              style={{ background: "rgba(255,255,255,0.04)", color: "#64748b", border: "1px solid var(--border)" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {showForm && tab === "bp" && (
        <div className="card p-4 space-y-4 fade-in-up">
          <div className="section-header">Add blood pressure reading</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs mb-1" style={{ color: "#64748b" }}>Date *</label>
              <input type="date" className="nb-input w-full"
                max={new Date().toISOString().split("T")[0]}
                value={bpForm.test_date}
                onChange={e => setBpForm(f => ({ ...f, test_date: e.target.value }))} />
            </div>
            {(Object.keys(BP_RANGES) as Array<keyof typeof BP_RANGES>).map(k => {
              const optional = BP_OPTIONAL.has(k);
              return (
                <div key={k}>
                  <label className="block text-xs mb-1" style={{ color: "#64748b" }}>
                    {BP_RANGES[k].label} ({BP_RANGES[k].unit})
                    {optional ? <span className="ml-1" style={{ color: "#334155" }}>— optional</span> : " *"}
                  </label>
                  <input type="number" min="0" step="1" className="nb-input w-full"
                    placeholder={optional ? "Leave blank if not measured" : k === "systolic" ? "e.g. 120" : "e.g. 80"}
                    value={bpForm[k] || ""}
                    onChange={e => {
                      const raw = e.target.value;
                      setBpForm(f => ({ ...f, [k]: raw === "" ? (optional ? null : 0) : parseInt(raw) }));
                    }} />
                  <div className="text-xs mt-0.5" style={{ color: "#334155" }}>{BP_RANGES[k].good}</div>
                </div>
              );
            })}
            <div>
              <label className="block text-xs mb-1" style={{ color: "#64748b" }}>
                Cuff arm <span style={{ color: "#334155" }}>— optional</span>
              </label>
              <div className="flex gap-1.5">
                {(["left", "right"] as const).map(a => {
                  const active = bpForm.arm === a;
                  return (
                    <button key={a} type="button"
                      onClick={() => setBpForm(f => ({ ...f, arm: f.arm === a ? null : a }))}
                      className="flex-1 py-2 rounded-xl text-xs font-medium capitalize transition-all"
                      style={active
                        ? { background: "rgba(20,184,166,0.15)", color: "#14b8a6", border: "1px solid rgba(20,184,166,0.4)" }
                        : { background: "rgba(255,255,255,0.03)", color: "#475569", border: "1px solid var(--border)" }}>
                      {a === "left" ? "🫲 Left" : "🫱 Right"}
                    </button>
                  );
                })}
              </div>
              <div className="text-xs mt-0.5" style={{ color: "#334155" }}>Use the same arm for consistent trends</div>
            </div>
          </div>
          {(() => {
            const valid = !!bpForm.test_date && bpForm.systolic > 0 && bpForm.diastolic > 0;
            return (
              <div className="flex gap-2 pt-1">
                <button onClick={saveBP} disabled={!valid}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                  style={valid
                    ? { background: "rgba(20,184,166,0.15)", color: "#14b8a6", border: "1px solid rgba(20,184,166,0.35)" }
                    : { background: "rgba(255,255,255,0.04)", color: "#334155", border: "1px solid var(--border)", cursor: "not-allowed" }}>
                  Save result
                </button>
                <button onClick={() => { setShowForm(false); setBpForm(emptyBP()); }}
                  className="px-4 py-2 rounded-xl text-sm transition-all"
                  style={{ background: "rgba(255,255,255,0.04)", color: "#64748b", border: "1px solid var(--border)" }}>
                  Cancel
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {showForm && tab === "weight" && (
        <div className="card p-4 space-y-4 fade-in-up">
          <div className="section-header">Add weight reading</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: "#64748b" }}>Date *</label>
              <input type="date" className="nb-input w-full"
                max={new Date().toISOString().split("T")[0]}
                value={weightForm.test_date}
                onChange={e => setWeightForm(f => ({ ...f, test_date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "#64748b" }}>Weight (kg) *</label>
              <input type="number" min="0" step="0.1" className="nb-input w-full"
                placeholder="e.g. 78.5"
                value={weightForm.weight_kg || ""}
                onChange={e => setWeightForm(f => ({ ...f, weight_kg: parseFloat(e.target.value) || 0 }))} />
              {(() => {
                const bmi = calcBMI(weightForm.weight_kg, heightFt);
                return bmi ? <div className="text-xs mt-0.5" style={{ color: "#334155" }}>BMI ≈ {bmi}{profile?.target_bmi_range ? ` · target ${profile.target_bmi_range}` : ""}</div> : null;
              })()}
            </div>
          </div>
          {(() => {
            const valid = !!weightForm.test_date && weightForm.weight_kg > 0;
            return (
              <div className="flex gap-2 pt-1">
                <button onClick={saveWeight} disabled={!valid}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                  style={valid
                    ? { background: "rgba(20,184,166,0.15)", color: "#14b8a6", border: "1px solid rgba(20,184,166,0.35)" }
                    : { background: "rgba(255,255,255,0.04)", color: "#334155", border: "1px solid var(--border)", cursor: "not-allowed" }}>
                  Save reading
                </button>
                <button onClick={() => { setShowForm(false); setWeightForm(emptyWeight()); }}
                  className="px-4 py-2 rounded-xl text-sm transition-all"
                  style={{ background: "rgba(255,255,255,0.04)", color: "#64748b", border: "1px solid var(--border)" }}>
                  Cancel
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Lipid history ── */}
      {tab === "lipid" && (
        <div className="space-y-3">
          {lipids.length === 0 ? (
            <div className="card p-8 text-center">
              <div className="text-3xl mb-3">🧪</div>
              <div className="text-sm font-medium text-white">No lipid results yet</div>
              <div className="text-xs mt-1" style={{ color: "#475569" }}>
                Click "+ Add test result" to log your first panel
              </div>
            </div>
          ) : lipids.map((entry, idx) => {
            const prev = lipids[idx + 1];
            return (
              <div key={entry.id} className="card p-4 space-y-3 fade-in-up">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">
                      {new Date(entry.test_date + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                    {idx === 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(20,184,166,0.15)", color: "#14b8a6" }}>
                        Latest
                      </span>
                    )}
                  </div>
                  <button onClick={() => deleteLipid(entry.id)}
                    className="text-xs px-2 py-1 rounded transition-colors hover:bg-red-950/40" style={{ color: "#475569" }}>
                    ✕
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(LIPID_RANGES) as Array<keyof typeof LIPID_RANGES>).map(k => {
                    const val = entry[k] as number;
                    const s   = LIPID_RANGES[k].status(val);
                    const higherBetter = k === "hdl";
                    const trend = prev ? trendArrow(val, prev[k] as number, higherBetter) : null;
                    const tColor = prev ? trendColor(val, prev[k] as number, higherBetter) : "#475569";
                    const statusColor = s === "good" ? "#22c55e" : s === "warn" ? "#f59e0b" : "#ef4444";
                    return (
                      <div key={k} className="flex items-center justify-between p-2 rounded-lg"
                        style={{ background: `${statusColor}08`, border: `1px solid ${statusColor}20` }}>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <StatusDot s={s} />
                            <span className="text-xs truncate" style={{ color: "#94a3b8" }}>{LIPID_RANGES[k].label}</span>
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: "#475569" }}>{LIPID_RANGES[k].good}</div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <span className="text-sm font-bold" style={{ color: statusColor }}>
                            {val}{LIPID_RANGES[k].unit && ` ${LIPID_RANGES[k].unit}`}
                          </span>
                          {trend && (
                            <span className="ml-1 text-xs" style={{ color: tColor }}>{trend}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Overall assessment */}
                {(() => {
                  const riskCount = (Object.keys(LIPID_RANGES) as Array<keyof typeof LIPID_RANGES>).filter(k => LIPID_RANGES[k].status(entry[k] as number) === "risk").length;
                  const warnCount = (Object.keys(LIPID_RANGES) as Array<keyof typeof LIPID_RANGES>).filter(k => LIPID_RANGES[k].status(entry[k] as number) === "warn").length;
                  if (riskCount === 0 && warnCount === 0) return (
                    <div className="text-xs p-2 rounded-lg" style={{ background: "rgba(34,197,94,0.08)", color: "#86efac" }}>
                      ✓ All lipid markers within cardiac-safe targets
                    </div>
                  );
                  return (
                    <div className="text-xs p-2 rounded-lg" style={{ background: "rgba(239,68,68,0.06)", color: "#fca5a5" }}>
                      ⚠ {riskCount > 0 ? `${riskCount} marker${riskCount > 1 ? "s" : ""} at risk` : ""}{riskCount > 0 && warnCount > 0 ? ", " : ""}{warnCount > 0 ? `${warnCount} borderline` : ""} — discuss with cardiologist
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Thyroid history ── */}
      {tab === "thyroid" && (
        <div className="space-y-3">
          {thyroids.length === 0 ? (
            <div className="card p-8 text-center">
              <div className="text-3xl mb-3">🦋</div>
              <div className="text-sm font-medium text-white">No thyroid results yet</div>
              <div className="text-xs mt-1" style={{ color: "#475569" }}>
                Click "+ Add test result" to log your first panel
              </div>
            </div>
          ) : thyroids.map((entry, idx) => {
            const prev = thyroids[idx + 1];
            return (
              <div key={entry.id} className="card p-4 space-y-3 fade-in-up">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">
                      {new Date(entry.test_date + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                    {idx === 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(20,184,166,0.15)", color: "#14b8a6" }}>
                        Latest
                      </span>
                    )}
                  </div>
                  <button onClick={() => deleteThyroid(entry.id)}
                    className="text-xs px-2 py-1 rounded transition-colors hover:bg-red-950/40" style={{ color: "#475569" }}>
                    ✕
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(THYROID_RANGES) as Array<keyof typeof THYROID_RANGES>).map(k => {
                    const rawVal = entry[k];
                    const notTested = rawVal === null || rawVal === undefined;
                    const val = rawVal ?? 0;
                    const s        = notTested ? ("none" as const) : THYROID_RANGES[k].status(val);
                    const prevRaw  = prev ? prev[k] : undefined;
                    const trend    = (!notTested && prev && prevRaw !== null && prevRaw !== undefined)
                      ? trendArrow(val, prevRaw, k !== "tsh_uiu_ml")
                      : null;
                    const tColor   = (!notTested && prev && prevRaw !== null && prevRaw !== undefined)
                      ? trendColor(val, prevRaw, k !== "tsh_uiu_ml")
                      : "#475569";
                    const statusColor = notTested ? "#1e293b"
                      : s === "good" ? "#22c55e" : s === "warn" ? "#f59e0b" : "#ef4444";
                    return (
                      <div key={k} className="p-2.5 rounded-xl text-center"
                        style={{ background: `${statusColor}08`, border: `1px solid ${notTested ? "rgba(255,255,255,0.06)" : `${statusColor}20`}` }}>
                        <StatusDot s={s} />
                        <div className="text-xs mt-1" style={{ color: "#94a3b8" }}>{THYROID_RANGES[k].label}</div>
                        <div className="text-base font-bold mt-0.5" style={{ color: notTested ? "#334155" : statusColor }}>
                          {notTested ? "—" : val}
                          {trend && <span className="text-xs ml-0.5" style={{ color: tColor }}>{trend}</span>}
                        </div>
                        <div className="text-xs" style={{ color: "#475569" }}>
                          {notTested ? "not tested" : THYROID_RANGES[k].unit}
                        </div>
                        {!notTested && (
                          <div className="text-xs mt-0.5" style={{ color: "#334155" }}>{THYROID_RANGES[k].good}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* TSH interpretation — aware of TSH-only panels */}
                {(() => {
                  const tshS    = THYROID_RANGES.tsh_uiu_ml.status(entry.tsh_uiu_ml);
                  const tshOnly = entry.t3_ng_ml === null && entry.t4_ug_dl === null;
                  const testedKeys = (Object.keys(THYROID_RANGES) as Array<keyof typeof THYROID_RANGES>)
                    .filter(k => entry[k] !== null && entry[k] !== undefined);
                  const allGood = testedKeys.every(k => THYROID_RANGES[k].status(entry[k] as number) === "good");
                  if (allGood) return (
                    <div className="text-xs p-2 rounded-lg" style={{ background: "rgba(34,197,94,0.08)", color: "#86efac" }}>
                      ✓ {tshOnly ? "TSH within target range — T3/T4 not tested in this panel" : "Thyroid markers all within target range"}
                    </div>
                  );
                  if (tshS === "risk") return (
                    <div className="text-xs p-2 rounded-lg" style={{ background: "rgba(239,68,68,0.06)", color: "#fca5a5" }}>
                      ⚠ TSH out of target range — thyroid medication dose may need adjustment. Consult your doctor.
                    </div>
                  );
                  return (
                    <div className="text-xs p-2 rounded-lg" style={{ background: "rgba(251,146,60,0.06)", color: "#fdba74" }}>
                      ↗ {tshOnly ? "TSH borderline" : "Some markers borderline"} — monitor at next panel
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Blood pressure history ── */}
      {tab === "bp" && (
        <div className="space-y-3">
          {bps.length === 0 ? (
            <div className="card p-8 text-center">
              <div className="text-3xl mb-3">🩺</div>
              <div className="text-sm font-medium text-white">No blood pressure readings yet</div>
              <div className="text-xs mt-1" style={{ color: "#475569" }}>
                Click &ldquo;+ Add test result&rdquo; to log your first reading
              </div>
            </div>
          ) : bps.map((entry, idx) => {
            const prev = bps[idx + 1];
            return (
              <div key={entry.id} className="card p-4 space-y-3 fade-in-up">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white">
                      {new Date(entry.test_date + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(20,184,166,0.12)", color: "#5eead4" }}>
                      {entry.systolic}/{entry.diastolic} mmHg
                    </span>
                    {entry.arm && (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.05)", color: "#94a3b8" }}>
                        {entry.arm === "left" ? "🫲 Left arm" : "🫱 Right arm"}
                      </span>
                    )}
                    {idx === 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(20,184,166,0.15)", color: "#14b8a6" }}>Latest</span>
                    )}
                  </div>
                  <button onClick={() => deleteBP(entry.id)}
                    className="text-xs px-2 py-1 rounded transition-colors hover:bg-red-950/40" style={{ color: "#475569" }}>✕</button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(BP_RANGES) as Array<keyof typeof BP_RANGES>).map(k => {
                    const rawVal = entry[k];
                    const notMeasured = rawVal === null || rawVal === undefined;
                    const val = rawVal ?? 0;
                    const s = notMeasured ? ("none" as const) : BP_RANGES[k].status(val);
                    const prevRaw = prev ? prev[k] : undefined;
                    const trend = (!notMeasured && prev && prevRaw !== null && prevRaw !== undefined) ? trendArrow(val, prevRaw, false) : null;
                    const tColor = (!notMeasured && prev && prevRaw !== null && prevRaw !== undefined) ? trendColor(val, prevRaw, false) : "#475569";
                    const statusColor = notMeasured ? "#1e293b" : s === "good" ? "#22c55e" : s === "warn" ? "#f59e0b" : "#ef4444";
                    return (
                      <div key={k} className="p-2.5 rounded-xl text-center"
                        style={{ background: `${statusColor}08`, border: `1px solid ${notMeasured ? "rgba(255,255,255,0.06)" : `${statusColor}20`}` }}>
                        <StatusDot s={s} />
                        <div className="text-xs mt-1" style={{ color: "#94a3b8" }}>{BP_RANGES[k].label}</div>
                        <div className="text-base font-bold mt-0.5" style={{ color: notMeasured ? "#334155" : statusColor }}>
                          {notMeasured ? "—" : val}
                          {trend && <span className="text-xs ml-0.5" style={{ color: tColor }}>{trend}</span>}
                        </div>
                        <div className="text-xs" style={{ color: "#475569" }}>{notMeasured ? "not measured" : BP_RANGES[k].unit}</div>
                        {!notMeasured && <div className="text-xs mt-0.5" style={{ color: "#334155" }}>{BP_RANGES[k].good}</div>}
                      </div>
                    );
                  })}
                </div>
                {(() => {
                  const sysS = BP_RANGES.systolic.status(entry.systolic);
                  const diaS = BP_RANGES.diastolic.status(entry.diastolic);
                  const worst = [sysS, diaS].includes("risk") ? "risk" : [sysS, diaS].includes("warn") ? "warn" : "good";
                  if (worst === "good") return (
                    <div className="text-xs p-2 rounded-lg" style={{ background: "rgba(34,197,94,0.08)", color: "#86efac" }}>
                      ✓ Within cardiac target (&lt;130/80 mmHg)
                    </div>
                  );
                  if (worst === "risk") return (
                    <div className="text-xs p-2 rounded-lg" style={{ background: "rgba(239,68,68,0.06)", color: "#fca5a5" }}>
                      ⚠ Elevated — discuss with your cardiologist; review medication, sodium, and stress.
                    </div>
                  );
                  return (
                    <div className="text-xs p-2 rounded-lg" style={{ background: "rgba(251,146,60,0.06)", color: "#fdba74" }}>
                      ↗ Slightly above optimal — monitor and recheck.
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Weight history ── */}
      {tab === "weight" && (
        <div className="space-y-3">
          {/* Target weight */}
          <div className="card p-4 space-y-3" style={{ border: "1px solid rgba(20,184,166,0.15)", background: "rgba(20,184,166,0.03)" }}>
            <div className="flex items-center gap-2">
              <span>🎯</span>
              <span className="text-sm font-semibold text-white">Target weight</span>
              {(() => {
                if (data.weight_target_kg == null || weights.length === 0) return null;
                const latest = weights[0].weight_kg;
                const toGo = Math.round((latest - data.weight_target_kg) * 10) / 10;
                if (toGo === 0) return (
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}>
                    🎉 At target!
                  </span>
                );
                return (
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full"
                    style={{ background: toGo > 0 ? "rgba(245,158,11,0.1)" : "rgba(34,197,94,0.1)", color: toGo > 0 ? "#fbbf24" : "#22c55e" }}>
                    {Math.abs(toGo)} kg {toGo > 0 ? "to lose" : "to gain"}
                  </span>
                );
              })()}
            </div>
            <div className="flex items-center gap-2">
              <input type="number" min="0" step="0.1" className="nb-input"
                style={{ maxWidth: 130 }}
                placeholder="e.g. 75"
                value={targetInput}
                onChange={e => setTargetInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && saveTargetWeight()} />
              <span className="text-sm" style={{ color: "#64748b" }}>kg</span>
              <button onClick={saveTargetWeight}
                className="px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{ background: "rgba(20,184,166,0.15)", color: "#14b8a6", border: "1px solid rgba(20,184,166,0.35)" }}>
                {data.weight_target_kg != null ? "Update target" : "Set target"}
              </button>
              {data.weight_target_kg != null && (
                <button onClick={() => { setTargetInput(""); const next = { ...data, weight_target_kg: null }; setData(next); persist(next); }}
                  className="text-xs px-2 py-1 transition-colors" style={{ color: "#475569" }} title="Clear target">
                  ✕ Clear
                </button>
              )}
              {(() => {
                const v = parseFloat(targetInput);
                const bmi = !isNaN(v) ? calcBMI(v, heightFt) : null;
                return bmi ? <span className="text-xs" style={{ color: "#334155" }}>≈ BMI {bmi}</span> : null;
              })()}
            </div>
          </div>

          {weights.length === 0 ? (
            <div className="card p-8 text-center">
              <div className="text-3xl mb-3">⚖️</div>
              <div className="text-sm font-medium text-white">No weight readings yet</div>
              <div className="text-xs mt-1" style={{ color: "#475569" }}>
                Click &ldquo;+ Add test result&rdquo; to log your first reading
              </div>
            </div>
          ) : weights.map((entry, idx) => {
            const prev = weights[idx + 1];
            const bmi = calcBMI(entry.weight_kg, heightFt);
            const delta = prev ? Math.round((entry.weight_kg - prev.weight_kg) * 10) / 10 : null;
            const bmiS = bmi != null ? bmiStatus(bmi) : "none";
            const bmiColor = bmiS === "none" ? "#475569" : bmiS === "good" ? "#22c55e" : bmiS === "warn" ? "#f59e0b" : "#ef4444";
            return (
              <div key={entry.id} className="card p-4 fade-in-up">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white">
                      {new Date(entry.test_date + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                    {idx === 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(20,184,166,0.15)", color: "#14b8a6" }}>Latest</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-lg font-bold text-white tabular-nums">{entry.weight_kg}</span>
                      <span className="text-xs ml-1" style={{ color: "#64748b" }}>kg</span>
                      {delta !== null && delta !== 0 && (
                        <span className="text-xs ml-1.5" style={{ color: delta < 0 ? "#22c55e" : "#f59e0b" }}>
                          {delta < 0 ? "▼" : "▲"} {Math.abs(delta)}kg
                        </span>
                      )}
                    </div>
                    {bmi != null && (
                      <div className="text-center px-2.5 py-1 rounded-lg" style={{ background: `${bmiColor}10`, border: `1px solid ${bmiColor}25` }}>
                        <div className="text-xs" style={{ color: "#64748b" }}>BMI</div>
                        <div className="text-sm font-bold" style={{ color: bmiColor }}>{bmi}</div>
                      </div>
                    )}
                    <button onClick={() => deleteWeight(entry.id)}
                      className="text-xs px-2 py-1 rounded transition-colors hover:bg-red-950/40" style={{ color: "#475569" }}>✕</button>
                  </div>
                </div>
                {idx === 0 && profile?.target_bmi_range && (
                  <div className="text-xs mt-2" style={{ color: "#475569" }}>Target BMI range: {profile.target_bmi_range}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Reference guide */}
      <div className="card p-4 space-y-2" style={{ border: "1px solid rgba(20,184,166,0.15)", background: "rgba(20,184,166,0.03)" }}>
        <div className="flex items-center gap-2">
          <span>ℹ️</span>
          <span className="text-xs font-semibold" style={{ color: "#14b8a6" }}>Reference ranges are cardiac-patient targets</span>
        </div>
        <div className="text-xs space-y-0.5" style={{ color: "#475569" }}>
          <p>LDL &lt;70 mg/dL is the goal for post-stent patients (more aggressive than general population &lt;100).</p>
          <p>TSH 0.5–2.5 μIU/mL is the typical target while on thyroid replacement therapy.</p>
          <p>Blood pressure &lt;130/80 mmHg is the typical target for post-stent / cardiac patients.</p>
          <p>BMI 18.5–24.9 is the healthy range; lowering an elevated BMI eases cardiac load.</p>
          <p><span className="inline-block w-2 h-2 rounded-full mr-1 bg-green-500" />Within target &nbsp;
             <span className="inline-block w-2 h-2 rounded-full mr-1 bg-yellow-500" />Borderline &nbsp;
             <span className="inline-block w-2 h-2 rounded-full mr-1 bg-red-500" />At risk</p>
        </div>
      </div>
    </div>
  );
}
