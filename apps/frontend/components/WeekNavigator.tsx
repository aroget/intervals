"use client";

interface WeeklyReport {
  weekNumber: number;
  weekType: string;
  workoutsCompleted: number;
  workoutsPrescribed: number;
  complianceRate: number;
  targetTss: number;
  actualTss: number;
  tssComplianceRate: number;
}

interface BlockData {
  currentWeek: number;
}

interface WeekNavigatorProps {
  weeklyReports: WeeklyReport[];
  blockData: BlockData;
  selectedWeek: number;
  onSelectWeek: (weekNumber: number) => void;
}

export default function WeekNavigator({
  weeklyReports,
  blockData,
  selectedWeek,
  onSelectWeek,
}: WeekNavigatorProps) {
  return (
    <div className="p-4 sm:p-6 border-b border-border bg-bg-assistant">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {weeklyReports.map((week: WeeklyReport) => {
          const isCurrent = week.weekNumber === blockData.currentWeek;
          const isSelected = week.weekNumber === selectedWeek;
          const avgCompliance = Math.round(
            (week.tssComplianceRate + week.complianceRate) / 2,
          );
          const isCompleted = week.weekNumber < blockData.currentWeek;

          return (
            <button
              key={week.weekNumber}
              onClick={() => onSelectWeek(week.weekNumber)}
              className={`relative p-3 rounded-xl border-2 transition-all hover:scale-102 ${
                isSelected
                  ? "border-teal bg-teal/10 scale-105"
                  : "border-border bg-bg-card hover:border-teal/30"
              }`}
            >
              {/* Current week pulse indicator */}
              {isCurrent && (
                <div className="absolute -top-1 -right-1 w-3 h-3">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-teal opacity-75 animate-ping" />
                  <span className="absolute inline-flex rounded-full h-3 w-3 bg-teal" />
                </div>
              )}

              {/* Week Title & Badge */}
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                    week.weekType === "recovery"
                      ? "bg-peach/20 text-peach"
                      : week.weekType === "peak"
                        ? "bg-orange-bright/20 text-orange-bright"
                        : week.weekType === "build"
                          ? "bg-orange/20 text-orange"
                          : "bg-teal/20 text-teal"
                  }`}
                >
                  {week.weekType}
                </span>
              </div>

              {/* Compliance Bar */}
              <div className="mb-2">
                <div className="h-1.5 bg-bg-assistant rounded-full overflow-hidden border border-border/50">
                  <div
                    className={`h-full transition-all ${
                      avgCompliance >= 90
                        ? "bg-teal"
                        : avgCompliance >= 70
                          ? "bg-orange"
                          : "bg-peach"
                    }`}
                    style={{ width: `${Math.min(avgCompliance, 100)}%` }}
                  />
                </div>
              </div>

              {/* Status & Percentage */}
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-bold tabular-nums text-text">
                  {avgCompliance}%
                </span>
                <span className="font-medium text-text/50">
                  {isCompleted
                    ? "✓ Done"
                    : isCurrent
                      ? "→ Current"
                      : "○ Planned"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
