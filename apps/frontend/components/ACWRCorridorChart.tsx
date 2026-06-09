"use client";

import { useState, useEffect } from "react";
import {
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { getChartColors } from "@intervals/brand/colors";
import { LoadingState } from "@intervals/ui/spinner";

interface ACWRDataPoint {
  date: string;
  acwr: number;
  atl: number;
  ctl: number;
  riskZone: "low" | "optimal" | "elevated" | "high";
}

const chartConfig = {
  acwr: { label: "ACWR Ratio" },
} as const;

export default function ACWRCorridorChart({
  athleteId,
  days = 90,
}: {
  athleteId: string;
  days?: number;
}) {
  const [data, setData] = useState<ACWRDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const colors = getChartColors();

  useEffect(() => {
    setLoading(true);
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/analysis/${athleteId}/acwr-chart?days=${days}`,
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
          Insufficient training data to calculate ACWR. Need at least 6 weeks of
          consistent training.
        </p>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getRiskColor = (zone: string) => {
    switch (zone) {
      case "optimal":
        return colors.teal;
      case "elevated":
        return colors.orange;
      case "high":
        return colors.peach;
      default:
        return colors.muted;
    }
  };

  const chartData = data.map((point) => ({
    date: formatDate(point.date),
    fullDate: point.date,
    acwr: point.acwr,
    atl: point.atl,
    ctl: point.ctl,
    riskZone: point.riskZone,
  }));

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded"
            style={{ backgroundColor: colors.teal, opacity: 0.2 }}
          />
          <span className="text-muted">Sweet Spot (0.8-1.3)</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded"
            style={{ backgroundColor: colors.peach, opacity: 0.2 }}
          />
          <span className="text-muted">Danger Zone (&gt;1.5)</span>
        </div>
      </div>

      <ChartContainer config={chartConfig} className="h-64 w-full">
        <LineChart
          data={chartData}
          margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
        >
          <defs>
            <linearGradient id="optimalZone" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.teal} stopOpacity={0.2} />
              <stop offset="100%" stopColor={colors.teal} stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="dangerZone" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.peach} stopOpacity={0.2} />
              <stop offset="100%" stopColor={colors.peach} stopOpacity={0.05} />
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
            domain={[0, 2]}
            tickLine={false}
            axisLine={false}
            tick={{ fill: colors.muted, fontSize: 11 }}
            label={{
              value: "ACWR Ratio",
              angle: -90,
              position: "insideLeft",
              style: { fill: colors.muted, fontSize: 11 },
            }}
          />

          {/* Sweet Spot Zone (0.8 - 1.3) */}
          <ReferenceArea
            y1={0.8}
            y2={1.3}
            fill="url(#optimalZone)"
            strokeOpacity={0}
          />

          {/* Danger Zone (> 1.5) */}
          <ReferenceArea
            y1={1.5}
            y2={2}
            fill="url(#dangerZone)"
            strokeOpacity={0}
          />

          {/* Reference lines */}
          <ReferenceLine
            y={0.8}
            stroke={colors.teal}
            strokeDasharray="3 3"
            strokeOpacity={0.5}
          />
          <ReferenceLine
            y={1.3}
            stroke={colors.teal}
            strokeDasharray="3 3"
            strokeOpacity={0.5}
          />
          <ReferenceLine
            y={1.5}
            stroke={colors.peach}
            strokeDasharray="3 3"
            strokeOpacity={0.5}
          />

          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name, data) => {
                  if (name === "acwr") {
                    const zone = data.riskZone;
                    const textColor =
                      zone === "high" || zone === "elevated"
                        ? colors.text
                        : getRiskColor(zone);
                    return [
                      <span
                        key="acwr"
                        className="font-bold"
                        style={{ color: textColor }}
                      >
                        {value}
                      </span>,
                      " ACWR",
                    ];
                  }
                  return value;
                }}
                labelFormatter={(label, payload) => {
                  const data = payload[0]?.payload;
                  if (!data) return label;
                  return (
                    <div className="space-y-1">
                      <div className="font-semibold">{label}</div>
                      <div className="text-xs text-muted">
                        ATL: {data.atl.toFixed(1)} | CTL: {data.ctl.toFixed(1)}
                      </div>
                    </div>
                  );
                }}
              />
            }
          />

          <Line
            type="monotone"
            dataKey="acwr"
            stroke={colors.text}
            strokeWidth={2}
            dot={(props) => {
              const { cx, cy, payload } = props;
              return (
                <circle
                  cx={cx}
                  cy={cy}
                  r={4}
                  fill={getRiskColor(payload.riskZone)}
                  stroke={colors.bg}
                  strokeWidth={2}
                />
              );
            }}
          />
        </LineChart>
      </ChartContainer>

      {/* Current Status */}
      {data.length > 0 && (
        <div className="text-center text-sm">
          <span className="text-muted">Current ACWR: </span>
          <span
            className="font-bold tabular-nums"
            style={{ color: getRiskColor(data[data.length - 1].riskZone) }}
          >
            {data[data.length - 1].acwr}
          </span>
          <span className="text-muted ml-2">
            (
            {data[data.length - 1].riskZone === "optimal"
              ? "Optimal - Continue Training"
              : data[data.length - 1].riskZone === "elevated"
                ? "Elevated - Monitor Load"
                : data[data.length - 1].riskZone === "high"
                  ? "High Risk - Reduce Volume"
                  : "Low Load - Build Gradually"}
            )
          </span>
        </div>
      )}
    </div>
  );
}
