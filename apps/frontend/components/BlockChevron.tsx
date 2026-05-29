"use client";

interface WeekSegment {
  weekNumber: number;
  weekType: string;
  targetTss: number;
  actualTss: number;
  workoutsCompleted: number;
  workoutsPrescribed: number;
  tssComplianceRate: number;
  complianceRate: number;
  startDate: string;
  endDate: string;
}

interface BlockChevronProps {
  weeks: WeekSegment[];
  currentWeek: number;
  selectedWeek: number;
  onWeekSelect: (weekNumber: number) => void;
  blockStart: string;
  blockEnd: string;
}

export default function BlockChevron({
  weeks,
  currentWeek,
  selectedWeek,
  onWeekSelect,
  blockStart,
  blockEnd,
}: BlockChevronProps) {
  const getComplianceColor = (tssRate: number, workoutRate: number) => {
    // Average of both compliance metrics
    const avgCompliance = (tssRate + workoutRate) / 2;

    if (avgCompliance >= 90) return "bg-teal border-teal";
    if (avgCompliance >= 70) return "bg-orange border-orange";
    return "bg-peach border-peach";
  };

  const getWeekTypeColor = (weekType: string) => {
    if (weekType === "recovery")
      return "bg-peach/20 text-peach border-peach/40";
    if (weekType === "peak")
      return "bg-orange-bright/20 text-orange-bright border-orange-bright/40";
    if (weekType === "build")
      return "bg-orange/20 text-orange border-orange/40";
    return "bg-teal/20 text-teal border-teal/40"; // base
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="bg-bg-card rounded-2xl shadow-sm border border-border p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-teal">Training Block</h2>
          <p className="text-xs text-text/60 mt-1 font-medium">
            {formatDate(blockStart)} → {formatDate(blockEnd)}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-teal" />
            <span className="text-text/70 font-medium">On Track</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-orange" />
            <span className="text-text/70 font-medium">Moderate</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-peach" />
            <span className="text-text/70 font-medium">Low</span>
          </div>
        </div>
      </div>

      {/* Horizontal Week Segments */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {weeks.map((week) => {
          const isSelected = selectedWeek === week.weekNumber;
          const isCurrent = currentWeek === week.weekNumber;
          const complianceColor = getComplianceColor(
            week.tssComplianceRate,
            week.complianceRate,
          );

          return (
            <button
              key={week.weekNumber}
              onClick={() => onWeekSelect(week.weekNumber)}
              className={`relative group transition-all duration-200 ${
                isSelected ? "scale-105" : "hover:scale-102"
              }`}
            >
              {/* Card */}
              <div
                className={`relative rounded-xl p-4 border-2 transition-all ${
                  isSelected
                    ? "bg-teal/10 border-teal shadow-lg"
                    : "bg-bg-assistant border-border hover:border-teal/50 hover:shadow-md"
                }`}
              >
                {/* Current week indicator */}
                {isCurrent && (
                  <div className="absolute -top-2 -right-2 w-5 h-5 bg-teal rounded-full border-2 border-bg-card flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  </div>
                )}

                {/* Week Header */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-text">
                    Week {week.weekNumber}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase border ${getWeekTypeColor(week.weekType)}`}
                  >
                    {week.weekType}
                  </span>
                </div>

                {/* Mini Compliance Indicator */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex-1">
                    <div
                      className={`h-2 rounded-full ${complianceColor} opacity-30`}
                    />
                    <div
                      className={`h-2 rounded-full ${complianceColor} -mt-2 transition-all`}
                      style={{
                        width: `${Math.min(
                          (week.tssComplianceRate + week.complianceRate) / 2,
                          100,
                        )}%`,
                      }}
                    />
                  </div>
                  <span
                    className={`ml-2 text-xs font-bold ${complianceColor.replace("bg-", "text-")}`}
                  >
                    {Math.round(
                      (week.tssComplianceRate + week.complianceRate) / 2,
                    )}
                    %
                  </span>
                </div>

                {/* Metrics */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text/60 font-medium">TSS</span>
                    <span className="font-bold text-text tabular-nums">
                      {Math.round(week.actualTss)}/{week.targetTss}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text/60 font-medium">Sessions</span>
                    <span className="font-bold text-text tabular-nums">
                      {week.workoutsCompleted}/{week.workoutsPrescribed}
                    </span>
                  </div>
                </div>

                {/* Dates */}
                <div className="mt-3 pt-2 border-t border-border/50 text-[10px] text-text/50 text-center font-medium">
                  {formatDate(week.startDate)} - {formatDate(week.endDate)}
                </div>
              </div>

              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                  <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-teal" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Mobile legend */}
      <div className="flex sm:hidden items-center justify-center gap-3 mt-4 pt-4 border-t border-border text-[10px]">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-teal" />
          <span className="text-text/70 font-medium">On Track</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-orange" />
          <span className="text-text/70 font-medium">Moderate</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-peach" />
          <span className="text-text/70 font-medium">Low</span>
        </div>
      </div>
    </div>
  );
}
