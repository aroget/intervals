"use client";

import { useState, useEffect } from "react";
import {
  Bar,
  Line,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { getChartColors } from "@/lib/chartColors";

interface DataPoint {
  date: string;
  readinessScore: number | null;
  tss: number;
  hrvSevenDayAvg: number | null;
  rhrSevenDayAvg: number | null;
  sleepScoreSevenDayAvg: number | null;
}

const chartConfig = {
  readinessScore: {
    label: "Readiness",
  },
  tss: {
    label: "Daily TSS",
  },
} as const;

export default function RecoveryReadinessChartNew({
  athleteId,
  days = 30,
}: {
  athleteId: string;
  days?: number;
}) {
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const colors = getChartColors();

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

  const getReadinessColor = (score: number | null) => {
    if (score === null) return colors.muted;
    if (score >= 80) return colors.teal;
    if (score >= 55) return colors.orange;
    return colors.peach;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Prepare chart data
  const chartData = data.map((point) => ({
    date: formatDate(point.date),
    fullDate: point.date,
    readinessScore: point.readinessScore,
    tss: point.tss,
    hrvSevenDayAvg: point.hrvSevenDayAvg,
    rhrSevenDayAvg: point.rhrSevenDayAvg,
    sleepScoreSevenDayAvg: point.sleepScoreSevenDayAvg,
    fill: getReadinessColor(point.readinessScore),
  }));

  const avgReadiness = Math.round(
    data
      .filter((d) => d.readinessScore)
      .reduce((sum, d) => sum + (d.readinessScore ?? 0), 0) /
      data.filter((d) => d.readinessScore).length,
  );
  const avgTss = Math.round(
    data.reduce((sum, d) => sum + d.tss, 0) / data.length,
  );
  const trainingDays = data.filter((d) => d.tss > 0).length;

  return (
    <div className="space-y-4">
      {/* Chart */}
      <ChartContainer config={chartConfig} className="h-64 w-full">
        <ComposedChart
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
            yAxisId="left"
            tickLine={false}
            axisLine={false}
            tick={{ fill: colors.muted, fontSize: 11 }}
            domain={[0, 100]}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickLine={false}
            axisLine={false}
            tick={{ fill: colors.muted, fontSize: 11 }}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(value, payload) => {
                  if (!payload?.[0]) return value;
                  return value;
                }}
                formatter={(value, name, item) => {
                  const data = item.payload;
                  if (name === "readinessScore") {
                    return (
                      <div className="space-y-1">
                        <div className="flex justify-between gap-4">
                          <span className="text-muted">Readiness:</span>
                          <span className="font-semibold text-teal">
                            {value}/100
                          </span>
                        </div>
                        {data.hrvSevenDayAvg && (
                          <div className="flex justify-between gap-4">
                            <span className="text-muted">HRV (7d):</span>
                            <span className="font-semibold">
                              {Math.round(data.hrvSevenDayAvg)} ms
                            </span>
                          </div>
                        )}
                        {data.rhrSevenDayAvg && (
                          <div className="flex justify-between gap-4">
                            <span className="text-muted">RHR (7d):</span>
                            <span className="font-semibold">
                              {Math.round(data.rhrSevenDayAvg)} bpm
                            </span>
                          </div>
                        )}
                        {data.sleepScoreSevenDayAvg && (
                          <div className="flex justify-between gap-4">
                            <span className="text-muted">Sleep (7d):</span>
                            <span className="font-semibold">
                              {Math.round(data.sleepScoreSevenDayAvg)}/100
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  }
                  if (name === "tss") {
                    return [`${Math.round(value as number)} TSS`, "Daily Load"];
                  }
                  return value;
                }}
                hideIndicator
              />
            }
          />
          <Bar yAxisId="left" dataKey="readinessScore" radius={[4, 4, 0, 0]} />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="tss"
            stroke={colors.muted}
            strokeWidth={2}
            dot={{ r: 2, fill: colors.text, opacity: 0.6 }}
          />
        </ComposedChart>
      </ChartContainer>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border">
        <div className="text-center">
          <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted">
            Avg Readiness
          </p>
          <p className="text-xl font-bold tabular-nums text-teal mt-1">
            {avgReadiness}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted">
            Avg TSS/Day
          </p>
          <p className="text-xl font-bold tabular-nums text-text mt-1">
            {avgTss}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted">
            Training Days
          </p>
          <p className="text-xl font-bold tabular-nums text-orange mt-1">
            {trainingDays}
          </p>
        </div>
      </div>
    </div>
  );
}
