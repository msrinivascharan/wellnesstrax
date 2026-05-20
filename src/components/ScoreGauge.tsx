"use client";

interface ScoreGaugeProps {
  score: number;
  target: number;
  label: string;
  size?: number;
}

export default function ScoreGauge({ score, target, label, size = 90 }: ScoreGaugeProps) {
  const r = 32;
  const circ = 2 * Math.PI * r;
  const filled = Math.min(score / 100, 1);
  const offset = circ * (1 - filled);

  const color =
    score >= target ? "#22c55e" : score >= target - 10 ? "#f59e0b" : "#ef4444";

  const statusLabel =
    score >= target ? "On target" : score >= target - 10 ? "Close" : "Below target";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox="0 0 80 80">
        {/* Track */}
        <circle cx="40" cy="40" r={r} fill="none" stroke="#1f2937" strokeWidth="7" />
        {/* Progress */}
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 40 40)"
          className="score-ring"
        />
        {/* Score text */}
        <text
          x="40"
          y="37"
          textAnchor="middle"
          fill="white"
          fontSize="17"
          fontWeight="700"
          fontFamily="system-ui"
        >
          {score}
        </text>
        <text
          x="40"
          y="52"
          textAnchor="middle"
          fill="#6b7280"
          fontSize="9"
          fontFamily="system-ui"
        >
          /100
        </text>
      </svg>
      <p className="text-xs font-medium text-gray-300 text-center leading-tight">{label}</p>
      <p className="text-xs text-center" style={{ color }}>
        {statusLabel} (≥{target})
      </p>
    </div>
  );
}
