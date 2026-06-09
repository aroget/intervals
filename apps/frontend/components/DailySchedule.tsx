"use client";

interface Day {
  date: string;
  dayOfWeek: string;
  workout: any | null;
  activity: any | null;
  completed: boolean;
}

interface BlockData {
  currentDay: string;
}

interface DailyScheduleProps {
  days: Day[];
  selectedWeek: number;
  blockData: BlockData;
  onSelectDay: (day: Day) => void;
}

export default function DailySchedule({
  days,
  selectedWeek,
  blockData,
  onSelectDay,
}: DailyScheduleProps) {
  return (
    <div className="lg:col-span-2">
      <h3 className="text-base font-bold text-text mb-4 flex items-center gap-2">
        <span>Daily Schedule</span>
        <span className="text-xs font-medium text-text/50 uppercase">
          (Week {selectedWeek})
        </span>
      </h3>

      <div className="space-y-2">
        {days
          .filter((day) => day.date <= blockData.currentDay)
          .map((day) => {
            const isToday = day.date === blockData.currentDay;
            const sessionType =
              day.workout?.session_type ||
              day.workout?.agent_output?.sessionType ||
              "";

            return (
              <button
                key={day.date}
                onClick={() => {
                  if (day.completed && day.activity) {
                    onSelectDay(day);
                  }
                }}
                disabled={!day.completed || !day.activity}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  isToday
                    ? "border-teal bg-teal/5 ring-2 ring-teal/20"
                    : day.completed
                      ? "border-border bg-bg-assistant hover:border-teal cursor-pointer"
                      : "border-dashed border-border/50 bg-bg-card"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Date & Activity Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-text/70 uppercase">
                        {day.dayOfWeek}
                      </span>
                      <span className="text-xs font-medium text-text/50">
                        {new Date(day.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      {isToday && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-teal/20 text-teal">
                          Today
                        </span>
                      )}
                    </div>

                    {day.workout && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-text">
                          {day.workout.duration_min || 0} min
                        </span>
                        <span className="text-xs text-text/50">•</span>
                        <span className="text-sm font-medium text-text capitalize">
                          {day.workout.sport || "Workout"}
                        </span>
                        {sessionType && (
                          <>
                            <span className="text-xs text-text/50">•</span>
                            <span
                              className={`text-xs font-semibold capitalize ${
                                sessionType === "key"
                                  ? "text-orange-bright"
                                  : sessionType === "endurance"
                                    ? "text-teal"
                                    : "text-peach"
                              }`}
                            >
                              {sessionType}
                            </span>
                          </>
                        )}
                      </div>
                    )}

                    {!day.workout && (
                      <span className="text-sm text-text/40 italic">
                        Rest day
                      </span>
                    )}
                  </div>

                  {/* Completion Status */}
                  <div className="flex items-center gap-2">
                    {day.completed ? (
                      <div className="flex flex-col items-end">
                        <span className="text-xs font-bold text-teal">
                          ✓ Done
                        </span>
                        {day.activity?.tss && (
                          <span className="text-[10px] text-text/50 tabular-nums">
                            {Math.round(day.activity.tss)} TSS
                          </span>
                        )}
                      </div>
                    ) : (
                      day.workout && (
                        <span className="text-xs font-medium text-text/40">
                          Pending
                        </span>
                      )
                    )}
                  </div>
                </div>
              </button>
            );
          })}
      </div>
    </div>
  );
}
