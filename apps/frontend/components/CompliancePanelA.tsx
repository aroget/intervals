"use client";

import { useState, useEffect } from "react";

interface BlockCompliance {
  blockStartDate: string;
  blockEndDate: string;
  weeklyReports: {
    weekNum: number;
    weekType: string;
    targetTss: number;
    actualTss: number;
    tssRate: number;
    workoutsCompleted: number;
    workoutsPrescribed: number;
    complianceRate: number;
  }[];
  overallCompliance: {
    workoutsCompleted: number;
    workoutsPrescribed: number;
    complianceRate: number;
    tssComplianceRate: number;
  };
}

export default function CompliancePanelA({ athleteId }: { athleteId: string }) {
  const [data, setData] = useState<BlockCompliance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/analysis/${athleteId}/compliance`)
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

  const getWeekTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "base":
        return "text-teal";
      case "build":
        return "text-orange";
      case "peak":
        return "text-orangeBright";
      case "recovery":
        return "text-peach";
      default:
        return "text-text";
    }
  };

  const getWeekTypeLabel = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const getTssComplianceStatus = (rate: number) => {
    if (rate >= 95) return "Exceeding Target";
    if (rate >= 85) return "On Target";
    if (rate >= 70) {
      const belowTarget = 100 - rate;
      return `${belowTarget}% Below Target`;
    }
    const belowTarget = 100 - rate;
    return `${belowTarget}% Below Target`;
  };

  const currentWeek =
    data.weeklyReports.find((w) => {
      const today = new Date();
      const blockStart = new Date(data.blockStartDate);
      const daysSinceStart = Math.floor(
        (today.getTime() - blockStart.getTime()) / 86_400_000,
      );
      const currentWeekNum = Math.floor(daysSinceStart / 7) + 1;
      return w.weekNum === currentWeekNum;
    }) ?? data.weeklyReports[data.weeklyReports.length - 1];

  const totalTargetTss = data.weeklyReports.reduce(
    (sum, w) => sum + w.targetTss,
    0,
  );
  const totalActualTss = data.weeklyReports.reduce(
    (sum, w) => sum + w.actualTss,
    0,
  );

  return (
    <div className="space-y-6">
      {/* Periodization Progression */}
      <div>
        <h3 className="text-xs font-semibold tracking-[0.12em] uppercase text-muted mb-3">
          Periodization Progression
        </h3>
        <div className="flex gap-2">
          {data.weeklyReports.map((week, idx) => {
            const isActive = week.weekNum === currentWeek.weekNum;
            const isFuture = week.weekNum > currentWeek.weekNum;

            return (
              <div
                key={idx}
                className={`flex-1 rounded-lg border p-3 transition-all ${
                  isActive
                    ? "border-teal bg-teal/10"
                    : isFuture
                      ? "border-border bg-bg-assistant opacity-50"
                      : "border-border bg-bg-assistant"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-semibold uppercase text-muted">
                    Week {week.weekNum}
                  </span>
                  <span
                    className={`text-xs font-semibold ${getWeekTypeColor(week.weekType)}`}
                  >
                    {getWeekTypeLabel(week.weekType)}
                  </span>
                </div>
                <div className="text-sm font-bold text-text">
                  {week.complianceRate}%
                  {!isFuture && (
                    <span className="text-[10px] text-muted ml-1">
                      {week.complianceRate >= 100 ? "Done" : "Active"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Volumetric Dynamics */}
      <div>
        <h3 className="text-xs font-semibold tracking-[0.12em] uppercase text-muted mb-3">
          Volumetric Dynamics
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {/* Volume Target */}
          <div className="bg-bg-assistant border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  data.overallCompliance.tssComplianceRate >= 85
                    ? "bg-teal"
                    : data.overallCompliance.tssComplianceRate >= 70
                      ? "bg-orange"
                      : "bg-peach"
                }`}
              />
              <span className="text-xs text-muted">Volume Target</span>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-text">
                {data.overallCompliance.tssComplianceRate}%{" "}
                <span className="text-[10px] text-muted">
                  {getTssComplianceStatus(
                    data.overallCompliance.tssComplianceRate,
                  )}
                </span>
              </p>
              <p className="text-[10px] text-muted tabular-nums">
                {totalActualTss} / {totalTargetTss} TSS
              </p>
            </div>
          </div>

          {/* Consistency */}
          <div className="bg-bg-assistant border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  data.overallCompliance.complianceRate >= 85
                    ? "bg-teal"
                    : data.overallCompliance.complianceRate >= 70
                      ? "bg-orange"
                      : "bg-peach"
                }`}
              />
              <span className="text-xs text-muted">Consistency</span>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-text">
                {data.overallCompliance.complianceRate}%{" "}
                <span className="text-[10px] text-muted">
                  {data.overallCompliance.complianceRate >= 85
                    ? "Excellent"
                    : data.overallCompliance.complianceRate >= 70
                      ? "Good"
                      : "Needs Improvement"}
                </span>
              </p>
              <p className="text-[10px] text-muted tabular-nums">
                {data.overallCompliance.workoutsCompleted} /{" "}
                {data.overallCompliance.workoutsPrescribed} Sessions
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
