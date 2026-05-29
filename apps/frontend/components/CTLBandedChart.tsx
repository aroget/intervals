"use client";

import { useState } from "react";

interface FitnessCheckpoint {
  date: string;
  weekInBlock: number;
  weekType: string;
  expectedCtl: number;
  actualCtl: number;
  deviation: number;
  trend: string;
  note: string;
}

export default function CTLBandedChart({
  checkpoints,
  baselineCtl,
}: {
  checkpoints: FitnessCheckpoint[];
  baselineCtl: number;
}) {
  const [hoveredCheckpoint, setHoveredCheckpoint] =
    useState<FitnessCheckpoint | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  if (checkpoints.length === 0) {
    return (
      <div className="border border-border rounded-lg p-8 bg-bg-assistant text-center">
        <p className="text-sm text-muted">
          No fitness trajectory data available yet.
        </p>
        <p className="text-xs text-muted mt-2">
          Complete workouts to track your CTL progression.
        </p>
      </div>
    );
  }

  // Calculate bounds for the chart
  const allValues = [
    ...checkpoints.map((c) => c.expectedCtl),
    ...checkpoints.map((c) => c.actualCtl),
    baselineCtl,
  ];
  const minCtl = Math.floor(Math.min(...allValues) * 0.95);
  const maxCtl = Math.ceil(Math.max(...allValues) * 1.05);
  const range = maxCtl - minCtl;

  // Create tolerance band (±5% of expected)
  const getYPosition = (value: number) => {
    return 100 - ((value - minCtl) / range) * 100;
  };

  // Generate band path (expected ±5%)
  const bandPoints = checkpoints.map((checkpoint, i) => {
    const x = 5 + (i / (checkpoints.length - 1)) * 90; // Use 5-95 range for chart
    const upperBound = checkpoint.expectedCtl * 1.05;
    const lowerBound = checkpoint.expectedCtl * 0.95;
    return {
      x,
      upper: getYPosition(upperBound),
      lower: getYPosition(lowerBound),
    };
  });

  const upperPath = `M ${bandPoints.map((p) => `${p.x},${p.upper}`).join(" L ")}`;
  const lowerPath = `M ${bandPoints.map((p) => `${p.x},${p.lower}`).join(" L ")}`;
  const bandPath = `${upperPath} L ${[...bandPoints]
    .reverse()
    .map((p) => `${p.x},${p.lower}`)
    .join(" L ")} Z`;

  // Generate actual CTL line
  const actualPath = `M ${checkpoints
    .map((checkpoint, i) => {
      const x = 5 + (i / (checkpoints.length - 1)) * 90; // Use 5-95 range
      const y = getYPosition(checkpoint.actualCtl);
      return `${x},${y}`;
    })
    .join(" L ")}`;

  // Generate expected CTL line
  const expectedPath = `M ${checkpoints
    .map((checkpoint, i) => {
      const x = 5 + (i / (checkpoints.length - 1)) * 90; // Use 5-95 range
      const y = getYPosition(checkpoint.expectedCtl);
      return `${x},${y}`;
    })
    .join(" L ")}`;

  return (
    <div className="space-y-4">
      <div className="bg-bg-assistant p-4 rounded-lg border border-border">
        <div className="relative h-64">
          <svg
            viewBox="0 0 100 100"
            className="w-full h-full"
            preserveAspectRatio="none"
            onMouseLeave={() => setHoveredCheckpoint(null)}
          >
            {/* Grid lines */}
            {[0, 25, 50, 75, 100].map((y) => (
              <line
                key={y}
                x1="5"
                y1={y}
                x2="95"
                y2={y}
                stroke="currentColor"
                strokeWidth="0.2"
                className="text-border"
                opacity="0.4"
              />
            ))}

            {/* Tolerance band (±5% of expected) */}
            <path
              d={bandPath}
              fill="currentColor"
              className="text-teal opacity-10"
            />

            {/* Expected CTL line */}
            <path
              d={expectedPath}
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
              strokeDasharray="2,2"
              className="text-teal opacity-60"
            />

            {/* Actual CTL line */}
            <path
              d={actualPath}
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              className="text-teal"
            />

            {/* Data points with status indicators */}
            {checkpoints.map((checkpoint, i) => {
              const x = 5 + (i / (checkpoints.length - 1)) * 90; // Use 5-95 range
              const y = getYPosition(checkpoint.actualCtl);
              const isAhead = checkpoint.trend === "ahead";
              const isOnTrack = checkpoint.trend === "on_track";
              const isBehind = checkpoint.trend === "behind";

              return (
                <g key={checkpoint.date}>
                  {/* Point circle */}
                  <circle
                    cx={x}
                    cy={y}
                    r="1.5"
                    className={`cursor-pointer ${
                      isBehind
                        ? "fill-orange-bright"
                        : isAhead
                          ? "fill-teal"
                          : "fill-text"
                    }`}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltipPos({ x: rect.left, y: rect.top });
                      setHoveredCheckpoint(checkpoint);
                    }}
                  />
                  {/* Week label */}
                  <text
                    x={x}
                    y="98"
                    fontSize="3"
                    textAnchor="middle"
                    className="text-muted fill-current pointer-events-none"
                  >
                    W{checkpoint.weekInBlock}
                  </text>
                </g>
              );
            })}

            {/* Y-axis labels */}
            <text
              x="1"
              y="5"
              fontSize="3"
              textAnchor="start"
              className="text-muted fill-current"
            >
              {maxCtl}
            </text>
            <text
              x="1"
              y="52"
              fontSize="3"
              textAnchor="start"
              className="text-muted fill-current"
            >
              {Math.round((maxCtl + minCtl) / 2)}
            </text>
            <text
              x="1"
              y="99"
              fontSize="3"
              textAnchor="start"
              className="text-muted fill-current"
            >
              {minCtl}
            </text>
          </svg>

          {/* Tooltip */}
          {hoveredCheckpoint && (
            <div
              className="fixed z-50 px-3 py-2 bg-bg-card border-2 border-teal rounded-lg shadow-lg text-xs pointer-events-none"
              style={{
                left: `${tooltipPos.x}px`,
                top: `${tooltipPos.y - 10}px`,
                transform: "translate(-50%, -100%)",
              }}
            >
              <div className="font-semibold text-text mb-1">
                Week {hoveredCheckpoint.weekInBlock} —{" "}
                <span className="capitalize">{hoveredCheckpoint.weekType}</span>
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted">Actual CTL:</span>
                  <span className="font-bold text-teal tabular-nums">
                    {hoveredCheckpoint.actualCtl.toFixed(1)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted">Expected CTL:</span>
                  <span className="font-semibold text-text tabular-nums">
                    {hoveredCheckpoint.expectedCtl.toFixed(1)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted">Deviation:</span>
                  <span
                    className={`font-semibold tabular-nums ${
                      hoveredCheckpoint.deviation > 0
                        ? "text-teal"
                        : hoveredCheckpoint.deviation < -3
                          ? "text-orange-bright"
                          : "text-text"
                    }`}
                  >
                    {hoveredCheckpoint.deviation > 0 ? "+" : ""}
                    {hoveredCheckpoint.deviation.toFixed(1)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted">Fitness Gain:</span>
                  <span className="font-semibold text-teal tabular-nums">
                    +{(hoveredCheckpoint.actualCtl - baselineCtl).toFixed(1)}{" "}
                    pts
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 mt-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-teal" />
            <span className="text-muted">Actual CTL</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 border-t-2 border-dashed border-teal opacity-60" />
            <span className="text-muted">Expected CTL</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-teal opacity-10 border border-teal opacity-30" />
            <span className="text-muted">Target Range (±5%)</span>
          </div>
        </div>
      </div>

      {/* Weekly status cards */}
      <div className="space-y-2">
        {checkpoints.map((checkpoint) => {
          const getTrendStyle = () => {
            if (
              checkpoint.trend === "ahead" ||
              checkpoint.trend === "on_track"
            ) {
              return { color: "text-teal", icon: "✓" };
            }
            if (checkpoint.trend === "behind") {
              return { color: "text-orange-bright", icon: "↓" };
            }
            return { color: "text-muted", icon: "•" };
          };

          const style = getTrendStyle();
          const ctlGain = checkpoint.actualCtl - baselineCtl;

          return (
            <div
              key={checkpoint.date}
              className="bg-bg-assistant p-3 rounded-lg border border-border"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-lg ${style.color}`}>
                      {style.icon}
                    </span>
                    <span className="font-semibold text-sm text-text">
                      Week {checkpoint.weekInBlock} —{" "}
                      <span className="capitalize">{checkpoint.weekType}</span>
                    </span>
                  </div>
                  <div className="text-xs text-muted space-y-1">
                    <div>
                      <span className="font-medium">CTL:</span>{" "}
                      <span className="tabular-nums">
                        {checkpoint.actualCtl} / {checkpoint.expectedCtl}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Fitness Gain:</span>{" "}
                      <span
                        className={`tabular-nums font-semibold ${ctlGain > 0 ? "text-teal" : "text-muted"}`}
                      >
                        {ctlGain > 0 ? "+" : ""}
                        {ctlGain.toFixed(1)} points
                      </span>
                    </div>
                  </div>
                </div>
                <div
                  className={`text-xs font-semibold px-2 py-1 rounded ${
                    checkpoint.weekType === "recovery"
                      ? "bg-peach/20 text-peach"
                      : checkpoint.weekType === "peak"
                        ? "bg-orange-bright/20 text-orange-bright"
                        : checkpoint.weekType === "build"
                          ? "bg-orange/20 text-orange"
                          : "bg-teal/20 text-teal"
                  }`}
                >
                  {checkpoint.weekType.toUpperCase()}
                </div>
              </div>
              {checkpoint.note && (
                <p className="text-xs text-muted mt-2 italic">
                  {checkpoint.note}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
