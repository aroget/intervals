"use client";

import { useState, useEffect } from "react";

interface DataPoint {
  date: string;
  readinessScore: number | null;
  tss: number;
  hrvSevenDayAvg: number | null;
  rhrSevenDayAvg: number | null;
  sleepScoreSevenDayAvg: number | null;
}

export default function RecoveryReadinessChart({
  athleteId,
  days = 30,
}: {
  athleteId: string;
  days?: number;
}) {
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredPoint, setHoveredPoint] = useState<DataPoint | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/analysis/${athleteId}/recovery-readiness-chart?days=${days}`,
    )
      .then((r) => r.json())
      .then((res) => {
        setData(res.data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [athleteId, days]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-teal border-t-transparent rounded-full" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center p-8">
        <p className="text-muted text-sm">
          No readiness data yet. Complete the daily analysis to see trends.
        </p>
      </div>
    );
  }

  const maxTss = Math.max(...data.map((d) => d.tss), 50); // Min 50 for scaling
  const maxReadiness = 100;

  // Get readiness color based on score
  const getReadinessColor = (score: number | null) => {
    if (score === null) return "var(--color-muted)";
    if (score >= 80) return "var(--color-teal)"; // Green - go hard
    if (score >= 55) return "var(--color-orange)"; // Yellow - stay steady
    return "var(--color-peach)"; // Red - rest/recover
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Calculate interval for x-axis labels based on data length to prevent overlap
  const labelInterval =
    data.length > 70
      ? 14
      : data.length > 40
        ? 10
        : data.length > 20
          ? 7
          : data.length > 10
            ? 3
            : 1;

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-teal" />
          <span className="text-muted">High (80-100)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-orange" />
          <span className="text-muted">Moderate (55-79)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-peach" />
          <span className="text-muted">Low/Rest (&lt;55)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-0.5 bg-text opacity-40" />
          <span className="text-muted">Daily TSS (right axis)</span>
        </div>
      </div>

      {/* Chart */}
      <div className="relative h-64">
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="overflow-visible"
        >
          {/* Grid lines */}
          {[0, 25, 50, 75].map((pct) => (
            <line
              key={pct}
              x1="5"
              y1={pct}
              x2="95"
              y2={pct}
              stroke="var(--color-border)"
              strokeWidth="0.2"
              opacity="0.3"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {/* Readiness bars */}
          {data.map((point, i) => {
            const x = 5 + (i / (data.length - 1)) * 90; // 5-95% range
            const barHeight = point.readinessScore
              ? (point.readinessScore / maxReadiness) * 75
              : 0;
            const y = 75 - barHeight;
            const barWidth = (90 / data.length) * 0.6;

            return (
              <g key={i}>
                {/* Readiness bar */}
                <rect
                  x={x - barWidth / 2}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill={getReadinessColor(point.readinessScore)}
                  opacity={hoveredPoint === point ? 1 : 0.8}
                  className="cursor-pointer transition-opacity"
                  onMouseEnter={() => setHoveredPoint(point)}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
              </g>
            );
          })}

          {/* TSS line (using right Y-axis scale) */}
          <polyline
            points={data
              .map((point, i) => {
                const x = 5 + (i / (data.length - 1)) * 90;
                const y = 75 - (point.tss / maxTss) * 75;
                return `${x},${y}`;
              })
              .join(" ")}
            fill="none"
            stroke="var(--color-text)"
            strokeWidth="0.3"
            opacity="0.5"
            vectorEffect="non-scaling-stroke"
          />

          {/* TSS dots */}
          {data.map((point, i) => {
            if (point.tss === 0) return null;
            const x = 5 + (i / (data.length - 1)) * 90;
            const y = 75 - (point.tss / maxTss) * 75;
            return (
              <circle
                key={`tss-${i}`}
                cx={x}
                cy={y}
                r="0.5"
                fill="var(--color-text)"
                opacity="0.6"
              />
            );
          })}

          {/* Invisible hover areas */}
          {data.map((point, i) => {
            const x = 5 + (i / (data.length - 1)) * 90;
            return (
              <rect
                key={`hover-${i}`}
                x={x - 2}
                y="0"
                width="4"
                height="85"
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredPoint(point)}
                onMouseLeave={() => setHoveredPoint(null)}
              />
            );
          })}

          {/* X-axis labels */}
          {data.map((point, i) => {
            if (i % labelInterval !== 0 && i !== data.length - 1) return null;
            const x = 5 + (i / (data.length - 1)) * 90;
            return (
              <text
                key={`label-${i}`}
                x={x}
                y="92"
                textAnchor="middle"
                className="text-[10px] fill-muted font-medium"
                style={{ fontSize: "4.5px" }}
              >
                {formatDate(point.date)}
              </text>
            );
          })}

          {/* Left Y-axis labels (Readiness) */}
          <text
            x="1"
            y="5"
            className="text-xs fill-muted font-medium"
            style={{ fontSize: "4px" }}
          >
            100
          </text>
          <text
            x="1"
            y="40"
            className="text-xs fill-muted font-medium"
            style={{ fontSize: "4px" }}
          >
            50
          </text>
          <text
            x="1"
            y="77"
            className="text-xs fill-muted font-medium"
            style={{ fontSize: "4px" }}
          >
            0
          </text>

          {/* Right Y-axis labels (TSS) */}
          <text
            x="97"
            y="5"
            className="text-xs fill-muted font-medium"
            style={{ fontSize: "4px" }}
            textAnchor="end"
          >
            {Math.round(maxTss)}
          </text>
          <text
            x="97"
            y="40"
            className="text-xs fill-muted font-medium"
            style={{ fontSize: "4px" }}
            textAnchor="end"
          >
            {Math.round(maxTss / 2)}
          </text>
          <text
            x="97"
            y="77"
            className="text-xs fill-muted font-medium"
            style={{ fontSize: "4px" }}
            textAnchor="end"
          >
            0
          </text>
        </svg>

        {/* Tooltip */}
        {hoveredPoint && (
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 bg-bg-card border border-border rounded-lg p-3 shadow-lg z-10 min-w-[200px]">
            <p className="text-xs font-semibold text-muted mb-2">
              {formatDate(hoveredPoint.date)}
            </p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted">Readiness:</span>
                <span className="font-semibold text-teal">
                  {hoveredPoint.readinessScore ?? "—"}/100
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">TSS:</span>
                <span className="font-semibold text-text">
                  {Math.round(hoveredPoint.tss)}
                </span>
              </div>
              {hoveredPoint.hrvSevenDayAvg && (
                <div className="flex justify-between">
                  <span className="text-muted">HRV (7d):</span>
                  <span className="font-semibold text-text">
                    {Math.round(hoveredPoint.hrvSevenDayAvg)} ms
                  </span>
                </div>
              )}
              {hoveredPoint.rhrSevenDayAvg && (
                <div className="flex justify-between">
                  <span className="text-muted">RHR (7d):</span>
                  <span className="font-semibold text-text">
                    {Math.round(hoveredPoint.rhrSevenDayAvg)} bpm
                  </span>
                </div>
              )}
              {hoveredPoint.sleepScoreSevenDayAvg && (
                <div className="flex justify-between">
                  <span className="text-muted">Sleep (7d):</span>
                  <span className="font-semibold text-text">
                    {Math.round(hoveredPoint.sleepScoreSevenDayAvg)}/100
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border">
        <div className="text-center">
          <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted">
            Avg Readiness
          </p>
          <p className="text-xl font-bold tabular-nums text-teal mt-1">
            {Math.round(
              data
                .filter((d) => d.readinessScore)
                .reduce((sum, d) => sum + (d.readinessScore ?? 0), 0) /
                data.filter((d) => d.readinessScore).length,
            )}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted">
            Avg TSS/Day
          </p>
          <p className="text-xl font-bold tabular-nums text-text mt-1">
            {Math.round(data.reduce((sum, d) => sum + d.tss, 0) / data.length)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted">
            Training Days
          </p>
          <p className="text-xl font-bold tabular-nums text-orange mt-1">
            {data.filter((d) => d.tss > 0).length}
          </p>
        </div>
      </div>
    </div>
  );
}
