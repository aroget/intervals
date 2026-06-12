"use client";

import useSWR from "swr";
import { API_URL, fetcher } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TQComponent {
  score: number;
  weight: number;
  confidence: "low" | "medium" | "high";
  factors: { name: string; value: number; score: number; unit?: string }[];
}

interface TrainingQualityData {
  score: number;
  label: "excellent" | "good" | "fair" | "poor";
  trend: "improving" | "stable" | "declining";
  components: {
    fitnessBase: TQComponent;
    progressiveOverload: TQComponent;
    consistency: TQComponent;
    loadManagement: TQComponent;
  };
  generatedAt: string;
}

interface TrainingQualityCardProps {
  athleteId: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const LABEL_STYLES: Record<string, string> = {
  excellent: "text-teal",
  good: "text-teal",
  fair: "text-orange",
  poor: "text-orange-bright",
};

const SCORE_COLOR = (score: number) =>
  score >= 80
    ? "bg-teal"
    : score >= 65
      ? "bg-teal/70"
      : score >= 50
        ? "bg-orange"
        : "bg-orange-bright";

const TREND_ICON: Record<string, string> = {
  improving: "↑",
  stable: "→",
  declining: "↓",
};

const TREND_COLOR: Record<string, string> = {
  improving: "text-teal",
  stable: "text-muted",
  declining: "text-orange",
};

const COMPONENTS = [
  { key: "fitnessBase", label: "Fitness Base", pct: "25%" },
  { key: "progressiveOverload", label: "Progressive Overload", pct: "30%" },
  { key: "consistency", label: "Consistency", pct: "25%" },
  { key: "loadManagement", label: "Load Management", pct: "20%" },
] as const;

// ── Component ─────────────────────────────────────────────────────────────────

export default function TrainingQualityCard({
  athleteId,
}: TrainingQualityCardProps) {
  const { data, error, isLoading } = useSWR<TrainingQualityData>(
    `${API_URL}/analysis/${athleteId}/training-quality`,
    fetcher,
    { refreshInterval: 0, revalidateOnFocus: false },
  );

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-bg-card px-4 sm:px-6 py-4 sm:py-5 shadow-sm animate-pulse space-y-4">
        <div className="h-3 w-40 rounded bg-border" />
        <div className="h-20 w-20 rounded-full bg-border mx-auto" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-5 rounded bg-border" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data || data.score === undefined) {
    return (
      <div className="rounded-2xl border border-border bg-bg-card px-4 sm:px-6 py-4 sm:py-5 shadow-sm">
        <p className="text-xs font-semibold tracking-[0.15em] uppercase text-muted mb-2">
          Training Quality
        </p>
        <p className="text-sm text-muted">
          No data yet — run today&apos;s analysis to see your score.
        </p>
      </div>
    );
  }

  const { score, label, trend, components } = data;

  // Arc: use a simple SVG ring (cx=50,cy=50,r=40 → circumference≈251)
  const CIRCUMFERENCE = 2 * Math.PI * 40;
  const filled = (score / 100) * CIRCUMFERENCE;
  const gap = CIRCUMFERENCE - filled;

  const ringColor =
    score >= 80
      ? "#0d9488"
      : score >= 65
        ? "#0d9488"
        : score >= 50
          ? "#f97316"
          : "#ef4444";

  return (
    <div className="rounded-2xl border border-border bg-bg-card px-4 sm:px-6 py-4 sm:py-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold tracking-[0.15em] uppercase text-muted">
          Training Quality
        </p>
        <span
          className={`text-xs font-semibold ${TREND_COLOR[trend]}`}
          title={`Trend: ${trend}`}
        >
          {TREND_ICON[trend]} {trend}
        </span>
      </div>

      {/* Score ring + number */}
      <div className="flex items-center gap-6 mb-5">
        <div className="relative w-24 h-24 flex-shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            {/* Track */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="currentColor"
              strokeWidth="10"
              className="text-border"
            />
            {/* Progress */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke={ringColor}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${filled} ${gap}`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold tabular-nums text-text">
              {score}
            </span>
            <span className="text-[10px] text-muted">/100</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-bold capitalize mb-0.5 ${LABEL_STYLES[label]}`}
          >
            {label}
          </p>
          <p className="text-xs text-muted leading-relaxed">
            How well you&apos;re training right now — built from 4 objective
            signals.
          </p>
        </div>
      </div>

      {/* Component bars */}
      <div className="space-y-2.5">
        {COMPONENTS.map(({ key, label: compLabel, pct }) => {
          const comp = components[key as keyof typeof components];
          const s = comp?.score ?? 0;
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-muted">
                  {compLabel}
                  <span className="ml-1 opacity-50">({pct})</span>
                </span>
                <span className="text-[11px] font-semibold tabular-nums text-text">
                  {s}
                  <span className="text-muted">/100</span>
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-border overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${SCORE_COLOR(s)}`}
                  style={{ width: `${s}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
