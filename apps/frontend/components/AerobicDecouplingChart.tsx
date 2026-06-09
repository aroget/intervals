"use client";

import { useState, useEffect } from "react";
import {
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { getChartColors } from "@intervals/brand/colors";
import { LoadingState } from "@intervals/ui/spinner";

interface WeeklyDecouplingAverage {
  weekStartDate: string;
  avgDecoupling: number;
  sessionCount: number;
  sport: string;
}

const chartConfig = {
  decoupling: { label: "Aerobic Decoupling" },
} as const;

export default function AerobicDecouplingChart({
  athleteId,
  days = 90,
}: {
  athleteId: string;
  days?: number;
}) {
  const [data, setData] = useState<{ weekly: WeeklyDecouplingAverage[] }>({
    weekly: [],
  });
  const [loading, setLoading] = useState(true);
  const colors = getChartColors();

  useEffect(() => {
    setLoading(true);
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/analysis/${athleteId}/decoupling-trend-chart?days=${days}`,
    )
      .then((r) => r.json())
      .then((res) => {
        setData({ weekly: res.weekly ?? [] });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [athleteId, days]);

  if (loading) return <LoadingState />;

  if (data.weekly.length === 0) {
    return (
      <div className="text-center p-8">
        <p className="text-muted text-sm">
          No aerobic decoupling data yet. Complete longer endurance sessions
          (&gt;60 min) with power/HR data to track efficiency trends.
        </p>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getSportColor = (sport: string) => {
    switch (sport.toLowerCase()) {
      case "bike":
      case "ride":
        return colors.teal;
      case "run":
        return colors.orange;
      default:
        return colors.muted;
    }
  };

  // Prepare chart data - combine both sports
  const bikeData = data.weekly
    .filter((w) => ["bike", "ride"].includes(w.sport.toLowerCase()))
    .map((w) => ({
      date: formatDate(w.weekStartDate),
      fullDate: w.weekStartDate,
      bike: w.avgDecoupling,
      run: null,
      sessionCount: w.sessionCount,
      sport: "bike",
    }));

  const runData = data.weekly
    .filter((w) => w.sport.toLowerCase() === "run")
    .map((w) => ({
      date: formatDate(w.weekStartDate),
      fullDate: w.weekStartDate,
      bike: null,
      run: w.avgDecoupling,
      sessionCount: w.sessionCount,
      sport: "run",
    }));

  // Merge by date
  const dateMap = new Map<string, any>();
  bikeData.forEach((d) => {
    dateMap.set(d.fullDate, { ...d });
  });
  runData.forEach((d) => {
    const existing = dateMap.get(d.fullDate);
    if (existing) {
      existing.run = d.run;
    } else {
      dateMap.set(d.fullDate, { ...d });
    }
  });

  const chartData = Array.from(dateMap.values()).sort(
    (a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime(),
  );

  const hasBikeData = bikeData.length > 0;
  const hasRunData = runData.length > 0;

  // Calculate latest average
  const latestBike = bikeData[bikeData.length - 1]?.bike ?? null;
  const latestRun = runData[runData.length - 1]?.run ?? null;

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-xs">
        {hasBikeData && (
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-0.5"
              style={{ backgroundColor: colors.teal }}
            />
            <span className="text-muted">Cycling</span>
          </div>
        )}
        {hasRunData && (
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-0.5"
              style={{ backgroundColor: colors.orange }}
            />
            <span className="text-muted">Running</span>
          </div>
        )}
        <div className="flex items-center gap-2 ml-4">
          <span className="text-muted">Target: &lt;5% (Efficient)</span>
        </div>
      </div>

      <ChartContainer config={chartConfig} className="h-64 w-full">
        <LineChart
          data={chartData}
          margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
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
            domain={[0, 15]}
            tickLine={false}
            axisLine={false}
            tick={{ fill: colors.muted, fontSize: 11 }}
            label={{
              value: "Decoupling (%)",
              angle: -90,
              position: "insideLeft",
              style: { fill: colors.muted, fontSize: 11 },
            }}
          />

          {/* 5% threshold line (efficient aerobic engine) */}
          <ReferenceLine
            y={5}
            stroke={colors.teal}
            strokeDasharray="3 3"
            strokeOpacity={0.5}
            label={{
              value: "5% (Efficient)",
              position: "right",
              fill: colors.muted,
              fontSize: 10,
            }}
          />

          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value: any, name: any) => {
                  if (value == null) return null;
                  const label = name === "bike" ? " Cycling" : " Running";
                  return [
                    <span key={name} className="tabular-nums">
                      {typeof value === "number"
                        ? `${value.toFixed(1)}%`
                        : value}
                    </span>,
                    label,
                  ];
                }}
                labelFormatter={(label: any, payload: any) => {
                  const data = payload[0]?.payload;
                  if (!data) return label;
                  return (
                    <div className="space-y-1">
                      <div className="font-semibold">Week of {label}</div>
                      {data.sessionCount && (
                        <div className="text-xs text-muted">
                          {data.sessionCount} session
                          {data.sessionCount > 1 ? "s" : ""}
                        </div>
                      )}
                    </div>
                  );
                }}
              />
            }
          />

          {/* Bike decoupling line */}
          {hasBikeData && (
            <Line
              type="monotone"
              dataKey="bike"
              stroke={colors.teal}
              strokeWidth={3}
              dot={{ fill: colors.teal, r: 4 }}
              connectNulls
            />
          )}

          {/* Run decoupling line */}
          {hasRunData && (
            <Line
              type="monotone"
              dataKey="run"
              stroke={colors.orange}
              strokeWidth={3}
              dot={{ fill: colors.orange, r: 4 }}
              connectNulls
            />
          )}
        </LineChart>
      </ChartContainer>

      {/* Current Status */}
      <div className="text-center text-sm space-y-1">
        {latestBike != null && (
          <div>
            <span className="text-muted">Latest Cycling: </span>
            <span
              className="font-bold tabular-nums"
              style={{ color: latestBike > 5 ? colors.peach : colors.teal }}
            >
              {latestBike.toFixed(1)}%
            </span>
            {latestBike > 5 && (
              <span className="ml-2 text-peach text-xs">
                ⚠️ High - Focus on Low-Intensity Volume
              </span>
            )}
          </div>
        )}
        {latestRun != null && (
          <div>
            <span className="text-muted">Latest Running: </span>
            <span
              className="font-bold tabular-nums"
              style={{ color: latestRun > 5 ? colors.peach : colors.teal }}
            >
              {latestRun.toFixed(1)}%
            </span>
            {latestRun > 5 && (
              <span className="ml-2 text-peach text-xs">
                ⚠️ High - Focus on Low-Intensity Volume
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
