"use client";

import ComplianceRing from "./ComplianceRing";

interface WeeklyReport {
  weekNumber: number;
  targetTss: number;
  actualTss: number;
  complianceRate: number;
  workoutsCompleted: number;
  workoutsPrescribed: number;
  tssComplianceRate: number;
  notes?: string;
}

interface WeekMetricsProps {
  weekData: WeeklyReport;
  selectedWeek: number;
  currentTsb: number | null;
}

export default function WeekMetrics({
  weekData,
  selectedWeek,
  currentTsb,
}: WeekMetricsProps) {
  return (
    <div className="lg:col-span-1">
      <h3 className="text-base font-bold text-text mb-4">
        Week {selectedWeek} Metrics
      </h3>

      {/* Target Metrics */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="p-3 rounded-lg bg-bg-assistant border border-border">
          <p className="text-[10px] font-bold tracking-wider uppercase text-text/60 mb-1">
            Target TSS
          </p>
          <p className="text-3xl font-bold tabular-nums text-teal">
            {weekData.targetTss}
          </p>
        </div>

        <div className="p-3 rounded-lg bg-bg-assistant border border-border">
          <p className="text-[10px] font-bold tracking-wider uppercase text-text/60 mb-1">
            Compliance Target
          </p>
          <p className="text-3xl font-bold tabular-nums text-orange-bright">
            {weekData.complianceRate}%
          </p>
        </div>

        {currentTsb !== null && (
          <div className="p-3 rounded-lg bg-bg-assistant border border-border">
            <p className="text-[10px] font-bold tracking-wider uppercase text-text/60 mb-1">
              Recovery Status (TSB)
            </p>
            <p
              className={`text-3xl font-bold tabular-nums ${
                currentTsb > 0
                  ? "text-teal"
                  : currentTsb < -25
                    ? "text-orange-bright"
                    : "text-text"
              }`}
            >
              {currentTsb > 0 ? "+" : ""}
              {currentTsb}
            </p>
          </div>
        )}
      </div>

      {/* Actual Performance Comparison */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* TSS Progress */}
        <div className="flex flex-col items-center p-4 rounded-lg bg-bg-assistant border border-border">
          <ComplianceRing
            actual={Math.round(weekData.actualTss)}
            target={Math.max(weekData.targetTss, 1)}
            size={100}
            strokeWidth={10}
          />
          <div className="mt-3 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text/70 mb-1">
              TSS Progress
            </p>
            <p className="text-xs font-semibold text-text tabular-nums">
              {Math.round(weekData.actualTss)} / {weekData.targetTss} TSS
            </p>
          </div>
        </div>

        {/* Workout Consistency */}
        <div className="flex flex-col items-center p-4 rounded-lg bg-bg-assistant border border-border">
          <ComplianceRing
            actual={weekData.workoutsCompleted}
            target={Math.max(weekData.workoutsPrescribed, 1)}
            size={100}
            strokeWidth={10}
          />
          <div className="mt-3 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text/70 mb-1">
              Workout Consistency
            </p>
            <p className="text-xs font-semibold text-text tabular-nums">
              {weekData.workoutsCompleted} / {weekData.workoutsPrescribed}{" "}
              Sessions
            </p>
          </div>
        </div>
      </div>

      {/* Week Notes (if any) */}
      {weekData.notes && (
        <div className="mt-4 mb-4 p-3 rounded-lg bg-bg-card border border-border">
          <p className="text-xs text-text/60 leading-relaxed italic">
            "{weekData.notes}"
          </p>
        </div>
      )}
    </div>
  );
}
