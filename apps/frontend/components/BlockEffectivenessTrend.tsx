"use client";

import useSWR from "swr";

import { API_URL, fetcher } from "@/lib/api";

import { Spinner } from "@intervals/ui/spinner";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

import { getChartColors } from "@intervals/brand/colors";

interface DailyDataPoint {
  day: number;

  date: string;

  actualScore: number | null;

  expectedMin: number;

  expectedMax: number;
}

interface BlockEffectivenessData {
  blockStart: string;

  blockEnd: string;

  currentWeek: number;

  weekType: string;

  currentScore: number | null;

  dailyData: DailyDataPoint[];
}

interface BlockEffectivenessTrendProps {
  athleteId: string;
}

export default function BlockEffectivenessTrend({
  athleteId,
}: BlockEffectivenessTrendProps) {
  const { data, error } = useSWR<BlockEffectivenessData>(
    `${API_URL}/analysis/${athleteId}/block-effectiveness-chart`,

    fetcher,

    { refreshInterval: 0, revalidateOnFocus: false },
  );

  const colors = getChartColors();

  if (error) {
    return (
      <div className="text-orange text-sm">
        Failed to load block effectiveness data
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  // Count days with actual scores

  const daysWithData = data.dailyData.filter(
    (d) => d.actualScore !== null,
  ).length;

  const isEarlyBlock = daysWithData < 3;

  // Handle pending data

  if (daysWithData === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-muted text-sm mb-2">Data pending...</div>

        <div className="text-xs text-muted/70 max-w-md">
          Complete your first week of training to see your effectiveness trend.
        </div>
      </div>
    );
  }

  // Process data to add underperformance indicator

  const processedData = data.dailyData.map((point) => ({
    ...point,

    // Mark underperformance (actual below expected min)

    underperformance:
      point.actualScore !== null && point.actualScore < point.expectedMin
        ? point.actualScore
        : null,
  }));

  // Custom tooltip

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    const data = payload[0].payload;

    const hasActual = data.actualScore !== null;

    const isUnderperforming = hasActual && data.actualScore < data.expectedMin;

    return (
      <div className="bg-bg-card border border-border rounded-lg p-3 shadow-lg">
        <div className="text-xs text-muted mb-2">
          Day {data.day} •{" "}
          {new Date(data.date).toLocaleDateString("en-US", {
            month: "short",

            day: "numeric",
          })}
        </div>

        {hasActual && (
          <div className="text-sm font-semibold mb-1">
            <span className="text-muted">Actual: </span>

            <span className={isUnderperforming ? "text-orange" : "text-teal"}>
              {Math.round(data.actualScore)}
            </span>
          </div>
        )}

        <div className="text-xs text-muted">
          Expected: {Math.round(data.expectedMin)}–
          {Math.round(data.expectedMax)}
        </div>

        {isUnderperforming && (
          <div className="text-xs text-orange mt-1">Below expected range</div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">
          Block Effectiveness Trend
        </h3>

        <div className="text-xs text-muted">
          Week {data.currentWeek} of 4 • {data.weekType}
        </div>
      </div>

      {/* Description */}

      <p className="text-xs text-muted leading-relaxed">
        Tracks your training block's trajectory over all 28 days. The shaded
        corridor shows the expected range for each day as you progress through
        the block. Your actual trend reveals how well training is translating to
        fitness gains. Staying above 70 indicates optimal adaptation.
      </p>

      {/* Early block notice */}

      {isEarlyBlock && (
        <div className="text-xs text-orange bg-orange/10 border border-orange/20 rounded-lg px-3 py-2">
          Early block: {daysWithData} {daysWithData === 1 ? "day" : "days"} of
          data. The corridor shows expected progression for the full 28-day
          block.
        </div>
      )}

      {/* Chart */}

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={processedData}
            margin={{ top: 20, right: 70, left: 20, bottom: 20 }}
          >
            <defs>
              {/* Expected corridor - lighter teal band */}

              <linearGradient id="expectedGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colors.teal} stopOpacity={0.25} />

                <stop offset="95%" stopColor={colors.teal} stopOpacity={0.1} />
              </linearGradient>

              {/* Underperformance gradient - subtle warning */}

              <linearGradient
                id="underperformGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="5%" stopColor={colors.orange} stopOpacity={0.4} />

                <stop
                  offset="95%"
                  stopColor={colors.orange}
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke={colors.border}
              opacity={0.2}
              vertical={false}
            />

            <XAxis
              dataKey="day"
              stroke={colors.muted}
              tick={{ fill: colors.muted, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              label={{
                value: "Day of Block",

                position: "insideBottom",

                offset: -10,

                style: { fill: colors.muted, fontSize: 11 },
              }}
              tickMargin={8}
            />

            <YAxis
              stroke={colors.muted}
              tick={{ fill: colors.muted, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              domain={[0, 100]}
              ticks={[0, 25, 50, 70, 100]}
              tickFormatter={(value) => value.toString()}
              label={{
                value: "Effectiveness",

                angle: -90,

                position: "insideLeft",

                style: {
                  fill: colors.muted,

                  fontSize: 11,

                  textAnchor: "middle",
                },
              }}
              width={50}
            />

            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: colors.teal, strokeWidth: 1, opacity: 0.3 }}
            />

            {/* Expected range corridor */}

            <Area
              type="monotone"
              dataKey="expectedMax"
              stroke="none"
              fill="url(#expectedGradient)"
              isAnimationActive={false}
            />

            <Area
              type="monotone"
              dataKey="expectedMin"
              stroke="none"
              fill={colors.bgCard}
              isAnimationActive={false}
            />

            {/* Reference line at 70 (optimal threshold) */}

            <ReferenceLine
              y={70}
              stroke={colors.orange}
              strokeDasharray="4 4"
              strokeOpacity={0.5}
              strokeWidth={1.5}
              label={{
                value: "Optimal",

                position: "center",

                style: {
                  fill: colors.orange,
                  fontSize: 11,
                  textAnchor: "middle",
                },
              }}
            />

            {/* Actual trend - teal line with dots like reference */}

            <Area
              type="monotone"
              dataKey="actualScore"
              stroke={colors.teal}
              strokeWidth={3}
              fill="none"
              dot={{
                r: 4,

                fill: colors.teal,

                strokeWidth: 0,

                fillOpacity: 0.7,
              }}
              activeDot={{
                r: 6,

                fill: colors.teal,

                strokeWidth: 2,

                stroke: colors.bg,
              }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend - colors match chart gradients exactly */}

      <div className="flex items-center justify-center gap-4 sm:gap-6 text-xs flex-wrap">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{
              backgroundColor: colors.teal,

              opacity: 0.3,
            }}
          />

          <span className="text-muted">Expected Range</span>
        </div>

        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{
              backgroundColor: colors.teal,
            }}
          />

          <span className="text-muted">Your Trend</span>
        </div>
      </div>
    </div>
  );
}
