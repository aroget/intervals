"use client";

import { useState, useEffect } from "react";

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

export default function BlockEffectivenessChart({
  athleteId,
}: {
  athleteId: string;
}) {
  const [data, setData] = useState<BlockData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/analysis/${athleteId}/block-effectiveness-chart`,
    )
      .then((r) => r.json())
      .then((res) => {
        if (res.error) {
          setError(res.error);
        } else {
          setData(res);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load block data");
        setLoading(false);
      });
  }, [athleteId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-teal border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center p-8">
        <p className="text-muted text-sm">
          {error ?? "Unable to load block effectiveness data."}
        </p>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const maxCtl = Math.max(data.baselineCtl, data.currentCtl);

  const zoneColors = {
    zone1: "var(--color-teal)",
    zone2: "var(--color-mint)",
    zone3: "var(--color-orange)",
    zone4: "var(--color-orange-bright)",
    zone5: "var(--color-peach)",
  };

  const zoneLabels = {
    zone1: "Recovery",
    zone2: "Endurance",
    zone3: "Tempo",
    zone4: "Threshold",
    zone5: "VO2/Anaerobic",
  };

  return (
    <div className="space-y-6">
      {/* Block Info */}
      <div className="bg-bg-assistant p-3 rounded-lg border border-border">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted">
            Current Block: {formatDate(data.blockStart)} —{" "}
            {formatDate(data.blockEnd)}
          </span>
          <span
            className={`font-semibold ${
              data.effectivenessScore >= 70
                ? "text-teal"
                : data.effectivenessScore >= 50
                  ? "text-orange"
                  : "text-peach"
            }`}
          >
            Effectiveness: {data.effectivenessScore}/100
          </span>
        </div>
      </div>

      {/* CTL Before/After Comparison */}
      <div>
        <h3 className="text-xs font-semibold tracking-[0.12em] uppercase text-muted mb-3">
          Fitness Progress (CTL)
        </h3>
        <div className="space-y-4">
          {/* Baseline CTL */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted">Block Start</span>
              <span className="text-sm font-semibold text-text">
                {data.baselineCtl}
              </span>
            </div>
            <div className="h-8 bg-bg-assistant rounded-lg overflow-hidden">
              <div
                className="h-full bg-teal opacity-60 transition-all"
                style={{
                  width: `${(data.baselineCtl / maxCtl) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* Current CTL */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted">Current</span>
              <span className="text-sm font-semibold text-teal">
                {data.currentCtl}
                <span className="text-xs text-muted ml-2">
                  ({data.ctlGain > 0 ? "+" : ""}
                  {data.ctlGain})
                </span>
              </span>
            </div>
            <div className="h-8 bg-bg-assistant rounded-lg overflow-hidden">
              <div
                className="h-full bg-teal transition-all"
                style={{
                  width: `${(data.currentCtl / maxCtl) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Intensity Distribution */}
      <div>
        <h3 className="text-xs font-semibold tracking-[0.12em] uppercase text-muted mb-3">
          Training Intensity Distribution
        </h3>

        {/* Stacked bar */}
        <div className="h-12 rounded-lg overflow-hidden flex">
          {(
            Object.keys(data.zonePercentages) as Array<
              keyof typeof data.zonePercentages
            >
          ).map((zone) => {
            const pct = data.zonePercentages[zone];
            if (pct === 0) return null;
            return (
              <div
                key={zone}
                className="flex items-center justify-center text-xs font-semibold text-white transition-all hover:opacity-90"
                style={{
                  width: `${pct}%`,
                  backgroundColor: zoneColors[zone],
                }}
                title={`${zoneLabels[zone]}: ${pct}%`}
              >
                {pct > 8 && `${pct}%`}
              </div>
            );
          })}
        </div>

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
              data.ctlGain > 0 ? "text-teal" : "text-peach"
            }`}
          >
            {data.ctlGain > 0 ? "+" : ""}
            {data.ctlGain}
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
              This block is highly effective with {data.ctlGain > 0 ? "+" : ""}
              {data.ctlGain} CTL gain and {data.complianceRate}% compliance.
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
              This block shows fitness gains ({data.ctlGain > 0 ? "+" : ""}
              {data.ctlGain} CTL) but has room for improvement.
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
              CTL change: {data.ctlGain > 0 ? "+" : ""}
              {data.ctlGain}. Compliance: {data.complianceRate}%.
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
