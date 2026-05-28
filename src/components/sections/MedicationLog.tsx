"use client";
import { useState, useEffect } from "react";
import type { DayLog, MedicationEntry, SupplementEntry, UserProfile } from "@/types";

interface Props {
  dayLog: DayLog;
  profile: UserProfile;
  onUpdate: (meds: MedicationEntry[], supplements: SupplementEntry[]) => void;
}

interface InjectionRecord {
  id: string;
  medication: string;
  dose: string;
  date_given: string;
  notes: string;
  next_due: string;
}

/** Convert "9AM", "1:30PM", "9PM", "1:30 PM post lunch" → "HH:MM" for <input type="time"> */
function scheduledTimeToHHMM(scheduled: string): string {
  const m = scheduled.match(/\b(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\b/i);
  if (!m) return "";
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  if (m[3].toUpperCase() === "PM" && h !== 12) h += 12;
  if (m[3].toUpperCase() === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Add 6 months to a YYYY-MM-DD string */
function addSixMonths(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setMonth(d.getMonth() + 6);
  return d.toISOString().split("T")[0];
}

function injectionStatus(nextDue: string): { label: string; color: string; bg: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(nextDue + "T12:00:00");
  const daysUntil = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntil > 60) return { label: "Not due yet",                color: "#22c55e", bg: "rgba(34,197,94,0.08)"  };
  if (daysUntil >= 0) return { label: `Due in ${daysUntil}d`,      color: "#f59e0b", bg: "rgba(245,158,11,0.08)" };
  return             { label: `Overdue ${Math.abs(daysUntil)}d`,   color: "#ef4444", bg: "rgba(239,68,68,0.08)"  };
}

function formatDate(d: string): string {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function MedicationLog({ dayLog, profile, onUpdate }: Props) {
  // Injectable medication: the one without a scheduled time (e.g. every 6 months)
  const injectableMed = profile.medications.find(m => !m.time);
  const { medications, supplements } = dayLog;
  const totalMeds = medications.length + supplements.length;
  const taken = medications.filter(m => m.taken).length + supplements.filter(s => s.taken).length;

  // ── Injectable meds state ───────────────────────────────────────────────────
  const [injections, setInjections]       = useState<InjectionRecord[]>([]);
  const [injLoading, setInjLoading]       = useState(true);
  const [showAddForm, setShowAddForm]     = useState(false);
  const [formDate, setFormDate]           = useState(() => new Date().toISOString().split("T")[0]);
  const [formDose, setFormDose]           = useState("284mg");
  const [formNotes, setFormNotes]         = useState("");
  const [saving, setSaving]               = useState(false);

  useEffect(() => {
    fetch("/api/injectable-meds")
      .then(r => r.json())
      .then((d: { data?: { injections: InjectionRecord[] } }) => {
        setInjections(d.data?.injections ?? []);
      })
      .catch(() => {})
      .finally(() => setInjLoading(false));
  }, []);

  async function saveInjection() {
    if (!formDate) return;
    setSaving(true);
    const newRec: InjectionRecord = {
      id: `inj_${Date.now()}`,
      medication: injectableMed?.name ?? "Injectable Medication",
      dose: formDose,
      date_given: formDate,
      notes: formNotes,
      next_due: addSixMonths(formDate),
    };
    const updated = [newRec, ...injections];
    try {
      await fetch("/api/injectable-meds", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { injections: updated } }),
      });
      setInjections(updated);
      setShowAddForm(false);
      setFormNotes("");
    } finally {
      setSaving(false);
    }
  }

  // ── Daily med toggle helpers ─────────────────────────────────────────────────
  function toggleMed(i: number) {
    const updated = medications.map((m, idx) =>
      idx === i ? { ...m, taken: !m.taken, taken_at: !m.taken ? scheduledTimeToHHMM(m.scheduled_time) : "" } : m
    );
    onUpdate(updated, supplements);
  }

  function setMedTime(i: number, time: string) {
    const updated = medications.map((m, idx) => idx === i ? { ...m, taken_at: time } : m);
    onUpdate(updated, supplements);
  }

  function toggleSupp(i: number) {
    const updated = supplements.map((s, idx) =>
      idx === i ? { ...s, taken: !s.taken, taken_at: !s.taken ? scheduledTimeToHHMM(s.scheduled_time) : "" } : s
    );
    onUpdate(medications, updated);
  }

  function setSuppTime(i: number, time: string) {
    const updated = supplements.map((s, idx) => idx === i ? { ...s, taken_at: time } : s);
    onUpdate(medications, updated);
  }

  const adherencePct = totalMeds > 0 ? Math.round((taken / totalMeds) * 100) : 0;

  // Latest injection for status display
  const latestInj = injections[0] ?? null;
  const nextDueDate = latestInj?.next_due ?? "";
  const status = nextDueDate ? injectionStatus(nextDueDate) : null;

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Medications</h2>
          <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>
            {taken}/{totalMeds} taken today
          </p>
        </div>
        {/* Adherence ring */}
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-2xl font-bold" style={{ color: adherencePct === 100 ? "#22c55e" : adherencePct >= 60 ? "#f59e0b" : "#ef4444" }}>
              {adherencePct}%
            </div>
            <div className="text-xs" style={{ color: "#475569" }}>Adherence</div>
          </div>
          <svg width="52" height="52" viewBox="0 0 52 52">
            <circle cx="26" cy="26" r="21" fill="none" stroke="#1a2540" strokeWidth="4.5" />
            <circle cx="26" cy="26" r="21" fill="none"
              stroke={adherencePct === 100 ? "#22c55e" : adherencePct >= 60 ? "#f59e0b" : "#ef4444"}
              strokeWidth="4.5" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 21}
              strokeDashoffset={2 * Math.PI * 21 * (1 - adherencePct / 100)}
              transform="rotate(-90 26 26)"
              style={{ transition: "stroke-dashoffset 1s ease" }}
            />
          </svg>
        </div>
      </div>

      {/* ── Medications list ───────────────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="section-header">Prescribed medications</div>
        </div>
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {medications.map((med, i) => (
            <div key={med.name}
              className="px-4 py-3 transition-colors"
              style={{ background: med.taken ? "rgba(34,197,94,0.03)" : undefined }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {/* Toggle */}
                  <button
                    onClick={() => toggleMed(i)}
                    className="mt-0.5 w-5 h-5 rounded-full shrink-0 flex items-center justify-center transition-all"
                    style={med.taken
                      ? { background: "#22c55e", border: "2px solid #22c55e" }
                      : { background: "transparent", border: "2px solid #1e3a5f" }}>
                    {med.taken && <span className="text-xs text-white font-bold">✓</span>}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white">{med.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: "var(--bg-input)", color: "#94a3b8" }}>
                        {med.dose}
                      </span>
                      {med.scheduled_time && (
                        <span className="text-xs" style={{ color: "#475569" }}>📅 {med.scheduled_time}</span>
                      )}
                    </div>
                    {med.condition && (
                      <div className="text-xs mt-0.5" style={{ color: "#475569" }}>{med.condition}</div>
                    )}
                  </div>
                </div>

                {/* Taken-at time */}
                {med.taken && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs" style={{ color: "#64748b" }}>Taken at</span>
                    <input type="time" className="nb-input-sm" style={{ width: 104 }}
                      value={med.taken_at}
                      onChange={e => setMedTime(i, e.target.value)} />
                  </div>
                )}
              </div>

              {/* Status row */}
              <div className="mt-1.5 ml-8">
                {med.taken ? (
                  <span className="text-xs font-medium" style={{ color: "#22c55e" }}>
                    ✓ Taken{med.taken_at ? ` at ${med.taken_at}` : ""}
                  </span>
                ) : (
                  <span className="text-xs" style={{ color: "#475569" }}>Tap the circle when taken</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Supplements ───────────────────────────────────────────────────────── */}
      {supplements.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
            <div className="section-header">Supplements</div>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {supplements.map((s, i) => (
              <div key={s.name}
                className="px-4 py-3 transition-colors"
                style={{ background: s.taken ? "rgba(20,184,166,0.04)" : undefined }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <button
                      onClick={() => toggleSupp(i)}
                      className="mt-0.5 w-5 h-5 rounded-full shrink-0 flex items-center justify-center transition-all"
                      style={s.taken
                        ? { background: "#14b8a6", border: "2px solid #14b8a6" }
                        : { background: "transparent", border: "2px solid #1e3a5f" }}>
                      {s.taken && <span className="text-xs text-white font-bold">✓</span>}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-white">{s.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: "var(--bg-input)", color: "#94a3b8" }}>
                          {s.dose}
                        </span>
                        <span className="text-xs" style={{ color: "#475569" }}>📅 {s.scheduled_time}</span>
                      </div>
                    </div>
                  </div>
                  {s.taken && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs" style={{ color: "#64748b" }}>Taken at</span>
                      <input type="time" className="nb-input-sm" style={{ width: 104 }}
                        value={s.taken_at}
                        onChange={e => setSuppTime(i, e.target.value)} />
                    </div>
                  )}
                </div>
                <div className="mt-1.5 ml-8">
                  {s.taken ? (
                    <span className="text-xs font-medium" style={{ color: "#14b8a6" }}>
                      ✓ Taken{s.taken_at ? ` at ${s.taken_at}` : ""}
                    </span>
                  ) : (
                    <span className="text-xs" style={{ color: "#475569" }}>Tap when taken</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Inclisiran (Injectable) ────────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
          <div>
            <div className="section-header">{injectableMed?.name ?? "Injectable Medication"} — Periodic</div>
            <div className="text-xs mt-0.5" style={{ color: "#475569" }}>
              Every 6 months · LDL-lowering PCSK9 inhibitor
            </div>
          </div>
          <button
            onClick={() => setShowAddForm(v => !v)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={{ background: "rgba(20,184,166,0.12)", color: "#14b8a6", border: "1px solid rgba(20,184,166,0.3)" }}>
            {showAddForm ? "✕ Cancel" : "+ Record dose"}
          </button>
        </div>

        {/* Add form */}
        {showAddForm && (
          <div className="px-4 py-4 border-b space-y-3" style={{ borderColor: "var(--border)", background: "rgba(20,184,166,0.03)" }}>
            <div className="text-xs font-semibold" style={{ color: "#14b8a6" }}>Record new injection</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs" style={{ color: "#64748b" }}>Date given</label>
                <input type="date" className="nb-input w-full"
                  max={new Date().toISOString().split("T")[0]}
                  value={formDate}
                  onChange={e => setFormDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs" style={{ color: "#64748b" }}>Dose</label>
                <input type="text" className="nb-input w-full"
                  value={formDose}
                  onChange={e => setFormDose(e.target.value)}
                  placeholder="e.g. 284mg" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs" style={{ color: "#64748b" }}>Notes (optional)</label>
              <input type="text" className="nb-input w-full"
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                placeholder="e.g. Given at Yashoda hospital, thigh injection" />
            </div>
            {formDate && (
              <div className="text-xs" style={{ color: "#475569" }}>
                Next due will be auto-calculated as: <strong className="text-teal-400">{formatDate(addSixMonths(formDate))}</strong>
              </div>
            )}
            <button
              onClick={saveInjection}
              disabled={saving || !formDate}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={saving || !formDate
                ? { background: "rgba(255,255,255,0.04)", color: "#475569", cursor: "not-allowed" }
                : { background: "rgba(20,184,166,0.2)", color: "#14b8a6", border: "1px solid rgba(20,184,166,0.4)" }}>
              {saving ? "Saving…" : "Save injection record"}
            </button>
          </div>
        )}

        {/* Status / last dose summary */}
        <div className="px-4 py-4">
          {injLoading ? (
            <div className="flex items-center gap-2 text-xs" style={{ color: "#475569" }}>
              <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
              Loading…
            </div>
          ) : latestInj ? (
            <div className="space-y-3">
              {/* Status row */}
              <div className="flex flex-wrap items-center gap-3">
                {status && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                    style={{ background: status.bg, border: `1px solid ${status.color}30` }}>
                    <span className="text-lg">{status.color === "#22c55e" ? "✅" : status.color === "#f59e0b" ? "⚠️" : "🔴"}</span>
                    <div>
                      <div className="text-xs font-bold" style={{ color: status.color }}>{status.label}</div>
                      <div className="text-xs" style={{ color: "#64748b" }}>Next due: {formatDate(nextDueDate)}</div>
                    </div>
                  </div>
                )}
                <div className="text-xs" style={{ color: "#64748b" }}>
                  Last given: <span className="text-white font-medium">{formatDate(latestInj.date_given)}</span>
                  {latestInj.dose && <span className="ml-2 px-2 py-0.5 rounded-full text-xs"
                    style={{ background: "var(--bg-input)", color: "#94a3b8" }}>{latestInj.dose}</span>}
                </div>
              </div>

              {/* History table */}
              {injections.length > 0 && (
                <div>
                  <div className="text-xs font-semibold mb-2" style={{ color: "#475569" }}>Injection history</div>
                  <div className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--border)" }}>
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                          <th className="px-3 py-2 text-left font-semibold" style={{ color: "#64748b" }}>Date</th>
                          <th className="px-3 py-2 text-left font-semibold" style={{ color: "#64748b" }}>Dose</th>
                          <th className="px-3 py-2 text-left font-semibold" style={{ color: "#64748b" }}>Next due</th>
                          <th className="px-3 py-2 text-left font-semibold" style={{ color: "#64748b" }}>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {injections.map((inj, i) => (
                          <tr key={inj.id} style={{ borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>
                            <td className="px-3 py-2 text-white">{formatDate(inj.date_given)}</td>
                            <td className="px-3 py-2" style={{ color: "#94a3b8" }}>{inj.dose || "—"}</td>
                            <td className="px-3 py-2" style={{ color: "#94a3b8" }}>{formatDate(inj.next_due)}</td>
                            <td className="px-3 py-2 truncate max-w-xs" style={{ color: "#64748b" }}>{inj.notes || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4 space-y-2">
              <div className="text-2xl">💉</div>
              <div className="text-sm font-medium" style={{ color: "#64748b" }}>No injections recorded yet</div>
              <div className="text-xs" style={{ color: "#334155" }}>
                Hit &ldquo;+ Record dose&rdquo; above to log your first {injectableMed?.name ?? "injectable medication"} dose.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Drug interaction reminder — built dynamically from profile.medications ── */}
      {profile.medications.some(m => m.interactions.length > 0) && (
        <div className="card p-4 space-y-2"
          style={{ border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.04)" }}>
          <div className="flex items-center gap-2">
            <span>🚨</span>
            <span className="text-xs font-semibold text-red-400">Critical interaction reminder</span>
          </div>
          <div className="space-y-1 text-xs" style={{ color: "#94a3b8" }}>
            {profile.medications
              .filter(m => m.interactions.length > 0)
              .map(med => {
                const topInteraction = med.interactions[0];
                const isCritical = /strictly|critical|never|no\s+grapefruit/i.test(topInteraction);
                const nameColor = isCritical ? "#fca5a5" : "#fdba74";
                return (
                  <p key={med.name}>
                    • <strong style={{ color: nameColor }}>{med.name}:</strong>{" "}
                    {topInteraction}
                  </p>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
