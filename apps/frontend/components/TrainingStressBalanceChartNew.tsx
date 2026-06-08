"use client";

import { useState, useEffect } from "react";
import {
  Line,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { getChartColors } from "@/lib/chartColors";

interface DataPoint {
  date: string;
  tss: number;
  atl: number;
  ctl: number;
  tsb: number;
}

const chartConfig = {
  ctl: {
    label: "Fitness (CTL)",
  },
  atl: {
    label: "Fatigue (ATL)",
  },
  tsb: {
    label: "Form (TSB)",
  },
} as const;

export default function TrainingStressBalanceChartNew({
  athleteId,
  days = 60,
}: {
  athleteId: string;
  days?: number;
}) {
  const [allData, setAllData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const colors = getChartColors();

  useEffect(() => {
    setLoading(true);
    // Always fetch full dataset (90 days) to ensure we have today's values
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/analysis/${athleteId}/training-stress-balance?days=90`,
    )
      .then((r) => r.json())
      .then((res) => {
        setAllData(res.data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [athleteId]); // Only refetch when athleteId changes, not when days changes

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-teal border-t-transparent rounded-full" />
      </div>
    );
  }

  if (allData.length === 0) {
    return (
      <div className="text-center p-8">
        <p className="text-muted text-sm">
          No training data yet. Complete some workouts to see TSB trends.
        </p>
      </div>
    );
  }

  // Get actual current (latest) values - these never change with timeframe
  const latestPoint = allData[allData.length - 1];
  const currentCtl = latestPoint?.ctl ?? 0;
  const currentAtl = latestPoint?.atl ?? 0;
  const currentTsb = latestPoint?.tsb ?? 0;
  const currentDate = latestPoint?.date
    ? new Date(latestPoint.date + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : "";

  // Filter data for chart display based on selected timeframe
  const data = allData.slice(-days);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getFormZoneColor = (tsb: number) => {
    if (tsb < -30) return colors.peach;
    if (tsb < -10) return colors.teal;
    if (tsb < 5) return colors.orange;
    return colors.muted;
  };

  const chartData = data.map((point) => ({
    date: formatDate(point.date),
    fullDate: point.date,
    ctl: point.ctl,
    atl: point.atl,
    tsb: point.tsb,
    tss: point.tss,
  }));

  return (
    <div className="space-y-4">
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
      <ChartContainer config={chartConfig} className="h-72 w-full">
        <LineChart
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
          <ReferenceLine
            y={-10}
            stroke={colors.teal}
            strokeDasharray="3 3"
            opacity={0.3}
          />
          <ReferenceLine
            y={-30}
            stroke={colors.peach}
            strokeDasharray="3 3"
            opacity={0.3}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name, item) => {
                  const data = item.payload;
                  if (name === "ctl") {
                    return [`${value}`, "Fitness (CTL)"];
                  }
                  if (name === "atl") {
                    return [`${value}`, "Fatigue (ATL)"];
                  }
                  if (name === "tsb") {
                    return [
                      <span style={{ color: getFormZoneColor(data.tsb) }}>
                        {data.tsb > 0 ? "+" : ""}
                        {value}
                      </span>,
                      "Form (TSB)",
                    ];
                  }
                  return value;
                }}
              />
            }
          />
          <Line
            type="monotone"
            dataKey="ctl"
            stroke={colors.teal}
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="atl"
            stroke={colors.orange}
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="tsb"
            stroke={colors.muted}
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
          />
        </LineChart>
      </ChartContainer>

      {/* Summary Stats - Always show actual current values */}
      <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border">
        <div className="text-center">
          <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted">
            Latest CTL · {currentDate}
          </p>
          <p className="text-xl font-bold tabular-nums text-teal mt-1">
            {currentCtl.toFixed(1)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted">
            Latest ATL · {currentDate}
          </p>
          <p className="text-xl font-bold tabular-nums text-orange mt-1">
            {currentAtl.toFixed(1)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted">
            Latest TSB · {currentDate}
          </p>
          <p
            className="text-xl font-bold tabular-nums mt-1"
            style={{
              color: getFormZoneColor(currentTsb),
            }}
          >
            {currentTsb > 0 ? "+" : ""}
            {currentTsb.toFixed(1)}
          </p>
        </div>
      </div>
    </div>
  );
}
