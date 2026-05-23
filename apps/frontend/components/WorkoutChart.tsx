"use client";

export interface WorkoutPhaseChart {
  label: string;
  durationMin: number;
  intensityPct: number;
}

interface WorkoutChartProps {
  phases: WorkoutPhaseChart[];
  sport?: string;
}

const THRESHOLD_LABEL: Record<string, string> = {
  bike: "FTP",
  run: "TP",
  swim: "CSS",
  strength: "MHE",
};

const CHART_W = 700;
const CHART_H = 160;
const PAD_L = 36;
const PAD_R = 36;
const PAD_T = 16;
const PAD_B = 28;
const DRAW_W = CHART_W - PAD_L - PAD_R;
const DRAW_H = CHART_H - PAD_T - PAD_B;

const MAX_PCT = 150;

function phaseColor(pct: number): string {
  if (pct >= 90) return "#f97316"; // orange — threshold / VO2max
  if (pct >= 75) return "#fb923c"; // lighter orange — tempo
  return "#94a3b8"; // slate — base / recovery
}

function formatTime(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}`;
  return `${m}:00`;
}

export function WorkoutChart({ phases, sport }: WorkoutChartProps) {
  if (!phases || phases.length === 0) return null;

  const totalMin = phases.reduce((sum, p) => sum + p.durationMin, 0);
  if (totalMin <= 0) return null;

  const thresholdLabel = THRESHOLD_LABEL[sport ?? ""] ?? "Threshold";

  // Y helpers
  const yPct = (pct: number) => PAD_T + DRAW_H - (pct / MAX_PCT) * DRAW_H;

  // X tick marks: at 0 and each phase boundary
  const ticks: number[] = [0];
  let cum = 0;
  for (const p of phases) {
    cum += p.durationMin;
    ticks.push(cum);
  }

  // Deduplicate ticks that are too close (< 5% of total)
  const minGap = totalMin * 0.05;
  const filteredTicks = ticks.filter((t, i) => {
    if (i === 0 || i === ticks.length - 1) return true;
    return t - ticks[i - 1] >= minGap;
  });

  // Y grid lines at 0%, 50%, 100%, 150%
  const yGridLines = [0, 50, 100, 150];

  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      className="w-full h-auto"
      role="img"
      aria-label="Workout intensity chart"
    >
      {/* Y grid lines */}
      {yGridLines.map((pct) => {
        const y = yPct(pct);
        const isDashed = pct === 100;
        return (
          <g key={pct}>
            <line
              x1={PAD_L}
              y1={y}
              x2={PAD_L + DRAW_W}
              y2={y}
              stroke={isDashed ? "#9ca3af" : "#374151"}
              strokeWidth={isDashed ? 1.5 : 0.75}
              strokeDasharray={isDashed ? "6 4" : undefined}
              opacity={isDashed ? 0.8 : 0.4}
            />
            <text
              x={PAD_L - 4}
              y={y + 4}
              textAnchor="end"
              fontSize={10}
              fill="#6b7280"
            >
              {pct}%
            </text>
          </g>
        );
      })}

      {/* FTP label */}
      <text
        x={PAD_L + DRAW_W + 4}
        y={yPct(100) + 4}
        fontSize={10}
        fill="#9ca3af"
        fontWeight={500}
      >
        {thresholdLabel}
      </text>

      {/* Phase bars */}
      {(() => {
        let x = 0;
        return phases.map((phase, i) => {
          const barX = PAD_L + (x / totalMin) * DRAW_W;
          const barW = (phase.durationMin / totalMin) * DRAW_W;
          const barH = (phase.intensityPct / MAX_PCT) * DRAW_H;
          const barY = PAD_T + DRAW_H - barH;
          x += phase.durationMin;
          return (
            <g key={i}>
              <rect
                x={barX}
                y={barY}
                width={barW}
                height={barH}
                fill={phaseColor(phase.intensityPct)}
                opacity={0.85}
              />
              <title>
                {phase.label} — {phase.durationMin}min @ {phase.intensityPct}%{" "}
                {thresholdLabel}
              </title>
            </g>
          );
        });
      })()}

      {/* X axis */}
      <line
        x1={PAD_L}
        y1={PAD_T + DRAW_H}
        x2={PAD_L + DRAW_W}
        y2={PAD_T + DRAW_H}
        stroke="#374151"
        strokeWidth={0.75}
        opacity={0.5}
      />

      {/* X tick labels */}
      {filteredTicks.map((t) => {
        const tx = PAD_L + (t / totalMin) * DRAW_W;
        return (
          <text
            key={t}
            x={tx}
            y={PAD_T + DRAW_H + 16}
            textAnchor="middle"
            fontSize={10}
            fill="#6b7280"
          >
            {formatTime(t)}
          </text>
        );
      })}
    </svg>
  );
}

const BADGE_LABELS: Record<string, string> = {
  // energy systems
  recovery: "Recovery",
  base: "Base",
  tempo: "Tempo",
  threshold: "Threshold",
  vo2max: "VO₂max",
  anaerobic: "Anaerobic",
  // intensity fallbacks
  easy: "Easy",
  moderate: "Moderate",
  hard: "Hard",
  rest: "Rest",
};

const BADGE_CLASSES: Record<string, string> = {
  // energy systems
  recovery:
    "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-500/30",
  base: "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-500/20 dark:text-teal-300 dark:border-teal-500/30",
  tempo:
    "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30",
  threshold:
    "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/30",
  vo2max:
    "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30",
  anaerobic:
    "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-600/20 dark:text-rose-300 dark:border-rose-600/30",
  // intensity fallbacks
  easy: "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-500/20 dark:text-teal-300 dark:border-teal-500/30",
  moderate:
    "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30",
  hard: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/30",
  rest: "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-500/30",
};

/** @deprecated use BADGE_LABELS */
export const ENERGY_SYSTEM_LABELS = BADGE_LABELS;
/** @deprecated use BADGE_CLASSES */
export const ENERGY_SYSTEM_CLASSES = BADGE_CLASSES;

/** Renders a pill badge for an energySystem key or intensity fallback. */
export function WorkoutBadge({
  energySystem,
  intensity,
  className = "text-xs",
}: {
  energySystem?: string | null;
  intensity?: string | null;
  className?: string;
}) {
  const key = energySystem ?? intensity ?? "";
  const label = BADGE_LABELS[key] ?? key;
  const cls = BADGE_CLASSES[key] ?? "bg-muted/10 text-muted border-border";
  if (!label) return null;
  return (
    <span
      className={`font-semibold px-2 py-0.5 rounded-full border ${cls} ${className}`}
    >
      {label}
    </span>
  );
}
