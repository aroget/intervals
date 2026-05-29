"use client";

import { useState, useEffect } from "react";

interface WeeklyReport {
  weekNumber: number;
  weekType: string;
  workoutsCompleted: number;
  workoutsPrescribed: number;
  complianceRate: number;
  targetTss: number;
  actualTss: number;
  tssComplianceRate: number;
  notes: string;
}

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

export default function ComplianceMetrics({
  athleteId,
}: {
  athleteId: string;
}) {
  const [complianceData, setComplianceData] = useState<any>(null);
  const [fitnessData, setFitnessData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [athleteId]);

  async function fetchData() {
    try {
      const [complianceRes, fitnessRes] = await Promise.all([
        fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/analysis/${athleteId}/compliance`,
        ),
        fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/analysis/${athleteId}/fitness-trajectory`,
        ),
      ]);

      const [compliance, fitness] = await Promise.all([
        complianceRes.json(),
        fitnessRes.json(),
      ]);

      setComplianceData(compliance);
      setFitnessData(fitness);
      setLoading(false);
    } catch (err) {
      console.error("Failed to load compliance data:", err);
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-bg-assistant rounded-2xl" />
        <div className="h-64 bg-bg-assistant rounded-2xl" />
      </div>
    );
  }

  if (
    !complianceData ||
    !fitnessData ||
    !fitnessData.checkpoints ||
    !complianceData.weeklyReports
  ) {
    return (
      <div className="text-center p-8 bg-bg-card border border-border rounded-2xl">
        <p className="text-muted">No compliance data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Effectiveness Score */}
      <div className="bg-bg-card rounded-2xl shadow-sm border-2 border-teal p-4 sm:p-6">
        <h3 className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted mb-3">
          Block Effectiveness
        </h3>
        <div className="flex items-end gap-2 sm:gap-3">
          <div className="text-4xl sm:text-5xl font-bold tabular-nums text-teal">
            {fitnessData.effectiveness}
          </div>
          <div className="text-xl sm:text-2xl mb-2 text-muted">/100</div>
        </div>
        <p className="mt-2 sm:mt-3 text-xs sm:text-sm text-muted">
          Based on fitness gains, compliance, and training load management
        </p>
      </div>

      {/* Overall Block Compliance */}
      <div className="bg-bg-card rounded-2xl shadow-sm border border-border p-4 sm:p-6">
        <h3 className="text-[18px] font-semibold text-teal mb-4">
          Block Compliance Summary
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl sm:text-3xl font-bold tabular-nums text-teal">
              {complianceData.overallCompliance.complianceRate}%
            </p>
            <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted mt-1">
              Workout Adherence
            </p>
          </div>
          <div className="text-center">
            <p className="text-2xl sm:text-3xl font-bold tabular-nums text-orange-bright">
              {complianceData.overallCompliance.workoutsCompleted}
            </p>
            <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted mt-1">
              Sessions Completed
            </p>
          </div>
          <div className="text-center">
            <p className="text-2xl sm:text-3xl font-bold tabular-nums text-text">
              {complianceData.overallCompliance.workoutsPrescribed}
            </p>
            <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted mt-1">
              Sessions Prescribed
            </p>
          </div>
        </div>
      </div>

      {/* Weekly Compliance Breakdown */}
      <div className="bg-bg-card rounded-2xl shadow-sm border border-border p-4 sm:p-6">
        <h3 className="text-[18px] font-semibold text-teal mb-4">
          Weekly Breakdown
        </h3>
        <div className="space-y-4">
          {complianceData.weeklyReports.map((week: WeeklyReport) => (
            <WeeklyComplianceCard key={week.weekNumber} week={week} />
          ))}
        </div>
      </div>

      {/* Fitness Trajectory */}
      <div className="bg-bg-card rounded-2xl shadow-sm border border-border p-4 sm:p-6">
        <h3 className="text-[18px] font-semibold text-teal mb-4">
          Fitness Trajectory (CTL)
        </h3>
        <div className="mb-6">
          <p className="text-xs sm:text-sm text-muted mb-4">
            Baseline CTL:{" "}
            <span className="font-bold text-text">
              {Math.round(fitnessData.baselineCtl * 100) / 100}
            </span>
          </p>
          <FitnessTrajectoryChart checkpoints={fitnessData.checkpoints} />
        </div>
      </div>
    </div>
  );
}

