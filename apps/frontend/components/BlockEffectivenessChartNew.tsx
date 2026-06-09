"use client";

import { useState, useEffect } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { getChartColors } from "@intervals/brand/colors";

interface BlockData {
  blockStart: string;
  blockEnd: string;
  baselineCtl: number;
  currentCtl: number;
  ctlGain: number;
  totalBlockTss: number;
  zonePercentages: {
    zone1: number;
    zone2: number;
    zone3: number;
    zone4: number;
    zone5: number;
  };
  complianceRate: number;
  effectivenessScore: number;
  totalHours: number;

  // Additional training metrics
  progressiveOverloadScore: number;
  consistencyScore: number;
  monotony: number;
  strain: number;
  monotonyScore: number;
  weeklyTss: number[];
  overtrainingRiskDays: number;
}

const zoneLabels = {
  zone1: "Recovery",
  zone2: "Endurance",
  zone3: "Tempo",
  zone4: "Threshold",
  zone5: "VO2/Anaerobic",
};

const chartConfig = {
  value: {
    label: "CTL",
  },
} as const;

export default function BlockEffectivenessChartNew({
  athleteId,
}: {
  athleteId: string;
}) {
  const [data, setData] = useState<BlockData | null>(null);
  const [loading, setLoading] = useState(true);
  const colors = getChartColors();

  const zoneColors = {
    zone1: colors.teal,
    zone2: colors.text + "4D", // 30% opacity
    zone3: colors.orange,
    zone4: colors.orangeBright,
    zone5: colors.peach,
  };

  useEffect(() => {
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/analysis/${athleteId}/block-effectiveness-chart`,
    )
      .then((r) => r.json())
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [athleteId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-teal border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center p-8">
        <p className="text-muted text-sm">No block data available yet.</p>
      </div>
    );
  }

  // Calculate actual CTL gain from displayed values (more accurate than API value)
  const ctlGain = data.currentCtl - data.baselineCtl;

  // Prepare CTL comparison data
  const ctlData = [
    { label: "Block Start", value: data.baselineCtl },
    { label: "Current", value: data.currentCtl },
  ];

  // Prepare intensity distribution data for stacked bar
  const intensityStackData = [
    {
      name: "Training Intensity",
      zone1: data.zonePercentages.zone1,
      zone2: data.zonePercentages.zone2,
      zone3: data.zonePercentages.zone3,
      zone4: data.zonePercentages.zone4,
      zone5: data.zonePercentages.zone5,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Block Info */}
      <div className="bg-bg-assistant p-3 rounded-lg border border-border flex items-center justify-between">
        <span className="text-xs text-muted">
          Current Block:{" "}
          {new Date(data.blockStart).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}{" "}
          –{" "}
          {new Date(data.blockEnd).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </span>
        <span
          className={`text-sm font-semibold ${
            data.effectivenessScore >= 75
              ? "text-teal"
              : data.effectivenessScore >= 50
                ? "text-orange"
                : "text-peach"
          }`}
        >
          Effectiveness: {data.effectivenessScore}/100
        </span>
      </div>

      {/* FITNESS PROGRESS (CTL) */}
      <div>
        <h3 className="text-xs font-semibold tracking-[0.12em] uppercase text-muted mb-3">
          Fitness Progress (CTL)
        </h3>

        <ChartContainer config={chartConfig} className="h-32 w-full">
          <BarChart
            data={ctlData}
            layout="vertical"
            margin={{ top: 5, right: 10, left: 80, bottom: 5 }}
            style={{ background: "transparent" }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={false}
              stroke={colors.border}
              opacity={0.3}
            />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tick={{ fill: colors.muted, fontSize: 11 }}
            />
            <YAxis
              dataKey="label"
              type="category"
              tickLine={false}
              axisLine={false}
              tick={{ fill: colors.muted, fontSize: 11 }}
              width={70}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value: any) => [`${value}`, "CTL"]}
                />
              }
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {ctlData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={index === 1 ? colors.teal : colors.text + "4D"}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>

        <div className="text-center mt-2">
          <span
            className={`text-sm font-semibold ${ctlGain > 0 ? "text-teal" : "text-peach"}`}
          >
            {ctlGain > 0 ? "+" : ""}
            {ctlGain} CTL gain
          </span>
        </div>
      </div>

      {/* Intensity Distribution */}
      <div>
        <h3 className="text-xs font-semibold tracking-[0.12em] uppercase text-muted mb-3">
          Training Intensity Distribution
        </h3>

        <ChartContainer config={{}} className="h-16 w-full">
          <BarChart
            data={intensityStackData}
            layout="vertical"
            margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
            style={{ background: "transparent" }}
          >
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis type="category" hide />
            <ChartTooltip
              content={({ active, payload }: any) => {
                if (!active || !payload || payload.length === 0) return null;

                const zones = payload.filter(
                  (p: any) => (p.value as number) > 0,
                );
                return (
                  <div className="bg-bg-card border-2 border-teal rounded-lg shadow-lg p-2 text-xs">
                    <div className="space-y-1">
                      {zones.map((zone: any, index: number) => (
                        <div
                          key={String(zone.dataKey) || `zone-${index}`}
                          className="flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-1.5">
                            <div
                              className="w-2 h-2 rounded-sm"
                              style={{ backgroundColor: zone.color }}
                            />
                            <span className="text-muted">
                              {
                                zoneLabels[
                                  zone.dataKey as keyof typeof zoneLabels
                                ]
                              }
                            </span>
                          </div>
                          <span className="font-semibold text-text tabular-nums">
                            {zone.value}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="zone5"
              stackId="a"
              fill={zoneColors.zone5}
              radius={[0, 4, 4, 0]}
            />
            <Bar dataKey="zone4" stackId="a" fill={zoneColors.zone4} />
            <Bar dataKey="zone3" stackId="a" fill={zoneColors.zone3} />
            <Bar dataKey="zone2" stackId="a" fill={zoneColors.zone2} />
            <Bar
              dataKey="zone1"
              stackId="a"
              fill={zoneColors.zone1}
              radius={[4, 0, 0, 4]}
            />
          </BarChart>
        </ChartContainer>

        {/* Legend */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3">
          {(
            Object.keys(data.zonePercentages) as Array<
              keyof typeof data.zonePercentages
            >
          ).map((zone) => (
            <div key={zone} className="flex items-center gap-1.5 text-xs">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: zoneColors[zone] }}
              />
              <span className="text-muted">
                {zoneLabels[zone]} ({data.zonePercentages[zone]}%)
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Training Quality Metrics */}
      <div>
        <h3 className="text-xs font-semibold tracking-[0.12em] uppercase text-muted mb-3">
          Training Quality Metrics
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Progressive Overload */}
          <div className="bg-bg-assistant p-3 rounded-lg border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted">Progressive Overload</span>
              <span
                className={`text-sm font-semibold ${
                  data.progressiveOverloadScore >= 80
                    ? "text-teal"
                    : data.progressiveOverloadScore >= 50
                      ? "text-orange"
                      : "text-peach"
                }`}
              >
                {data.progressiveOverloadScore}/100
              </span>
            </div>
            <div className="text-[10px] text-muted">
              Weekly TSS: {data.weeklyTss.join(" → ")}
            </div>
          </div>

          {/* Consistency */}
          <div className="bg-bg-assistant p-3 rounded-lg border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted">Consistency</span>
              <span
                className={`text-sm font-semibold ${
                  data.consistencyScore >= 80
                    ? "text-teal"
                    : data.consistencyScore >= 60
                      ? "text-orange"
                      : "text-peach"
                }`}
              >
                {Math.round(data.consistencyScore)}/100
              </span>
            </div>
            <div className="text-[10px] text-muted">
              Regular training frequency
            </div>
          </div>

          {/* Monotony */}
          <div className="bg-bg-assistant p-3 rounded-lg border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted">Monotony (Foster)</span>
              <span
                className={`text-sm font-semibold ${
                  data.monotony < 2
                    ? "text-teal"
                    : data.monotony < 3
                      ? "text-orange"
                      : "text-peach"
                }`}
              >
                {data.monotony}
              </span>
            </div>
            <div className="text-[10px] text-muted">
              {data.monotony < 2
                ? "Good variety"
                : data.monotony < 3
                  ? "Moderate variation"
                  : "High risk - lacks variety"}
            </div>
          </div>

          {/* Strain */}
          <div className="bg-bg-assistant p-3 rounded-lg border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted">Strain</span>
              <span className="text-sm font-semibold text-text">
                {data.strain}
              </span>
            </div>
            <div className="text-[10px] text-muted">
              {data.overtrainingRiskDays > 0
                ? `⚠️ ${data.overtrainingRiskDays} day${data.overtrainingRiskDays > 1 ? "s" : ""} overtraining risk`
                : "No overtraining detected"}
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-border">
        <div className="text-center">
          <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted">
            Total TSS
          </p>
          <p className="text-xl font-bold tabular-nums text-teal mt-1">
            {data.totalBlockTss}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted">
            Total Hours
          </p>
          <p className="text-xl font-bold tabular-nums text-text mt-1">
            {data.totalHours}h
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted">
            Compliance
          </p>
          <p className="text-xl font-bold tabular-nums text-orange mt-1">
            {data.complianceRate}%
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted">
            CTL Gain
          </p>
          <p
            className={`text-xl font-bold tabular-nums mt-1 ${
              ctlGain > 0 ? "text-teal" : "text-peach"
            }`}
          >
            {ctlGain > 0 ? "+" : ""}
            {ctlGain}
          </p>
        </div>
      </div>

      {/* Interpretation */}
      <div className="bg-bg-assistant p-4 rounded-lg border border-border">
        <h4 className="text-xs font-semibold text-text mb-2">Block Analysis</h4>
        <p className="text-xs text-muted leading-relaxed">
          {data.effectivenessScore >= 70 && (
            <>
              <span className="text-teal font-semibold">
                Excellent progress!
              </span>{" "}
              This block is highly effective with {ctlGain > 0 ? "+" : ""}
              {ctlGain} CTL gain and {data.complianceRate}% compliance.
              {data.monotony >= 3 &&
                " However, training monotony is high - consider adding more variety."}
              {data.progressiveOverloadScore < 80 &&
                " Progressive overload could be improved with more consistent week-to-week increases."}
            </>
          )}
          {data.effectivenessScore >= 50 && data.effectivenessScore < 70 && (
            <>
              <span className="text-orange font-semibold">
                Moderate progress.
              </span>{" "}
              This block shows fitness gains ({ctlGain > 0 ? "+" : ""}
              {ctlGain} CTL) but has room for improvement.
              {data.complianceRate < 80 &&
                ` Compliance is ${data.complianceRate}% - aim for 85%+.`}
              {data.monotony >= 3 &&
                " High monotony detected - vary your training more."}
              {data.consistencyScore < 70 &&
                " Consistency could be improved with more regular training."}
            </>
          )}
          {data.effectivenessScore < 50 && (
            <>
              <span className="text-peach font-semibold">
                Limited effectiveness.
              </span>{" "}
              CTL change: {ctlGain > 0 ? "+" : ""}
              {ctlGain}. Compliance: {data.complianceRate}%.
              {data.overtrainingRiskDays > 0 &&
                ` ⚠️ ${data.overtrainingRiskDays} day(s) with overtraining risk detected.`}
              {data.monotony >= 3 && " Training lacks variety (high monotony)."}
              {data.consistencyScore < 60 &&
                " Inconsistent training frequency."}{" "}
              Consider reviewing your training plan and recovery protocols.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
