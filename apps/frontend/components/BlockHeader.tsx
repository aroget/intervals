"use client";

interface OverallCompliance {
  complianceRate: number;
  workoutsCompleted: number;
  workoutsPrescribed: number;
}

interface BlockHeaderProps {
  startDate: string;
  endDate: string;
  overallCompliance: OverallCompliance;
}

export default function BlockHeader({
  startDate,
  endDate,
  overallCompliance,
}: BlockHeaderProps) {
  return (
    <div className="p-4 sm:p-6 border-b border-border bg-gradient-to-r from-teal/5 to-transparent">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        {/* Left: Block Title & Dates */}
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-teal mb-2">
            Training Block
          </h2>
          <p className="text-sm text-text/60 font-medium">
            {startDate} → {endDate}
          </p>
        </div>

        {/* Right: Overall Block Stats */}
        <div className="flex gap-4 sm:gap-6">
          <div className="text-center">
            <p className="text-2xl sm:text-3xl font-bold tabular-nums text-teal">
              {overallCompliance.complianceRate}%
            </p>
            <p className="text-[10px] font-bold tracking-wider uppercase text-text/60 mt-1">
              Total Compliance
            </p>
          </div>
          <div className="text-center">
            <p className="text-2xl sm:text-3xl font-bold tabular-nums text-orange-bright">
              {overallCompliance.workoutsCompleted}
              <span className="text-lg text-text/40">
                /{overallCompliance.workoutsPrescribed}
              </span>
            </p>
            <p className="text-[10px] font-bold tracking-wider uppercase text-text/60 mt-1">
              Workouts Done
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
