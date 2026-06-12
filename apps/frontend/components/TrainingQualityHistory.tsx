"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { API_URL, fetcher } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TQHistoryPoint {
  date: string;
  score: number | null;
  label: string | null;
  trend: string | null;
  fitnessBase: number | null;
  progressiveOverload: number | null;
  consistency: number | null;
  loadManagement: number | null;
}

interface TQHistoryResponse {
  days: number;
  history: TQHistoryPoint[];
}

interface TrainingQualityHistoryProps {
  athleteId: string;
  days?: number;
}

// ── Series config — one source of truth for color, style, label ───────────────

const SERIES = [
  {
    key: "fitnessBase" as const,
    label: "Fitness Base",
    pct: "25%",
    color: "#0d9488",
    dash: undefined,
    width: 2,
  },
  {
    key: "progressiveOverload" as const,
    label: "Progressive Overload",
    pct: "30%",
    color: "#3b82f6",
    dash: undefined,
    width: 2,
  },
  {
    key: "consistency" as const,
    label: "Consistency",
    pct: "25%",
    color: "#94a3b8",
    dash: "4 4",
    width: 2,
  },
  {
    key: "loadManagement" as const,
    label: "Load Management",
    pct: "20%",
    color: "#f59e0b",
    dash: "8 4",
    width: 2,
  },
] as const;

const SCORE_SERIES = {
  key: "score" as const,
  label: "Overall Score",
  color: "#e2e8f0",
  width: 3,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// ── Custom Legend ─────────────────────────────────────────────────────────────

interface LegendProps {
  hoveredKey: string | null;
  onHover: (key: string) => void;
  onLeave: () => void;
}

function CustomLegend({ hoveredKey, onHover, onLeave }: LegendProps) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3 px-1">
      {SERIES.map((s) => {
        const dimmed = hoveredKey !== null && hoveredKey !== s.key;
        return (
          <button
            key={s.key}
            onMouseEnter={() => onHover(s.key)}
            onMouseLeave={onLeave}
            className="flex items-center gap-1.5 transition-opacity cursor-pointer"
            style={{ opacity: dimmed ? 0.3 : 1 }}
          >
            <svg width="22" height="10" aria-hidden="true">
              <line
                x1="0"
                y1="5"
                x2="22"
                y2="5"
                stroke={s.color}
                strokeWidth="2"
                strokeDasharray={s.dash}
              />
            </svg>
            <span className="text-[11px] text-muted">
              {s.label}
              <span className="opacity-50 ml-0.5">({s.pct})</span>
            </span>
          </button>
        );
      })}
      <div className="flex items-center gap-1.5">
        <svg width="22" height="10" aria-hidden="true">
          <line
            x1="0"
            y1="5"
            x2="22"
            y2="5"
            stroke={SCORE_SERIES.color}
            strokeWidth="3"
          />
        </svg>
        <span className="text-[11px] font-semibold text-text">Overall</span>
      </div>
    </div>
  );
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as TQHistoryPoint;
  const dateLabel = label
    ? new Date(label + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "";

  return (
    <div className="rounded-xl border border-border bg-bg-card px-3 py-2.5 shadow-lg text-xs space-y-1">
      <p className="font-semibold text-text">{dateLabel}</p>
      {d.score != null && (
        <p className="font-bold" style={{ color: SCORE_SERIES.color }}>
          Overall: {d.score}/100
          {d.label && (
            <span className="font-normal text-muted ml-1 capitalize">
              — {d.label}
            </span>
          )}
        </p>
      )}
      <div className="border-t border-border pt-1 space-y-0.5">
        {SERIES.map((s) => {
          const val = d[s.key];
          return val != null ? (
            <p key={s.key} style={{ color: s.color }}>
              {s.label}: <span className="font-semibold text-text">{val}</span>
            </p>
          ) : null;
        })}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TrainingQualityHistory({
  athleteId,
  days = 90,
}: TrainingQualityHistoryProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const { data, error, isLoading } = useSWR<TQHistoryResponse>(
    `${API_URL}/analysis/${athleteId}/training-quality/history?days=${days}`,
    fetcher,
    { refreshInterval: 0, revalidateOnFocus: false },
  );

  if (isLoading) {
    return <div className="h-64 rounded-xl bg-border animate-pulse" />;
  }

  if (error || !data?.history?.length) {
    return (
      <p className="text-sm text-muted py-8 text-center">
        No training quality history yet. Scores are computed during daily
        analysis.
      </p>
    );
  }

  const opacity = (key: string): number =>
    hoveredKey === null || hoveredKey === key ? 1 : 0.1;

  return (
    <div className="space-y-1">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart
          data={data.history}
          margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            strokeOpacity={0.12}
            vertical={false}
          />

          {/* Threshold reference lines */}
          <ReferenceLine
            y={80}
            stroke="#0d9488"
            strokeOpacity={0.2}
            strokeDasharray="4 4"
          />
          <ReferenceLine
            y={65}
            stroke="#f59e0b"
            strokeOpacity={0.2}
            strokeDasharray="4 4"
          />
          <ReferenceLine
            y={50}
            stroke="#ef4444"
            strokeOpacity={0.2}
            strokeDasharray="4 4"
          />

          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 10, fill: "var(--muted)" }}
            tickLine={false}
            axisLine={false}
            interval={Math.max(1, Math.floor((data.history.length - 1) / 8))}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: "var(--muted)" }}
            tickLine={false}
            axisLine={false}
            ticks={[0, 50, 65, 80, 100]}
          />

          <Tooltip content={<CustomTooltip />} />

          {/* Component lines — dimmed when another is hovered */}
          {SERIES.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stroke={s.color}
              strokeWidth={s.width}
              strokeDasharray={s.dash}
              strokeOpacity={opacity(s.key)}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: s.color }}
              connectNulls
              isAnimationActive={false}
            />
          ))}

          {/* Overall score — always prominent, on top */}
          <Line
            type="monotone"
            dataKey="score"
            stroke={SCORE_SERIES.color}
            strokeWidth={SCORE_SERIES.width}
            strokeOpacity={opacity("score")}
            dot={false}
            activeDot={{ r: 5, strokeWidth: 0, fill: SCORE_SERIES.color }}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>

      <CustomLegend
        hoveredKey={hoveredKey}
        onHover={setHoveredKey}
        onLeave={() => setHoveredKey(null)}
      />

      <div className="flex gap-5 text-[10px] text-muted flex-wrap pt-1">
        <span>
          <span className="text-teal">━</span> ≥80 Excellent
        </span>
        <span>
          <span className="text-orange">━</span> 65–79 Good
        </span>
        <span>
          <span style={{ color: "#ef4444" }}>━</span> &lt;50 Poor
        </span>
      </div>
    </div>
  );
}
