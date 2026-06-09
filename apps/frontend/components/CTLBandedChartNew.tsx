"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  Area,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { getChartColors } from "@intervals/brand/colors";

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

const chartConfig = {
  actualCtl: {
    label: "Actual CTL",
  },
  expectedCtl: {
    label: "Expected CTL",
  },
} as const;

export default function CTLBandedChartNew({
  checkpoints,
  baselineCtl,
}: {
  checkpoints: FitnessCheckpoint[];
  baselineCtl: number;
}) {
  const colors = getChartColors();

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

  // Prepare chart data with tolerance band
  const chartData = checkpoints.map((checkpoint) => {
    const upperBound = checkpoint.expectedCtl * 1.05;
    const lowerBound = checkpoint.expectedCtl * 0.95;

    return {
      week: `W${checkpoint.weekInBlock}`,
      weekInBlock: checkpoint.weekInBlock,
      weekType: checkpoint.weekType,
      actualCtl: checkpoint.actualCtl,
      expectedCtl: checkpoint.expectedCtl,
      upperBound,
      lowerBound,
      deviation: checkpoint.deviation,
      trend: checkpoint.trend,
      note: checkpoint.note,
    };
  });

  // Calculate domain
  const allValues = [
    ...checkpoints.map((c) => c.expectedCtl * 1.05),
    ...checkpoints.map((c) => c.expectedCtl * 0.95),
    ...checkpoints.map((c) => c.actualCtl),
    baselineCtl,
  ];
  const minCtl = Math.floor(Math.min(...allValues) * 0.95);
  const maxCtl = Math.ceil(Math.max(...allValues) * 1.05);

  return (
    <div className="space-y-4">
      <div className="bg-bg-assistant p-4 rounded-lg border border-border">
        <ResponsiveContainer width="100%" height={256}>
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
            style={{ background: "transparent" }}
          >
            <defs>
              {/* Gradient for tolerance band */}
              <linearGradient id="bandGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colors.teal} stopOpacity={0.15} />
                <stop offset="95%" stopColor={colors.teal} stopOpacity={0.05} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke={colors.border}
              opacity={0.4}
            />

            <XAxis
              dataKey="week"
              tickLine={false}
              axisLine={false}
              tick={{ fill: colors.muted, fontSize: 11 }}
            />

            <YAxis
              domain={[minCtl, maxCtl]}
              tickLine={false}
              axisLine={false}
              tick={{ fill: colors.muted, fontSize: 11 }}
              tickFormatter={(value) => Math.round(value).toString()}
            />

            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const data = payload[0].payload;

                const getTrendStyle = () => {
                  if (data.trend === "ahead" || data.trend === "on_track") {
                    return { color: colors.teal, icon: "✓" };
                  }
                  if (data.trend === "behind") {
                    return { color: colors.orangeBright, icon: "↓" };
                  }
                  return { color: colors.muted, icon: "•" };
                };

                const style = getTrendStyle();
                const ctlGain = data.actualCtl - baselineCtl;

                return (
                  <div className="bg-bg-card border-2 border-teal rounded-lg shadow-lg p-3 text-xs">
                    <div className="font-semibold text-text mb-2">
                      Week {data.weekInBlock} —{" "}
                      <span className="capitalize">{data.weekType}</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted">Actual CTL:</span>
                        <span className="font-bold text-teal tabular-nums">
                          {data.actualCtl.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted">Expected CTL:</span>
                        <span className="font-semibold text-text tabular-nums">
                          {data.expectedCtl.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted">Deviation:</span>
                        <span
                          className="font-semibold tabular-nums"
                          style={{ color: style.color }}
                        >
                          {data.deviation > 0 ? "+" : ""}
                          {data.deviation.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted">Fitness Gain:</span>
                        <span className="font-semibold text-teal tabular-nums">
                          +{ctlGain.toFixed(1)} pts
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }}
            />

            {/* Tolerance band area (±5%) - using gradient fill */}
            <Area
              type="monotone"
              dataKey="upperBound"
              stroke="none"
              fill="url(#bandGradient)"
              fillOpacity={1}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="lowerBound"
              stroke="none"
              fill="transparent"
              fillOpacity={0}
              isAnimationActive={false}
            />

            {/* Expected CTL line (dashed) */}
            <Line
              type="monotone"
              dataKey="expectedCtl"
              stroke={colors.teal}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              opacity={0.6}
            />

            {/* Actual CTL line */}
            <Line
              type="monotone"
              dataKey="actualCtl"
              stroke={colors.teal}
              strokeWidth={2.5}
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                const isBehind = payload.trend === "behind";
                const isAhead = payload.trend === "ahead";

                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={5}
                    fill={
                      isBehind
                        ? colors.orangeBright
                        : isAhead
                          ? colors.teal
                          : colors.text
                    }
                    stroke={colors.bg}
                    strokeWidth={2}
                    className="cursor-pointer"
                  />
                );
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 mt-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-0.5"
              style={{ backgroundColor: colors.teal }}
            />
            <span className="text-muted">Actual CTL</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-0.5 border-t-2 border-dashed"
              style={{ borderColor: colors.teal, opacity: 0.6 }}
            />
            <span className="text-muted">Expected CTL</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded"
              style={{
                backgroundColor: colors.teal,
                opacity: 0.1,
                border: `1px solid ${colors.teal}`,
              }}
            />
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
                        {ctlGain.toFixed(1)} pts
                      </span>
                    </div>
                  </div>
                </div>
                {checkpoint.note && (
                  <div className="text-[10px] text-muted italic max-w-[140px]">
                    {checkpoint.note}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
