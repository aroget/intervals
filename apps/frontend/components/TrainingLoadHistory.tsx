"use client";

import { useState, useEffect } from "react";

interface Week {
  weekStart: string;
  totalTss: number;
  activities: number;
  weekType?: string;
  isRecoveryWeek?: boolean;
}

export default function TrainingLoadHistory({
  athleteId,
}: {
  athleteId: string;
}) {
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredWeek, setHoveredWeek] = useState<Week | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/analysis/${athleteId}/training-load-history`,
    )
      .then((r) => r.json())
      .then((data) => {
        setWeeks(data.weeks ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [athleteId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin h-8 w-8 border-4 border-teal border-t-transparent rounded-full" />
      </div>
    );
  }

  if (weeks.length === 0) {
    return (
      <div className="text-center p-8">
        <p className="text-muted text-sm">
          No training data yet. Complete some workouts to see load progression.
        </p>
      </div>
    );
  }

  const maxTss = Math.max(...weeks.map((w) => w.totalTss));
  const avgTss = weeks.reduce((sum, w) => sum + w.totalTss, 0) / weeks.length;

  // Calculate 4-week moving average
  const movingAvg = weeks.map((week, i) => {
    const start = Math.max(0, i - 3);
    const windowWeeks = weeks.slice(start, i + 1);
    return (
      windowWeeks.reduce((sum, w) => sum + w.totalTss, 0) / windowWeeks.length
    );
  });

  // Get week type colors - returns CSS custom property values for SVG fill
  const getWeekColorFill = (week: Week) => {
    if (week.isRecoveryWeek) return "var(--color-peach)";
    if (week.weekType === "peak") return "var(--color-orange-bright)";
    if (week.weekType === "build") return "var(--color-orange)";
    return "var(--color-teal)"; // base
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-bg-assistant p-3 rounded-lg border border-border">
          <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted">
            Peak Week
          </p>
          <p className="text-xl font-bold tabular-nums text-teal mt-1">
            {Math.round(maxTss)}
          </p>
        </div>
        <div className="bg-bg-assistant p-3 rounded-lg border border-border">
          <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted">
            Avg Week
          </p>
          <p className="text-xl font-bold tabular-nums text-text mt-1">
            {Math.round(avgTss)}
          </p>
        </div>
        <div className="bg-bg-assistant p-3 rounded-lg border border-border">
          <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted">
            Last Week
          </p>
          <p className="text-xl font-bold tabular-nums text-orange-bright mt-1">
            {Math.round(weeks[weeks.length - 1].totalTss)}
          </p>
        </div>
      </div>

      {/* Periodized Combo Chart */}
      <div className="bg-bg-assistant p-4 rounded-lg border border-border">
        <h4 className="text-sm font-semibold text-text mb-4">
          Training Load Progression (12-Week View)
        </h4>
        <div className="relative h-64">
          <svg
            viewBox="0 0 100 100"
            className="w-full h-full"
            preserveAspectRatio="none"
            onMouseLeave={() => setHoveredWeek(null)}
          >
            {/* Grid lines */}
            {[0, 25, 50, 75, 100].map((y) => (
              <line
                key={y}
                x1="0"
                y1={100 - y}
                x2="100"
                y2={100 - y}
                stroke="currentColor"
                strokeWidth="0.2"
                className="text-border"
                opacity="0.4"
              />
            ))}

            {/* 4-Week Moving Average Line */}
            <polyline
              points={weeks
                .slice(-12)
                .map((week, i) => {
                  const x = ((i + 0.5) / 12) * 100;
                  const y =
                    100 - (movingAvg[weeks.length - 12 + i] / maxTss) * 100;
                  return `${x},${y}`;
                })
                .join(" ")}
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
              strokeDasharray="2,2"
              className="text-text opacity-60"
            />

            {/* Weekly TSS Bars */}
            {weeks.slice(-12).map((week, i) => {
              const x = (i / 12) * 100;
              const barWidth = (1 / 12) * 100 * 0.8;
              const height = (week.totalTss / maxTss) * 100;
              const fillColor = getWeekColorFill(week);
              const opacity = i >= 8 ? 1 : 0.7;
              const movingAvgValue = Math.round(
                movingAvg[weeks.length - 12 + i],
              );

              return (
                <g key={week.weekStart}>
                  {/* Bar */}
                  <rect
                    x={x + (1 / 12) * 100 * 0.1}
                    y={100 - height}
                    width={barWidth}
                    height={height}
                    fill={fillColor}
                    opacity={opacity}
                    className="cursor-pointer"
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltipPos({
                        x: rect.left + rect.width / 2,
                        y: rect.top,
                      });
                      setHoveredWeek({
                        ...week,
                        movingAvg: movingAvgValue,
                      } as any);
                    }}
                  />
                  {/* Week type marker */}
                  {week.weekType && (
                    <text
                      x={x + (1 / 12) * 100 * 0.5}
                      y="98"
                      fontSize="3"
                      textAnchor="middle"
                      className="text-muted fill-current pointer-events-none"
                    >
                      {week.weekType.charAt(0).toUpperCase()}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Tooltip */}
          {hoveredWeek && (
            <div
              className="fixed z-50 px-3 py-2 bg-bg-card border-2 border-teal rounded-lg shadow-lg text-xs pointer-events-none"
              style={{
                left: `${tooltipPos.x}px`,
                top: `${tooltipPos.y - 10}px`,
                transform: "translate(-50%, -100%)",
              }}
            >
              <div className="font-semibold text-text mb-1">
                {new Date(
                  hoveredWeek.weekStart + "T00:00:00",
                ).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted">TSS:</span>
                  <span className="font-bold text-teal tabular-nums">
                    {Math.round(hoveredWeek.totalTss)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted">4-Week Avg:</span>
                  <span className="font-semibold text-text tabular-nums">
                    {(hoveredWeek as any).movingAvg}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted">Activities:</span>
                  <span className="font-semibold text-text tabular-nums">
                    {hoveredWeek.activities}
                  </span>
                </div>
                {hoveredWeek.weekType && (
                  <div className="mt-1 pt-1 border-t border-border">
                    <span className="capitalize text-xs font-semibold text-teal">
                      {hoveredWeek.weekType} Week
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* X-axis labels */}
        <div className="flex justify-between mt-2 px-1">
          {weeks.slice(-12).map((week, i) => {
            if (i % 2 === 0) {
              return (
                <div key={week.weekStart} className="text-[9px] text-muted">
                  {new Date(week.weekStart + "T00:00:00").toLocaleDateString(
                    "en-US",
                    { month: "short", day: "numeric" },
                  )}
                </div>
              );
            }
            return <div key={week.weekStart} />;
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-teal" />
          <span className="text-muted">Base</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-orange" />
          <span className="text-muted">Build</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-orange-bright" />
          <span className="text-muted">Peak</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-peach" />
          <span className="text-muted">Recovery</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 border-t-2 border-dashed border-text opacity-60" />
          <span className="text-muted">4-Week Avg</span>
        </div>
      </div>

      {/* Insight */}
      <div className="bg-bg-assistant p-4 rounded-lg border border-border">
        <p className="text-xs text-text leading-relaxed">
          {weeks[weeks.length - 1].totalTss > avgTss * 1.2
            ? "📈 High training load this week — monitor recovery closely."
            : weeks[weeks.length - 1].totalTss < avgTss * 0.7
              ? "📉 Low training load — recovery week or training gap?"
              : "✅ Training load is consistent with your recent average."}
        </p>
      </div>
    </div>
  );
}
