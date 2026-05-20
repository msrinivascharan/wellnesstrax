"use client";
import type { DayLog, MedicationEntry, SupplementEntry } from "@/types";

interface Props {
  dayLog: DayLog;
  onUpdate: (meds: MedicationEntry[], supplements: SupplementEntry[]) => void;
}

const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  CRITICAL: { bg: "rgba(239,68,68,0.08)",  text: "#fca5a5", border: "rgba(239,68,68,0.25)" },
  HIGH:     { bg: "rgba(251,146,60,0.08)", text: "#fdba74", border: "rgba(251,146,60,0.25)" },
  MEDIUM:   { bg: "rgba(250,204,21,0.06)", text: "#fde047", border: "rgba(250,204,21,0.2)"  },
};

export default function MedicationLog({ dayLog, onUpdate }: Props) {
  const { medications, supplements } = dayLog;
  const totalMeds = medications.length + supplements.length;
  const taken = medications.filter(m => m.taken).length + supplements.filter(s => s.taken).length;

  function toggleMed(i: number) {
    const updated = medications.map((m, idx) =>
      idx === i ? { ...m, taken: !m.taken, taken_at: !m.taken ? new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "" } : m
    );
    onUpdate(updated, supplements);
  }

  function setMedTime(i: number, time: string) {
    const updated = medications.map((m, idx) => idx === i ? { ...m, taken_at: time } : m);
    onUpdate(updated, supplements);
  }

  function toggleSupp(i: number) {
    const updated = supplements.map((s, idx) =>
      idx === i ? { ...s, taken: !s.taken, taken_at: !s.taken ? new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "" } : s
    );
    onUpdate(medications, updated);
  }

  function setSuppTime(i: number, time: string) {
    const updated = supplements.map((s, idx) => idx === i ? { ...s, taken_at: time } : s);
    onUpdate(medications, updated);
  }

  const adherencePct = totalMeds > 0 ? Math.round((taken / totalMeds) * 100) : 0;

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

      {/* Medications list */}
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

      {/* Supplements */}
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

      {/* Drug interaction reminder */}
      <div className="card p-4 space-y-2"
        style={{ border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.04)" }}>
        <div className="flex items-center gap-2">
          <span>🚨</span>
          <span className="text-xs font-semibold text-red-400">Critical interaction reminder</span>
        </div>
        <div className="space-y-1 text-xs" style={{ color: "#94a3b8" }}>
          <p>• <strong className="text-red-300">Ticagrelor + Pitavastatin:</strong> STRICTLY NO grapefruit or grapefruit juice — ever</p>
          <p>• <strong className="text-red-300">Thyroxin:</strong> Taken at 5AM on strict empty stomach — no food for 30 min after</p>
          <p>• <strong className="text-orange-300">Metoprolol:</strong> Monitor sodium — keep under 400mg per serving</p>
        </div>
      </div>
    </div>
  );
}
