"use client";

import { useState, useEffect } from "react";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { getChartColors } from "@intervals/brand/colors";

interface BlockData {
  baselineCtl: number;
  currentCtl: number;
  ctlGain: number;
  zonePercentages: {
    zone1: number;
    zone2: number;
    zone3: number;
    zone4: number;
    zone5: number;
  };
  totalHours: number;
}

const zoneLabels = {
  zone1: "Recovery",
  zone2: "Endurance",
  zone3: "Tempo",
  zone4: "Threshold",
  zone5: "VO2/Anaerobic",
};

export default function PhysiologyPanelB({ athleteId }: { athleteId: string }) {
  const [data, setData] = useState<BlockData | null>(null);
  const [loading, setLoading] = useState(true);
  const colors = getChartColors();

  const zoneColors = {
    zone1: colors.teal, // Recovery - teal
    zone2: "#10b981", // Endurance - green
    zone3: colors.orange, // Tempo - orange
    zone4: colors.orangeBright, // Threshold - bright orange
    zone5: "#ef4444", // VO2 - red
  };

  useEffect(() => {
    setLoading(true);
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

  if (loading || !data) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-24 bg-muted/20 rounded" />
        <div className="h-32 bg-muted/20 rounded" />
      </div>
    );
  }

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

  const ctlGain = data.currentCtl - data.baselineCtl;
  const ctlGainPct =
    data.baselineCtl > 0 ? Math.round((ctlGain / data.baselineCtl) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Intensity Zone Distribution */}
      <div>
        <h3 className="text-xs font-semibold tracking-[0.12em] uppercase text-muted mb-3">
          Intensity Zone Distribution Balance
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
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;

                const zones = payload.filter((p) => (p.value as number) > 0);
                return (
                  <div className="bg-bg-card border-2 border-teal rounded-lg shadow-lg p-2 text-xs">
                    <div className="space-y-1">
                      {zones.map((zone, idx) => (
                        <div
                          key={idx}
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
                {zoneLabels[zone].split("/")[0]} ({data.zonePercentages[zone]}%)
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Metabolic Engine Changes */}
      <div>
        <h3 className="text-xs font-semibold tracking-[0.12em] uppercase text-muted mb-3">
          Metabolic Engine Changes
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {/* Engine Growth (CTL) */}
          <div className="bg-bg-assistant border border-border rounded-lg p-4">
            <div className="mb-2">
              <span className="text-xs text-muted">Engine Growth (CTL)</span>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-text tabular-nums">
                {data.baselineCtl} → {data.currentCtl}
              </p>
              <p
                className={`text-lg font-bold tabular-nums ${
                  ctlGain > 0
                    ? "text-teal"
                    : ctlGain < 0
                      ? "text-peach"
                      : "text-text"
                }`}
              >
                {ctlGain > 0 ? "+" : ""}
                {ctlGain} ({ctlGainPct > 0 ? "+" : ""}
                {ctlGainPct}%)
              </p>
            </div>
          </div>

          {/* Training Hours */}
          <div className="bg-bg-assistant border border-border rounded-lg p-4">
            <div className="mb-2">
              <span className="text-xs text-muted">Total Training Time</span>
            </div>
            <div className="space-y-1">
              <p className="text-lg font-bold text-text tabular-nums">
                {data.totalHours}h
              </p>
              <p className="text-[10px] text-muted">Block Volume</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
