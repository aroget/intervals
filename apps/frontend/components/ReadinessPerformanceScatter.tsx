"use client";

import { useState, useEffect } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  ZAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { getChartColors } from "@intervals/brand/colors";
import { LoadingState } from "@intervals/ui/spinner";

interface ReadinessPerformancePoint {
  date: string;
  readinessScore: number;
  performanceMetric: number;
  sport: string;
  activityName: string;
  decoupling: number | null;
  intensityFactor: number | null;
  tss: number | null;
}

const chartConfig = {
  performance: { label: "Performance" },
} as const;

export default function ReadinessPerformanceScatter({
  athleteId,
  days = 90,
}: {
  athleteId: string;
  days?: number;
}) {
  const [data, setData] = useState<ReadinessPerformancePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const colors = getChartColors();

  useEffect(() => {
    setLoading(true);
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/analysis/${athleteId}/readiness-performance-chart?days=${days}`,
    )
      .then((r) => r.json())
      .then((res) => {
        setData(res.data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [athleteId, days]);

  if (loading) return <LoadingState />;

  if (data.length === 0) {
    return (
      <div className="text-center p-8">
        <p className="text-muted text-sm">
          Not enough workout data yet. Complete more sessions with power/pace
          data to see performance patterns.
        </p>
      </div>
    );
  }

  const getSportColor = (sport: string) => {
    switch (sport.toLowerCase()) {
      case "bike":
      case "ride":
        return colors.teal;
      case "run":
        return colors.orange;
      case "swim":
        return colors.mint;
      default:
        return colors.muted;
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Prepare data for scatter chart
  const chartData = data.map((point) => ({
    x: point.readinessScore, // X-axis: readiness
    y: point.performanceMetric, // Y-axis: performance
    z: point.tss ?? 50, // Bubble size based on TSS
    sport: point.sport,
    date: formatDate(point.date),
    fullDate: point.date,
    activityName: point.activityName,
    decoupling: point.decoupling,
    intensityFactor: point.intensityFactor,
  }));

  // Group by sport for different scatter series
  const bikeData = chartData.filter((d) =>
    ["bike", "ride"].includes(d.sport.toLowerCase()),
  );
  const runData = chartData.filter((d) => d.sport.toLowerCase() === "run");
  const otherData = chartData.filter(
    (d) => !["bike", "ride", "run"].includes(d.sport.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: colors.teal }}
          />
          <span className="text-muted">Cycling</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: colors.orange }}
          />
          <span className="text-muted">Running</span>
        </div>
        {otherData.length > 0 && (
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: colors.mint }}
            />
            <span className="text-muted">Other</span>
          </div>
        )}
      </div>

      <ChartContainer config={chartConfig} className="h-80 w-full">
        <ScatterChart margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={colors.border}
            opacity={0.3}
          />

          <XAxis
            type="number"
            dataKey="x"
            name="Readiness"
            domain={[0, 100]}
            tickLine={false}
            axisLine={false}
            tick={{ fill: colors.muted, fontSize: 11 }}
            label={{
              value: "Morning Readiness Score",
              position: "insideBottom",
              offset: -10,
              style: { fill: colors.muted, fontSize: 11 },
            }}
          />

          <YAxis
            type="number"
            dataKey="y"
            name="Performance"
            domain={[0, 100]}
            tickLine={false}
            axisLine={false}
            tick={{ fill: colors.muted, fontSize: 11 }}
            label={{
              value: "Performance Metric (% of Threshold)",
              angle: -90,
              position: "insideLeft",
              style: { fill: colors.muted, fontSize: 11 },
            }}
          />

          <ZAxis type="number" dataKey="z" range={[30, 200]} />

          <ChartTooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              if (!active || !payload || !payload.length) return null;
              const data = payload[0].payload;

              return (
                <div className="rounded-lg border border-border bg-bg-card px-3 py-2 shadow-lg">
                  <div className="space-y-1">
                    <div className="font-semibold text-sm text-text">
                      {data.activityName}
                    </div>
                    <div className="text-xs text-muted">{data.date}</div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mt-2">
                      <span className="text-muted">Readiness:</span>
                      <span className="font-semibold tabular-nums text-text">
                        {data.x}
                      </span>

                      <span className="text-muted">Performance:</span>
                      <span className="font-semibold tabular-nums text-text">
                        {data.y} %
                      </span>

                      <span className="text-muted">TSS:</span>
                      <span className="font-semibold tabular-nums text-text">
                        {data.z}
                      </span>

                      {data.intensityFactor != null && (
                        <>
                          <span className="text-muted">IF:</span>
                          <span className="font-semibold tabular-nums text-text">
                            {data.intensityFactor.toFixed(2)}
                          </span>
                        </>
                      )}

                      {data.decoupling != null && (
                        <>
                          <span className="text-muted">Decoupling:</span>
                          <span className="font-semibold tabular-nums text-text">
                            {data.decoupling.toFixed(1)} %
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            }}
          />

          {/* Scatter series by sport */}
          {bikeData.length > 0 && (
            <Scatter
              name="Cycling"
              data={bikeData}
              fill={colors.teal}
              fillOpacity={0.6}
            />
          )}

          {runData.length > 0 && (
            <Scatter
              name="Running"
              data={runData}
              fill={colors.orange}
              fillOpacity={0.6}
            />
          )}

          {otherData.length > 0 && (
            <Scatter
              name="Other"
              data={otherData}
              fill={colors.mint}
              fillOpacity={0.6}
            />
          )}
        </ScatterChart>
      </ChartContainer>

      {/* Insight */}
      <div className="text-center text-xs text-muted leading-relaxed">
        Each dot represents a completed workout. Clusters show your "sweet
        spots" where readiness correlates with strong performance. Larger
        bubbles = higher TSS sessions.
      </div>
    </div>
  );
}
