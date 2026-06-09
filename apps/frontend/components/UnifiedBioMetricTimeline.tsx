"use client";

import { useState, useEffect } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { getChartColors } from "@intervals/brand/colors";

interface DataPoint {
  date: string;
  readinessScore: number | null;
  tsb: number | null;
  tss: number;
  formattedDate: string;
}

const chartConfig = {
  readiness: { label: "Readiness" },
  tsb: { label: "TSB" },
  tss: { label: "TSS" },
} as const;

export default function UnifiedBioMetricTimeline({
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

    // Fetch both readiness and TSB data
    Promise.all([
      fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/analysis/${athleteId}/recovery-readiness-chart?days=${days}`,
      ).then((r) => r.json()),
      fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/analysis/${athleteId}/training-stress-balance?days=${days}`,
      ).then((r) => r.json()),
    ])
      .then(([readinessRes, tsbRes]) => {
        // Merge the data by date
        const dataMap = new Map<string, DataPoint>();

        // Add readiness data
        (readinessRes.data ?? []).forEach((r: any) => {
          dataMap.set(r.date, {
            date: r.date,
            readinessScore: r.readinessScore,
            tsb: 0,
            tss: r.tss ?? 0,
            formattedDate: new Date(r.date + "T00:00:00").toLocaleDateString(
              "en-US",
              { month: "short", day: "numeric" },
            ),
          });
        });

        // Add/merge TSB data
        (tsbRes.data ?? []).forEach((t: any) => {
          const existing = dataMap.get(t.date);
          if (existing) {
            existing.tsb = t.tsb ?? 0;
          } else {
            dataMap.set(t.date, {
              date: t.date,
              readinessScore: null,
              tsb: t.tsb ?? 0,
              tss: t.tss ?? 0,
              formattedDate: new Date(t.date + "T00:00:00").toLocaleDateString(
                "en-US",
                { month: "short", day: "numeric" },
              ),
            });
          }
        });

        // Sort by date
        const merged = Array.from(dataMap.values()).sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        );

        setData(merged);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [athleteId, days]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-80">
        <div className="animate-spin h-8 w-8 border-4 border-teal border-t-transparent rounded-full" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center p-8">
        <p className="text-muted text-sm">
          No data available for this timeframe.
        </p>
      </div>
    );
  }

  return (
    <>
      <ChartContainer config={chartConfig} className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 20, right: 60, left: 20, bottom: 20 }}
            style={{ background: "transparent" }}
          >
            <defs>
              {/* Gradient for optimal TSB zone */}
              <linearGradient id="optimalTsbZone" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={colors.orange}
                  stopOpacity={0.15}
                />
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

            {/* X-Axis */}
            <XAxis
              dataKey="formattedDate"
              tickLine={false}
              axisLine={false}
              tick={{ fill: colors.muted, fontSize: 11 }}
              interval="preserveStartEnd"
            />

            {/* Left Y-Axis: Readiness (0-100) */}
            <YAxis
              yAxisId="left"
              domain={[0, 100]}
              tickLine={false}
              axisLine={false}
              tick={{ fill: colors.muted, fontSize: 11 }}
              label={{
                value: "Readiness",
                angle: -90,
                position: "insideLeft",
                style: { fill: colors.muted, fontSize: 11 },
              }}
            />

            {/* Right Y-Axis: TSB & TSS */}
            <YAxis
              yAxisId="right"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tick={{ fill: colors.muted, fontSize: 11 }}
              label={{
                value: "TSB / TSS",
                angle: 90,
                position: "insideRight",
                style: { fill: colors.muted, fontSize: 11 },
              }}
            />

            {/* Optimal TSB reference area (-30 to -10) */}
            <ReferenceLine
              yAxisId="right"
              y={-10}
              stroke={colors.orange}
              strokeDasharray="3 3"
              strokeWidth={1}
              label={{
                value: "Optimal Zone",
                position: "right",
                fill: colors.orange,
                fontSize: 10,
              }}
            />
            <ReferenceLine
              yAxisId="right"
              y={-30}
              stroke={colors.orange}
              strokeDasharray="3 3"
              strokeWidth={1}
            />

            <ChartTooltip
              content={({ active, payload }: any) => {
                if (!active || !payload || payload.length === 0) return null;
                const data = payload[0].payload;

                return (
                  <div className="bg-bg-card border-2 border-teal rounded-lg shadow-lg p-3 text-xs">
                    <div className="font-semibold text-text mb-2">
                      {data.formattedDate}
                    </div>
                    <div className="space-y-1">
                      {data.readinessScore !== null && (
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted">Readiness:</span>
                          <span
                            className="font-semibold tabular-nums"
                            style={{
                              color:
                                data.readinessScore >= 80
                                  ? colors.teal
                                  : data.readinessScore >= 55
                                    ? colors.orange
                                    : colors.peach,
                            }}
                          >
                            {data.readinessScore}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted">TSB:</span>
                        <span className="font-semibold text-text tabular-nums">
                          {data.tsb > 0 ? "+" : ""}
                          {(data.tsb ?? 0).toFixed(1)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted">TSS:</span>
                        <span className="font-semibold text-text tabular-nums">
                          {data.tss}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }}
            />

            {/* Readiness Bars (Left Axis) */}
            <Bar
              yAxisId="left"
              dataKey="readinessScore"
              radius={[4, 4, 0, 0]}
              fillOpacity={0.8}
            >
              {data.map((entry, index) => {
                let barColor = colors.teal;
                if (entry.readinessScore !== null) {
                  if (entry.readinessScore < 55) barColor = colors.peach;
                  else if (entry.readinessScore < 80) barColor = colors.orange;
                }
                return <Cell key={`cell-${index}`} fill={barColor} />;
              })}
            </Bar>

            {/* TSB Line (Right Axis) - Solid */}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="tsb"
              stroke={colors.orange}
              strokeWidth={2.5}
              dot={false}
              name="TSB (Form)"
            />

            {/* TSS Line (Right Axis) - Dotted */}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="tss"
              stroke={colors.text}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              opacity={0.6}
              name="TSS (Workload)"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartContainer>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 text-xs">
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-3 rounded-sm"
            style={{ backgroundColor: colors.teal }}
          />
          <span className="text-muted">Readiness (Left)</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-0.5 rounded"
            style={{ backgroundColor: colors.orange }}
          />
          <span className="text-muted">TSB Form (Right)</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-0.5 border-t-2 border-dashed"
            style={{ borderColor: colors.text, opacity: 0.6 }}
          />
          <span className="text-muted">TSS Volume (Right)</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-3 rounded-sm"
            style={{
              background:
                "linear-gradient(to bottom, rgba(255,167,38,0.15), rgba(255,167,38,0.05))",
            }}
          />
          <span className="text-muted">Optimal Zone (-30 to -10)</span>
        </div>
      </div>
    </>
  );
}
