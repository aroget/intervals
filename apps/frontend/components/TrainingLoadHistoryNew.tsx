"use client";

import { useState, useEffect } from "react";
import { Bar, BarChart, Line, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { getChartColors } from "@intervals/brand/colors";

interface Week {
  weekStart: string;
  totalTss: number;
  activities: number;
  weekType?: string;
  isRecoveryWeek?: boolean;
}

const chartConfig = {
  totalTss: {
    label: "Weekly TSS",
  },
  movingAvg: {
    label: "4-Week Avg",
  },
} as const;

export default function TrainingLoadHistoryNew({
  athleteId,
  weeks: weeksCount = 12,
}: {
  athleteId: string;
  weeks?: number;
}) {
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [loading, setLoading] = useState(true);
  const colors = getChartColors();

  useEffect(() => {
    setLoading(true);
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/analysis/${athleteId}/training-load-history?weeks=${weeksCount}`,
    )
      .then((r) => r.json())
      .then((data) => {
        setWeeks(data.weeks ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [athleteId, weeksCount]);

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

  // Get visible weeks
  const visibleWeeks = weeks.slice(-weeksCount);
  const maxTss = Math.max(...visibleWeeks.map((w) => w.totalTss));
  const avgTss =
    visibleWeeks.reduce((sum, w) => sum + w.totalTss, 0) / visibleWeeks.length;

  // Calculate 4-week moving average for all weeks
  const movingAvg = weeks.map((week, i) => {
    const start = Math.max(0, i - 3);
    const windowWeeks = weeks.slice(start, i + 1);
    return (
      windowWeeks.reduce((sum, w) => sum + w.totalTss, 0) / windowWeeks.length
    );
  });

  // Prepare chart data
  const chartData = visibleWeeks.map((week, i) => {
    const weekIndex = weeks.indexOf(week);
    return {
      date: new Date(week.weekStart + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      totalTss: Math.round(week.totalTss),
      movingAvg: Math.round(movingAvg[weekIndex]),
      fill: getWeekColor(week),
      weekType: week.weekType,
      activities: week.activities,
    };
  });

  function getWeekColor(week: Week): string {
    if (week.isRecoveryWeek) return colors.peach;
    if (week.weekType === "peak") return colors.orangeBright;
    if (week.weekType === "build") return colors.orange;
    return colors.teal; // base
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3">
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
      </div>

      {/* Chart */}
      <div className="bg-bg-assistant p-4 rounded-lg border border-border">
        <h4 className="text-sm font-semibold text-text mb-4">
          Training Load Progression ({weeksCount}-Week View)
        </h4>

        <ChartContainer config={chartConfig} className="h-64 w-full">
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            style={{ background: "transparent" }}
          >
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
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value, payload) => {
                    if (!payload?.[0]) return value;
                    const data = payload[0].payload;
                    return (
                      <div>
                        <div className="text-xs font-semibold text-text">
                          {value}
                        </div>
                        {data.weekType && (
                          <div className="text-xs text-muted capitalize mt-0.5">
                            {data.weekType} Week
                          </div>
                        )}
                      </div>
                    );
                  }}
                  formatter={(value, name) => {
                    if (name === "totalTss") {
                      return [`${value} TSS`, "Weekly Load"];
                    }
                    return [`${value}`, "4-Week Avg"];
                  }}
                />
              }
            />
            <Bar dataKey="totalTss" radius={[4, 4, 0, 0]} />
            <Line
              type="monotone"
              dataKey="movingAvg"
              stroke={colors.muted}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
            />
          </BarChart>
        </ChartContainer>
      </div>

      {/* Insight */}
      <div className="bg-bg-assistant p-4 rounded-lg border border-border">
        <p className="text-xs text-text leading-relaxed">
          {visibleWeeks[visibleWeeks.length - 1].totalTss > avgTss * 1.2
            ? "📈 High training load this week — monitor recovery closely."
            : visibleWeeks[visibleWeeks.length - 1].totalTss < avgTss * 0.7
              ? "📉 Low training load — recovery week or training gap?"
              : "✅ Training load is consistent with your recent average."}
        </p>
      </div>
    </div>
  );
}
