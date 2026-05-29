"use client";

import { useState, useEffect } from "react";

interface Week {
  weekStart: string;
  totalTss: number;
  activities: number;
  cycleWeek?: number;
  weekType?: string;
  isRecoveryWeek?: boolean;
}

interface FitnessPoint {
  date: string;
  ctl: number;
  atl: number;
  tsb: number;
}

interface CombinedChartProps {
  athleteId: string;
}

export default function CombinedTrainingChart({
  athleteId,
}: CombinedChartProps) {
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [fitnessData, setFitnessData] = useState<FitnessPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredItem, setHoveredItem] = useState<any>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    fetchData();
  }, [athleteId]);

  async function fetchData() {
    try {
      const [loadRes, activitiesRes] = await Promise.all([
        fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/analysis/${athleteId}/training-load-history`,
        ),
        fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/athlete/${athleteId}/activities?days=84`,
        ),
      ]);

      const [loadData, activitiesData] = await Promise.all([
        loadRes.json(),
        activitiesRes.json(),
      ]);

      setWeeks(loadData.weeks ?? []);

      // Build fitness points from activities
      const activities = activitiesData.activities || [];
      const points: FitnessPoint[] = activities
        .filter((a: any) => a.ctl != null && a.atl != null)
        .map((a: any) => ({
          date: a.start_date,
          ctl: a.ctl,
          atl: a.atl,
          tsb: a.ctl - a.atl,
        }))
        .reverse(); // Oldest to newest

      setFitnessData(points);
      setLoading(false);
    } catch (err) {
      console.error("Failed to load chart data:", err);
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin h-8 w-8 border-4 border-teal border-t-transparent rounded-full" />
      </div>
    );
  }

  if (weeks.length === 0) {
    return (
      <div className="text-center p-8">
        <p className="text-muted text-sm">
          No training data yet. Complete some workouts to see analytics.
        </p>
      </div>
    );
  }

  // Calculate scales
  const maxTss = Math.max(...weeks.map((w) => w.totalTss), 1);
  const maxCtl = Math.max(...fitnessData.map((p) => p.ctl), 1);
  const minTsb = Math.min(...fitnessData.map((p) => p.tsb), 0);
  const maxTsb = Math.max(...fitnessData.map((p) => p.tsb), 0);
  const tsbRange = maxTsb - minTsb || 1;

  const getTsbColor = (tsb: number) => {
    if (tsb > 0) return "var(--color-teal)"; // Fresh
    if (tsb > -10) return "var(--color-teal)"; // Fresh/Optimal
    if (tsb >= -30) return "#10b981"; // Optimal (green)
    return "var(--color-orange-bright)"; // High fatigue
  };

  const getWeekColorFill = (week: Week) => {
    if (week.isRecoveryWeek) return "var(--color-peach)";
    if (week.weekType === "peak") return "var(--color-orange-bright)";
    if (week.weekType === "build") return "var(--color-orange)";
    return "var(--color-teal)"; // base
  };

  return (
    <div className="space-y-6">
      {/* Chart */}
      <div className="relative">
        <svg
          viewBox="0 0 100 60"
          preserveAspectRatio="none"
          className="w-full h-80 sm:h-96"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setTooltipPos({
              x: e.clientX - rect.left,
              y: e.clientY - rect.top,
            });
          }}
          onMouseLeave={() => setHoveredItem(null)}
        >
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((y) => (
            <line
              key={`grid-${y}`}
              x1="5"
              y1={5 + (y * 50) / 100}
              x2="95"
              y2={5 + (y * 50) / 100}
              stroke="currentColor"
              strokeWidth="0.1"
              className="text-border opacity-30"
            />
          ))}

          {/* Weekly TSS bars */}
          {weeks.map((week, i) => {
            const x = 5 + (i / weeks.length) * 90;
            const width = (90 / weeks.length) * 0.8;
            const height = (week.totalTss / maxTss) * 40; // Max 40 units for bars
            const y = 55 - height;

            return (
              <rect
                key={`bar-${i}`}
                x={x}
                y={y}
                width={width}
                height={height}
                fill={getWeekColorFill(week)}
                opacity="0.7"
                onMouseEnter={() =>
                  setHoveredItem({ type: "week", data: week, x, y })
                }
                className="cursor-pointer hover:opacity-100 transition-opacity"
              />
            );
          })}

          {/* CTL line (Fitness) */}
          {fitnessData.length > 1 &&
            (() => {
              const points = fitnessData.map((point, i) => {
                const x = 5 + (i / (fitnessData.length - 1)) * 90;
                const y = 55 - (point.ctl / maxCtl) * 40;
                return `${x},${y}`;
              });
              return (
                <polyline
                  points={points.join(" ")}
                  fill="none"
                  stroke="var(--color-teal)"
                  strokeWidth="0.6"
                  strokeLinejoin="round"
                  className="drop-shadow-md"
                />
              );
            })()}

          {/* ATL line (Fatigue) */}
          {fitnessData.length > 1 &&
            (() => {
              const points = fitnessData.map((point, i) => {
                const x = 5 + (i / (fitnessData.length - 1)) * 90;
                const y = 55 - (point.atl / maxCtl) * 40;
                return `${x},${y}`;
              });
              return (
                <polyline
                  points={points.join(" ")}
                  fill="none"
                  stroke="var(--color-orange)"
                  strokeWidth="0.6"
                  strokeLinejoin="round"
                  strokeDasharray="1,1"
                  className="opacity-70"
                />
              );
            })()}

          {/* TSB line (Form) - Color-coded */}
          {fitnessData.length > 1 &&
            fitnessData.map((point, i) => {
              if (i === fitnessData.length - 1) return null;
              const nextPoint = fitnessData[i + 1];
              const x1 = 5 + (i / (fitnessData.length - 1)) * 90;
              const x2 = 5 + ((i + 1) / (fitnessData.length - 1)) * 90;

              // Map TSB to chart (center at y=25, ±15 units for range)
              const y1 = 25 - ((point.tsb - minTsb) / tsbRange) * 15;
              const y2 = 25 - ((nextPoint.tsb - minTsb) / tsbRange) * 15;

              return (
                <line
                  key={`tsb-${i}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={getTsbColor(point.tsb)}
                  strokeWidth="0.8"
                  strokeLinejoin="round"
                  className="drop-shadow-sm"
                />
              );
            })}

          {/* Y-axis labels (left side for TSS/CTL) */}
          <text
            x="1"
            y="7"
            className="text-[3px] fill-muted"
            textAnchor="start"
          >
            {Math.round(maxTss)}
          </text>
          <text
            x="1"
            y="30"
            className="text-[3px] fill-muted"
            textAnchor="start"
          >
            {Math.round(maxTss / 2)}
          </text>
          <text
            x="1"
            y="55"
            className="text-[3px] fill-muted"
            textAnchor="start"
          >
            0
          </text>
        </svg>

        {/* Tooltip */}
        {hoveredItem && (
          <div
            className="absolute z-10 bg-bg-card border border-border rounded-lg shadow-lg p-3 pointer-events-none text-xs whitespace-nowrap"
            style={{
              left: `${tooltipPos.x + 10}px`,
              top: `${tooltipPos.y - 50}px`,
            }}
          >
            {hoveredItem.type === "week" && (
              <>
                <p className="font-bold text-text">
                  Week {hoveredItem.data.weekStart}
                </p>
                <p className="text-muted">
                  TSS:{" "}
                  <span className="font-semibold text-text">
                    {Math.round(hoveredItem.data.totalTss)}
                  </span>
                </p>
                {hoveredItem.data.weekType && (
                  <p className="text-xs capitalize text-muted">
                    {hoveredItem.data.weekType} week
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-3 rounded"
            style={{ backgroundColor: "var(--color-teal)" }}
          />
          <span className="font-semibold text-text">TSS Bars</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-0.5"
            style={{ backgroundColor: "var(--color-teal)" }}
          />
          <span className="font-semibold text-text">CTL (Fitness)</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-0.5 border-t-2 border-dashed"
            style={{ borderColor: "var(--color-orange)" }}
          />
          <span className="font-semibold text-text">ATL (Fatigue)</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-0.5"
            style={{
              background:
                "linear-gradient(to right, var(--color-teal), #10b981, var(--color-orange-bright))",
            }}
          />
          <span className="font-semibold text-text">TSB (Form)</span>
        </div>
      </div>
    </div>
  );
}
