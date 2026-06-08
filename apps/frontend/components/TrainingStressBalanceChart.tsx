"use client";

import { useState, useEffect } from "react";

interface DataPoint {
  date: string;
  tss: number;
  atl: number;
  ctl: number;
  tsb: number;
}

export default function TrainingStressBalanceChart({
  athleteId,
  days = 60,
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
      `${process.env.NEXT_PUBLIC_API_URL}/analysis/${athleteId}/training-stress-balance?days=${days}`,
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
          No training data yet. Complete some workouts to see TSB trends.
        </p>
      </div>
    );
  }

  const maxCtl = Math.max(...data.map((d) => d.ctl));
  const maxAtl = Math.max(...data.map((d) => d.atl));
  const maxTsb = Math.max(...data.map((d) => d.tsb));
  const minTsb = Math.min(...data.map((d) => d.tsb));

  // Calculate appropriate Y-axis range
  const maxY = Math.max(maxCtl, maxAtl, maxTsb);
  const minY = Math.min(0, minTsb);
  const yRange = maxY - minY;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Calculate Y position (with proper scaling)
  const getY = (value: number) => {
    // Map value to 5-80% range (top to bottom, with margins)
    const normalized = (value - minY) / yRange;
    return 80 - normalized * 75;
  };

  // Calculate interval for x-axis labels to prevent overlap
  const labelInterval =
    data.length > 70
      ? 14
      : data.length > 40
        ? 10
        : data.length > 20
          ? 7
          : data.length > 10
            ? 5
            : 2;

  const getFormZoneColor = (tsb: number) => {
    if (tsb < -30) return "var(--color-peach)"; // Danger zone - high injury risk
    if (tsb < -10) return "var(--color-teal)"; // Optimal zone - good stress
    if (tsb < 5) return "var(--color-orange)"; // Maintaining
    return "var(--color-muted)"; // Over-rested
  };

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-0.5 bg-teal" />
          <span className="text-muted">Fitness (CTL)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-0.5 bg-orange" />
          <span className="text-muted">Fatigue (ATL)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-0.5 bg-text opacity-60" />
          <span className="text-muted">Form (TSB)</span>
        </div>
      </div>

      {/* Info boxes */}
      <div className="grid grid-cols-2 gap-2 text-xs bg-bg-assistant p-3 rounded-lg border border-border">
        <div>
          <span className="text-teal font-semibold">Optimal Zone:</span>
          <span className="text-muted ml-1">
            TSB -10 to -30 (productive stress)
          </span>
        </div>
        <div>
          <span className="text-peach font-semibold">Danger Zone:</span>
          <span className="text-muted ml-1">
            TSB &lt; -30 (high injury risk)
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="relative h-72">
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="overflow-visible"
        >
          {/* Background zones (if TSB range includes optimal/danger zones) */}
          {minTsb < -10 && (
            <>
              {/* Optimal zone (-10 to -30) */}
              <rect
                x="5"
                y={getY(-10)}
                width="90"
                height={Math.abs(getY(-30) - getY(-10))}
                fill="var(--color-teal)"
                opacity="0.1"
              />
              {/* Danger zone (< -30) */}
              {minTsb < -30 && (
                <rect
                  x="5"
                  y={getY(-30)}
                  width="90"
                  height={Math.abs(getY(minY) - getY(-30))}
                  fill="var(--color-peach)"
                  opacity="0.1"
                />
              )}
            </>
          )}

          {/* Grid lines */}
          {[20, 40, 60, 80].map((pct) => (
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

          {/* CTL line (Fitness) */}
          <polyline
            points={data
              .map((point, i) => {
                const x = 5 + (i / (data.length - 1)) * 90;
                const y = getY(point.ctl);
                return `${x},${y}`;
              })
              .join(" ")}
            fill="none"
            stroke="var(--color-teal)"
            strokeWidth="0.4"
            vectorEffect="non-scaling-stroke"
          />

          {/* ATL line (Fatigue) */}
          <polyline
            points={data
              .map((point, i) => {
                const x = 5 + (i / (data.length - 1)) * 90;
                const y = getY(point.atl);
                return `${x},${y}`;
              })
              .join(" ")}
            fill="none"
            stroke="var(--color-orange)"
            strokeWidth="0.4"
            vectorEffect="non-scaling-stroke"
          />

          {/* TSB line (Form) */}
          <polyline
            points={data
              .map((point, i) => {
                const x = 5 + (i / (data.length - 1)) * 90;
                const y = getY(point.tsb);
                return `${x},${y}`;
              })
              .join(" ")}
            fill="none"
            stroke="var(--color-text)"
            strokeWidth="0.3"
            opacity="0.6"
            strokeDasharray="2 1"
            vectorEffect="non-scaling-stroke"
          />

          {/* Interactive points */}
          {data.map((point, i) => {
            const x = 5 + (i / (data.length - 1)) * 90;
            const y = getY(point.tsb);

            return (
              <g key={i}>
                {/* Invisible hover area */}
                <rect
                  x={x - 2}
                  y="0"
                  width="4"
                  height="100"
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredPoint(point)}
                  onMouseLeave={() => setHoveredPoint(null)}
                />

                {/* Point indicator */}
                {hoveredPoint === point && (
                  <>
                    <circle
                      cx={x}
                      cy={getY(point.ctl)}
                      r="1.5"
                      fill="var(--color-teal)"
                      stroke="var(--color-teal)"
                      strokeWidth="0.5"
                    />
                    <circle
                      cx={x}
                      cy={getY(point.atl)}
                      r="1.5"
                      fill="var(--color-orange)"
                      stroke="var(--color-orange)"
                      strokeWidth="0.5"
                    />
                    <circle
                      cx={x}
                      cy={y}
                      r="1.5"
                      fill="var(--color-text)"
                      stroke="var(--color-text)"
                      strokeWidth="0.5"
                      opacity="0.8"
                    />
                  </>
                )}
              </g>
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

          {/* Y-axis labels */}
          <text
            x="1"
            y="8"
            className="text-xs fill-muted font-medium"
            style={{ fontSize: "4px" }}
          >
            {Math.round(maxY)}
          </text>
          <text
            x="1"
            y="47"
            className="text-xs fill-muted font-medium"
            style={{ fontSize: "4px" }}
          >
            {Math.round((maxY + minY) / 2)}
          </text>
          <text
            x="1"
            y="82"
            className="text-xs fill-muted font-medium"
            style={{ fontSize: "4px" }}
          >
            {Math.round(minY)}
          </text>
        </svg>

        {/* Tooltip */}
        {hoveredPoint && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-bg-card border border-border rounded-lg p-3 shadow-lg z-10 min-w-[220px]">
            <p className="text-xs font-semibold text-muted mb-2">
              {formatDate(hoveredPoint.date)}
            </p>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted">Fitness (CTL):</span>
                <span className="font-semibold text-teal">
                  {hoveredPoint.ctl}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Fatigue (ATL):</span>
                <span className="font-semibold text-orange">
                  {hoveredPoint.atl}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Form (TSB):</span>
                <span
                  className="font-semibold"
                  style={{ color: getFormZoneColor(hoveredPoint.tsb) }}
                >
                  {hoveredPoint.tsb > 0 ? "+" : ""}
                  {hoveredPoint.tsb}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-border">
                <span className="text-muted">Daily TSS:</span>
                <span className="font-semibold text-text">
                  {Math.round(hoveredPoint.tss)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border">
        <div className="text-center">
          <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted">
            Current CTL
          </p>
          <p className="text-xl font-bold tabular-nums text-teal mt-1">
            {data[data.length - 1]?.ctl ?? 0}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted">
            Current ATL
          </p>
          <p className="text-xl font-bold tabular-nums text-orange mt-1">
            {data[data.length - 1]?.atl ?? 0}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted">
            Current TSB
          </p>
          <p
            className="text-xl font-bold tabular-nums mt-1"
            style={{
              color: getFormZoneColor(data[data.length - 1]?.tsb ?? 0),
            }}
          >
            {data[data.length - 1]?.tsb > 0 ? "+" : ""}
            {data[data.length - 1]?.tsb ?? 0}
          </p>
        </div>
      </div>
    </div>
  );
}
