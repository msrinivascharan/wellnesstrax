"use client";
import { MUSCLE_LABELS, MUSCLE_IDS, getMusclesForExercise, type MuscleId } from "@/lib/muscle-map";

/**
 * Front + back body diagram, with each muscle group shaded by how much it was
 * worked (sets) over the selected period. `work` maps muscle id → set count;
 * `exercises` is the list of strength exercises done in the period, used to
 * show which exercises hit each muscle. Untrained muscles are flagged in amber.
 */
export default function MuscleMap({ work, exercises = [] }: { work: Record<string, number>; exercises?: string[] }) {
  const max = Math.max(1, ...MUSCLE_IDS.map(m => work[m] ?? 0));
  const UNTRAINED = "rgba(245,158,11,0.30)"; // amber — not worked this period
  const shade = (id: MuscleId) => {
    const v = work[id] ?? 0;
    if (v <= 0) return UNTRAINED;
    const o = 0.30 + 0.65 * (v / max);
    return `rgba(20,184,166,${o.toFixed(3)})`;
  };
  const tip = (id: MuscleId) => {
    const v = work[id] ?? 0;
    if (v <= 0) return `${MUSCLE_LABELS[id]}: not worked this period`;
    return `${MUSCLE_LABELS[id]}: ${v} sets — ${exercisesFor(id).join(", ") || "—"}`;
  };
  const stroke = "rgba(255,255,255,0.12)";
  const base = "rgba(255,255,255,0.05)";

  // which logged exercises target a given muscle
  function exercisesFor(id: MuscleId): string[] {
    return exercises.filter(ex => getMusclesForExercise(ex).includes(id));
  }

  // muscles ranked for the side legend
  const ranked = MUSCLE_IDS
    .map(m => ({ m, v: work[m] ?? 0 }))
    .sort((a, b) => b.v - a.v);
  const worked = ranked.filter(r => r.v > 0);
  const untrained = ranked.filter(r => r.v === 0).map(r => MUSCLE_LABELS[r.m]);

  return (
    <div className="flex flex-wrap items-start gap-4">
      {/* Front view */}
      <figure className="flex flex-col items-center">
        <svg width="120" height="220" viewBox="0 0 100 200" aria-label="Front muscle map">
          {/* base silhouette */}
          <g fill={base} stroke={stroke} strokeWidth="0.6">
            <circle cx="50" cy="16" r="10" />
            <rect x="34" y="28" width="32" height="56" rx="11" />
            <rect x="20" y="34" width="11" height="54" rx="5" />
            <rect x="69" y="34" width="11" height="54" rx="5" />
            <rect x="36" y="84" width="13" height="82" rx="6" />
            <rect x="51" y="84" width="13" height="82" rx="6" />
          </g>
          {/* muscles */}
          <g stroke={stroke} strokeWidth="0.4">
            {/* shoulders */}
            <ellipse cx="32" cy="38" rx="6" ry="5" fill={shade("shoulders")}><title>{tip("shoulders")}</title></ellipse>
            <ellipse cx="68" cy="38" rx="6" ry="5" fill={shade("shoulders")}><title>{tip("shoulders")}</title></ellipse>
            {/* chest */}
            <rect x="36" y="40" width="12" height="12" rx="3" fill={shade("chest")}><title>{tip("chest")}</title></rect>
            <rect x="52" y="40" width="12" height="12" rx="3" fill={shade("chest")}><title>{tip("chest")}</title></rect>
            {/* biceps */}
            <rect x="21" y="50" width="9" height="16" rx="4" fill={shade("biceps")}><title>{tip("biceps")}</title></rect>
            <rect x="70" y="50" width="9" height="16" rx="4" fill={shade("biceps")}><title>{tip("biceps")}</title></rect>
            {/* forearms */}
            <rect x="21" y="70" width="9" height="16" rx="4" fill={shade("forearms")}><title>{tip("forearms")}</title></rect>
            <rect x="70" y="70" width="9" height="16" rx="4" fill={shade("forearms")}><title>{tip("forearms")}</title></rect>
            {/* abs */}
            <rect x="42" y="55" width="16" height="26" rx="3" fill={shade("abs")}><title>{tip("abs")}</title></rect>
            {/* quads */}
            <rect x="37" y="92" width="11" height="34" rx="5" fill={shade("quads")}><title>{tip("quads")}</title></rect>
            <rect x="52" y="92" width="11" height="34" rx="5" fill={shade("quads")}><title>{tip("quads")}</title></rect>
          </g>
        </svg>
        <figcaption className="text-xs" style={{ color: "#475569" }}>Front</figcaption>
      </figure>

      {/* Back view */}
      <figure className="flex flex-col items-center">
        <svg width="120" height="220" viewBox="0 0 100 200" aria-label="Back muscle map">
          <g fill={base} stroke={stroke} strokeWidth="0.6">
            <circle cx="50" cy="16" r="10" />
            <rect x="34" y="28" width="32" height="56" rx="11" />
            <rect x="20" y="34" width="11" height="54" rx="5" />
            <rect x="69" y="34" width="11" height="54" rx="5" />
            <rect x="36" y="84" width="13" height="82" rx="6" />
            <rect x="51" y="84" width="13" height="82" rx="6" />
          </g>
          <g stroke={stroke} strokeWidth="0.4">
            {/* traps */}
            <rect x="42" y="33" width="16" height="9" rx="3" fill={shade("traps")}><title>{tip("traps")}</title></rect>
            {/* lats */}
            <rect x="36" y="44" width="12" height="18" rx="3" fill={shade("lats")}><title>{tip("lats")}</title></rect>
            <rect x="52" y="44" width="12" height="18" rx="3" fill={shade("lats")}><title>{tip("lats")}</title></rect>
            {/* triceps */}
            <rect x="21" y="50" width="9" height="16" rx="4" fill={shade("triceps")}><title>{tip("triceps")}</title></rect>
            <rect x="70" y="50" width="9" height="16" rx="4" fill={shade("triceps")}><title>{tip("triceps")}</title></rect>
            {/* lower back */}
            <rect x="42" y="64" width="16" height="16" rx="3" fill={shade("lower_back")}><title>{tip("lower_back")}</title></rect>
            {/* glutes */}
            <rect x="37" y="86" width="11" height="16" rx="4" fill={shade("glutes")}><title>{tip("glutes")}</title></rect>
            <rect x="52" y="86" width="11" height="16" rx="4" fill={shade("glutes")}><title>{tip("glutes")}</title></rect>
            {/* hamstrings */}
            <rect x="37" y="106" width="11" height="26" rx="5" fill={shade("hamstrings")}><title>{tip("hamstrings")}</title></rect>
            <rect x="52" y="106" width="11" height="26" rx="5" fill={shade("hamstrings")}><title>{tip("hamstrings")}</title></rect>
            {/* calves */}
            <rect x="37" y="138" width="11" height="24" rx="5" fill={shade("calves")}><title>{tip("calves")}</title></rect>
            <rect x="52" y="138" width="11" height="24" rx="5" fill={shade("calves")}><title>{tip("calves")}</title></rect>
          </g>
        </svg>
        <figcaption className="text-xs" style={{ color: "#475569" }}>Back</figcaption>
      </figure>

      {/* Legend */}
      <div className="flex-1 min-w-[180px] space-y-2.5">
        {/* Colour key */}
        <div className="flex flex-wrap gap-3 text-xs" style={{ color: "#94a3b8" }}>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "#14b8a6" }} />Worked (darker = more)</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: UNTRAINED }} />Not worked</span>
        </div>

        {worked.length === 0 ? (
          <p className="text-xs" style={{ color: "#334155" }}>No resistance training logged in this period.</p>
        ) : (
          <>
            <div className="text-xs font-semibold" style={{ color: "#5eead4" }}>Most worked</div>
            <div className="space-y-2">
              {worked.slice(0, 6).map(({ m, v }) => {
                const exs = exercisesFor(m);
                return (
                  <div key={m} className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 rounded-full overflow-hidden" style={{ height: 6, background: "rgba(255,255,255,0.06)" }}>
                        <div className="h-full rounded-full" style={{ width: `${(v / max) * 100}%`, background: "#14b8a6" }} />
                      </div>
                      <span className="text-xs shrink-0" style={{ color: "#94a3b8", width: 88 }}>{MUSCLE_LABELS[m]}</span>
                      <span className="text-xs shrink-0 tabular-nums" style={{ color: "#14b8a6", width: 38, textAlign: "right" }}>{v} sets</span>
                    </div>
                    {exs.length > 0 && (
                      <div className="flex flex-wrap gap-1 pl-0.5">
                        {exs.map(ex => (
                          <span key={ex} className="text-xs px-1.5 py-0.5 rounded"
                            style={{ background: "rgba(20,184,166,0.08)", color: "#5eead4" }}>{ex}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {untrained.length > 0 && (
              <div className="text-xs pt-1" style={{ color: "#475569" }}>
                <span className="font-semibold" style={{ color: "#f59e0b" }}>Not worked: </span>{untrained.join(", ")}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
