"use client";

import { useState, useEffect } from "react";
import {
  Line,
  Area,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { getChartColors } from "@intervals/brand/colors";
import { LoadingState } from "@intervals/ui/spinner";

interface HRVBaselinePoint {
  date: string;
  hrv: number | null;
  sevenDayAvg: number | null;
  baselineMean: number | null;
  baselineUpper: number | null;
  baselineLower: number | null;
  isDeficit: boolean;
}

const chartConfig = {
  hrv: { label: "Daily HRV" },
  sevenDayAvg: { label: "7-Day Average" },
  baseline: { label: "30-Day Baseline" },
} as const;

export default function HRVBaselineChart({
  athleteId,
  days = 60,
}: {
  athleteId: string;
  days?: number;
}) {
  const [data, setData] = useState<HRVBaselinePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const colors = getChartColors();

  useEffect(() => {
    setLoading(true);
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/analysis/${athleteId}/hrv-baseline-chart?days=${days}`,
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
          No HRV data available. Sync wellness data from your device to track
          recovery trends.
        </p>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const chartData = data.map((point) => ({
    date: formatDate(point.date),
    fullDate: point.date,
    hrv: point.hrv,
    sevenDayAvg: point.sevenDayAvg,
    baselineMean: point.baselineMean,
    baselineUpper: point.baselineUpper,
    baselineLower: point.baselineLower,
    isDeficit: point.isDeficit,
  }));

  // Find latest deficit status
  const latestPoint = data[data.length - 1];
  const hasRecentDeficit = latestPoint?.isDeficit ?? false;

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-0.5"
            style={{ backgroundColor: colors.muted, opacity: 0.3 }}
          />
          <span className="text-muted">Daily HRV</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5" style={{ backgroundColor: colors.teal }} />
          <span className="text-muted">7-Day Average</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded"
            style={{ backgroundColor: colors.orange, opacity: 0.15 }}
          />
          <span className="text-muted">30-Day Baseline</span>
        </div>
      </div>

      <ChartContainer config={chartConfig} className="h-64 w-full">
        <ComposedChart
          data={chartData}
          margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
        >
          <defs>
            <linearGradient id="baselineBand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.orange} stopOpacity={0.15} />
              <stop
                offset="100%"
                stopColor={colors.orange}
                stopOpacity={0.05}
              />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke={colors.border}
            opacity={0.3}
          />

          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tick={{ fill: colors.muted, fontSize: 11 }}
            interval="preserveStartEnd"
          />

          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: colors.muted, fontSize: 11 }}
            label={{
              value: "HRV (ms)",
              angle: -90,
              position: "insideLeft",
              style: { fill: colors.muted, fontSize: 11 },
            }}
          />

          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value: any, name: any) => {
                  if (value == null) return ["—", name];
                  return [
                    <span key={name} className="tabular-nums">
                      {typeof value === "number"
                        ? `${value.toFixed(0)} `
                        : value}
                    </span>,
                    name === "sevenDayAvg"
                      ? "ms (7-Day Avg)"
                      : name === "baselineMean"
                        ? "ms (Baseline)"
                        : name === "baselineUpper"
                          ? "ms (Upper)"
                          : name === "baselineLower"
                            ? "ms (Lower)"
                            : "ms (Daily)",
                  ];
                }}
              />
            }
          />

          {/* Baseline band (30-day mean ± std dev) - using Line instead of Area to avoid black background */}
          <Line
            type="monotone"
            dataKey="baselineUpper"
            stroke={colors.orange}
            strokeWidth={1}
            strokeOpacity={0.3}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="baselineLower"
            stroke={colors.orange}
            strokeWidth={1}
            strokeOpacity={0.3}
            dot={false}
          />

          {/* Daily HRV (light, thin line) */}
          <Line
            type="monotone"
            dataKey="hrv"
            stroke={colors.muted}
            strokeWidth={1}
            strokeOpacity={0.3}
            dot={false}
          />

          {/* 7-Day rolling average (bold line) */}
          <Line
            type="monotone"
            dataKey="sevenDayAvg"
            stroke={colors.teal}
            strokeWidth={3}
            dot={false}
          />
        </ComposedChart>
      </ChartContainer>

      {/* Current Status */}
      {latestPoint && latestPoint.sevenDayAvg != null && (
        <div className="text-center text-sm">
          <span className="text-muted">7-Day Average: </span>
          <span className="font-bold tabular-nums text-text">
            {latestPoint.sevenDayAvg.toFixed(0)} ms
          </span>
          {hasRecentDeficit && (
            <span className="ml-2 text-peach font-semibold">
              ⚠️ Below Baseline - Deep Recovery Deficit
            </span>
          )}
          {!hasRecentDeficit && latestPoint.baselineMean != null && (
            <span className="ml-2 text-teal">✓ Within Normal Range</span>
          )}
        </div>
      )}
    </div>
  );
}