function WeeklyComplianceCard({ week }: { week: WeeklyReport }) {
  const getBadgeStyle = () => {
    if (week.complianceRate >= 85) {
      return "bg-teal-100 text-teal-700 border-teal-200";
    }
    if (week.complianceRate >= 60) {
      return "bg-amber-100 text-amber-700 border-amber-200";
    }
    return "bg-orange-100 text-orange-700 border-orange-200";
  };

  return (
    <div className="border border-border rounded-lg p-4 bg-bg-assistant">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h4 className="font-bold text-text">
            Week {week.weekNumber} —{" "}
            <span className="capitalize">{week.weekType}</span>
          </h4>
          <p className="text-sm text-muted">
            {week.workoutsCompleted}/{week.workoutsPrescribed} workouts
            completed
          </p>
        </div>
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getBadgeStyle()}`}
        >
          {week.complianceRate}%
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted">
            Training Load
          </p>
          <p className="text-sm font-medium text-text">
            {week.actualTss} / {week.targetTss} TSS
            <span
              className={`ml-2 text-xs font-semibold ${week.tssComplianceRate >= 90 && week.tssComplianceRate <= 110 ? "text-teal" : "text-orange-bright"}`}
            >
              ({week.tssComplianceRate}%)
            </span>
          </p>
        </div>
      </div>

      <p className="text-sm text-muted italic">{week.notes}</p>
    </div>
  );
}

function FitnessCheckpointCard({
  checkpoint,
}: {
  checkpoint: FitnessCheckpoint;
}) {
  const getTrendStyle = () => {
    if (checkpoint.trend === "ahead" || checkpoint.trend === "on_track") {
      return { color: "text-teal", bg: "bg-teal", border: "border-teal" };
    }
    if (checkpoint.trend === "behind") {
      return { color: "text-orange", bg: "bg-peach", border: "border-peach" };
    }
    return {
      color: "text-orange-bright",
      bg: "bg-orange-bright",
      border: "border-orange-bright",
    };
  };

  const trendIcon = {
    ahead: "↗",
    on_track: "→",
    behind: "↘",
    stalled: "⊙",
  }[checkpoint.trend];

  const style = getTrendStyle();

  return (
    <div
      className={`border-l-4 ${style.border} pl-4 pr-4 py-3 bg-bg-assistant rounded-r-lg`}
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="font-medium text-text">
            Week {checkpoint.weekInBlock} — {checkpoint.weekType}
          </p>
          <p className="text-sm text-muted">
            Expected:{" "}
            <span className="tabular-nums font-semibold">
              {checkpoint.expectedCtl}
            </span>{" "}
            CTL • Actual:{" "}
            <span className="tabular-nums font-semibold">
              {checkpoint.actualCtl}
            </span>{" "}
            CTL
          </p>
        </div>
        <div className={`flex items-center gap-1 font-bold ${style.color}`}>
          <span className="text-xl">{trendIcon}</span>
          <span className="capitalize text-sm whitespace-nowrap">
            {checkpoint.trend.replace("_", " ")}
          </span>
        </div>
      </div>
      <p className="text-sm text-muted mt-1">{checkpoint.note}</p>
    </div>
  );
}

function FitnessTrajectoryChart({
  checkpoints,
}: {
  checkpoints: FitnessCheckpoint[];
}) {
  if (checkpoints.length === 0) {
    return (
      <div className="border border-border rounded-lg p-5 bg-bg-assistant text-center text-sm text-muted">
        No fitness trajectory data available yet.
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg p-5 bg-bg-assistant space-y-4">
      {checkpoints.map((checkpoint) => {
        const percentage =
          checkpoint.expectedCtl > 0
            ? Math.round((checkpoint.actualCtl / checkpoint.expectedCtl) * 100)
            : 100;

        const cappedPercentage = Math.min(percentage, 100);
        const isBehind = percentage < 85;

        const getBadgeStyle = () => {
          if (checkpoint.weekType === "recovery") {
            return "bg-teal-100 text-teal-700 border-teal-200";
          }
          if (checkpoint.weekType === "peak") {
            return "bg-orange-100 text-orange-700 border-orange-200";
          }
          if (checkpoint.weekType === "build") {
            return "bg-amber-100 text-amber-700 border-amber-200";
          }
          return "bg-teal-100 text-teal-700 border-teal-200"; // base
        };

        return (
          <div key={checkpoint.weekInBlock} className="space-y-2">
            {/* Week header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-text">
                  Week {checkpoint.weekInBlock}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-bold border capitalize ${getBadgeStyle()}`}
                >
                  {checkpoint.weekType}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-lg sm:text-xl font-bold tabular-nums ${
                    isBehind ? "text-orange-bright" : "text-teal"
                  }`}
                >
                  {percentage}%
                </span>
                <span className="text-xs text-muted">of target</span>
              </div>
            </div>

            {/* Progress bar */}
            <div
              role="progressbar"
              aria-valuenow={cappedPercentage}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Week ${checkpoint.weekInBlock} CTL progress: ${percentage}% of target`}
              className="relative h-3 bg-bg-user rounded-lg overflow-hidden border border-border"
            >
              {/* Actual progress */}
              <div
                className={`absolute inset-y-0 left-0 transition-all duration-500 ${
                  isBehind
                    ? "bg-gradient-to-r from-orange-bright to-peach"
                    : "bg-teal"
                }`}
                style={{ width: `${cappedPercentage}%` }}
              />

              {/* CTL values overlay */}
              {/* <div className="absolute inset-0 flex items-center justify-between px-2 sm:px-3">
                <span className="text-[10px] sm:text-xs font-bold text-white drop-shadow-md">
                  {checkpoint.actualCtl} CTL
                </span>
                <span className="text-[10px] sm:text-xs font-semibold text-text">
                  target: {checkpoint.expectedCtl}
                </span>
              </div> */}
            </div>

            <p className="text-xs text-muted  pl-1">
              {checkpoint.actualCtl} / {checkpoint.expectedCtl} CTL
            </p>

            {/* Trend indicator */}
            {checkpoint.note && (
              <p className="text-xs text-muted italic pl-1">
                {checkpoint.note}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
