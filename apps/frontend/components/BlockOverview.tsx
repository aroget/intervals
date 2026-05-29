"use client";

import { useState, useEffect } from "react";
import { WorkoutBadge } from "./WorkoutChart";

interface Day {
  date: string;
  dayOfWeek: string;
  workout: any | null;
  activity: any | null;
  completed: boolean;
}

interface Week {
  weekNumber: number;
  weekType: string;
  startDate: string;
  endDate: string;
  targetTss: number;
  actualTss: number;
  days: Day[];
}

interface BlockData {
  startDate: string;
  endDate: string;
  weeks: Week[];
  currentWeek: number;
  currentDay: string;
}

export default function BlockOverview({
  athleteId,
  onActivityClick,
}: {
  athleteId: string;
  onActivityClick?: (activity: any) => void;
}) {
  const [blockData, setBlockData] = useState<BlockData | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBlockData();
  }, [athleteId]);

  async function fetchBlockData() {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/analysis/${athleteId}/block-overview`,
      );
      const data = await res.json();
      setBlockData(data.block);
      setSelectedWeek(data.block.currentWeek);
      setLoading(false);
    } catch (err) {
      console.error("Failed to load block data:", err);
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-teal border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!blockData) {
    return (
      <div className="text-center p-8 bg-bg-card border border-peach rounded-2xl">
        <p className="text-muted">
          No training block configured. Set your cycle start date in settings.
        </p>
      </div>
    );
  }

  const currentWeekData = blockData.weeks[selectedWeek - 1];

  return (
    <div className="space-y-6">
      {/* Block Header */}
      <div className="bg-bg-card rounded-2xl shadow-sm border border-border p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[18px] font-semibold text-teal">
            Training Block
          </h2>
          <span className="text-xs font-semibold tracking-[0.12em] uppercase text-muted">
            4-Week Cycle
          </span>
        </div>
        <p className="text-xs text-muted mb-4">
          {blockData.startDate} to {blockData.endDate}
        </p>

        {/* Week Tabs */}
        <div className="flex gap-1.5 sm:gap-2 mb-6">
          {blockData.weeks.map((week) => (
            <button
              key={week.weekNumber}
              onClick={() => setSelectedWeek(week.weekNumber)}
              className={`px-2 sm:px-4 py-2 rounded-lg font-medium text-sm sm:text-base transition-colors ${
                selectedWeek === week.weekNumber
                  ? "bg-teal text-white"
                  : "bg-bg-card text-text border border-border hover:bg-bg-assistant"
              } ${
                blockData.currentWeek === week.weekNumber
                  ? "ring-2 ring-teal ring-opacity-30"
                  : ""
              }`}
            >
              <span className="hidden sm:inline">Week </span>
              {week.weekNumber}
              <span className="block text-[10px] sm:text-xs capitalize opacity-90">
                {week.weekType}
              </span>
            </button>
          ))}
        </div>

        {/* Week Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-bg-assistant p-4 rounded-lg border border-border">
            <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted">
              Target TSS
            </p>
            <p className="text-2xl sm:text-3xl font-bold tabular-nums text-text">
              {currentWeekData.targetTss}
            </p>
          </div>
          <div className="bg-bg-assistant p-4 rounded-lg border border-border">
            <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted">
              Completed TSS
            </p>
            <p className="text-2xl sm:text-3xl font-bold tabular-nums text-orange-bright">
              {Math.round(currentWeekData.actualTss)}
            </p>
          </div>
          <div className="bg-bg-assistant p-4 rounded-lg border border-border">
            <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted">
              Progress
            </p>
            <p className="text-2xl sm:text-3xl font-bold tabular-nums text-teal">
              {Math.round(
                (currentWeekData.actualTss / currentWeekData.targetTss) * 100,
              )}
              %
            </p>
          </div>
        </div>

        {/* Session Type Breakdown */}
        {(() => {
          const keyPrescribed = currentWeekData.days.filter(
            (d) =>
              d.workout?.session_type === "key" ||
              d.workout?.agent_output?.sessionType === "key",
          ).length;
          const keyCompleted = currentWeekData.days.filter(
            (d) =>
              (d.workout?.session_type === "key" ||
                d.workout?.agent_output?.sessionType === "key") &&
              d.completed,
          ).length;
          const endurancePrescribed = currentWeekData.days.filter(
            (d) =>
              d.workout?.session_type === "endurance" ||
              d.workout?.agent_output?.sessionType === "endurance",
          ).length;
          const enduranceCompleted = currentWeekData.days.filter(
            (d) =>
              (d.workout?.session_type === "endurance" ||
                d.workout?.agent_output?.sessionType === "endurance") &&
              d.completed,
          ).length;
          const recoveryPrescribed = currentWeekData.days.filter(
            (d) =>
              d.workout?.session_type === "recovery" ||
              d.workout?.agent_output?.sessionType === "recovery",
          ).length;
          const recoveryCompleted = currentWeekData.days.filter(
            (d) =>
              (d.workout?.session_type === "recovery" ||
                d.workout?.agent_output?.sessionType === "recovery") &&
              d.completed,
          ).length;

          const hasSessionData =
            keyPrescribed > 0 ||
            endurancePrescribed > 0 ||
            recoveryPrescribed > 0;

          if (!hasSessionData) return null;

          return (
            <div className="mt-6 space-y-3">
              <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted">
                Session Type Breakdown
              </p>
              <div className="space-y-2">
                {keyPrescribed > 0 && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-text w-20">
                      Key
                    </span>
                    <div className="flex-1 h-3 bg-bg-user rounded-full overflow-hidden border border-border">
                      <div
                        className="h-full bg-orange-bright transition-all"
                        style={{
                          width: `${(keyCompleted / keyPrescribed) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs font-semibold tabular-nums text-text min-w-[60px] text-right">
                      {keyCompleted}/{keyPrescribed} (
                      {Math.round((keyCompleted / keyPrescribed) * 100)}%)
                    </span>
                  </div>
                )}
                {endurancePrescribed > 0 && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-text w-20">
                      Endurance
                    </span>
                    <div className="flex-1 h-3 bg-bg-user rounded-full overflow-hidden border border-border">
                      <div
                        className="h-full bg-teal transition-all"
                        style={{
                          width: `${(enduranceCompleted / endurancePrescribed) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs font-semibold tabular-nums text-text min-w-[60px] text-right">
                      {enduranceCompleted}/{endurancePrescribed} (
                      {Math.round(
                        (enduranceCompleted / endurancePrescribed) * 100,
                      )}
                      %)
                    </span>
                  </div>
                )}
                {recoveryPrescribed > 0 && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-text w-20">
                      Recovery
                    </span>
                    <div className="flex-1 h-3 bg-bg-user rounded-full overflow-hidden border border-border">
                      <div
                        className="h-full bg-peach transition-all"
                        style={{
                          width: `${(recoveryCompleted / recoveryPrescribed) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs font-semibold tabular-nums text-text min-w-[60px] text-right">
                      {recoveryCompleted}/{recoveryPrescribed} (
                      {Math.round(
                        (recoveryCompleted / recoveryPrescribed) * 100,
                      )}
                      %)
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Week Days List - Only show past + today */}
      <div className="space-y-2">
        {currentWeekData.days
          .filter((day) => day.date <= blockData.currentDay)
          .map((day) => (
            <DayCard
              key={day.date}
              day={day}
              isToday={day.date === blockData.currentDay}
              onActivityClick={onActivityClick}
            />
          ))}
      </div>
    </div>
  );
}

function DayCard({
  day,
  isToday,
  onActivityClick,
}: {
  day: Day;
  isToday: boolean;
  onActivityClick?: (activity: any) => void;
}) {
  const hasDeviation = day.workout?.agent_output?.deviationFlag;
  const hasSuggestion = day.workout?.agent_output?.adaptationSuggestion;
  const hasActivity = day.activity && day.completed;

  const getSportColor = (sport: string) => {
    const sportLower = sport?.toLowerCase() || "";
    if (sportLower.includes("run")) return "text-orange-bright";
    if (sportLower.includes("bike") || sportLower.includes("ride"))
      return "text-teal";
    if (sportLower.includes("swim")) return "text-blue-500";
    return "text-text";
  };

  const handleClick = () => {
    if (hasActivity && onActivityClick) {
      onActivityClick(day.activity);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`bg-bg-card rounded-xl shadow-sm border p-3 ${
        isToday ? "ring-2 ring-teal border-teal" : "border-border"
      } ${
        hasDeviation?.severity === "major"
          ? "border-l-4 border-l-orange-bright"
          : hasDeviation?.severity === "moderate"
            ? "border-l-4 border-l-peach"
            : ""
      } ${hasActivity ? "cursor-pointer hover:border-teal transition-colors" : ""}`}
    >
      <div className="flex items-center justify-between">
        {/* Left: Day info */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="text-center min-w-[40px] sm:min-w-[50px]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
              {day.dayOfWeek}
            </p>
            <p className="text-lg sm:text-xl font-bold tabular-nums text-text">
              {new Date(day.date).getDate()}
            </p>
          </div>

          {day.workout ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <div>
                <p
                  className={`text-sm sm:text-base font-bold ${getSportColor(day.workout.sport)}`}
                >
                  {day.workout.duration_min}min
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  {day.workout.sport}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <WorkoutBadge
                  intensity={day.workout.intensity}
                  className="text-[10px]"
                />
                {(() => {
                  const sessionType =
                    day.workout.session_type ??
                    day.workout.agent_output?.sessionType;
                  if (!sessionType) return null;
                  const typeConfig = {
                    key: {
                      label: "Key",
                      color:
                        "text-orange-bright border-orange-bright/30 bg-orange-bright/10",
                    },
                    endurance: {
                      label: "Endurance",
                      color: "text-teal border-teal/30 bg-teal/10",
                    },
                    recovery: {
                      label: "Recovery",
                      color: "text-peach border-peach/40 bg-peach/10",
                    },
                    rest: {
                      label: "Rest",
                      color: "text-muted border-border bg-bg-assistant",
                    },
                  }[sessionType as "key" | "endurance" | "recovery" | "rest"];
                  if (!typeConfig) return null;
                  return (
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${typeConfig.color}`}
                    >
                      {typeConfig.label}
                    </span>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted italic">Rest day</div>
          )}
        </div>

        {/* Right: Status indicators */}
        <div className="flex items-center gap-2 sm:gap-3">
          {day.activity && (
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Completed
              </p>
              <p className="text-sm font-bold tabular-nums text-teal">
                {Math.round(day.activity.tss ?? 0)} TSS
              </p>
            </div>
          )}
          {day.completed && <span className="text-teal text-xl">✓</span>}
          {hasDeviation?.severity === "major" && (
            <span className="text-orange-bright text-xl">⚠️</span>
          )}
        </div>
      </div>

      {/* Adaptation suggestion */}
      {hasSuggestion && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-orange-bright">ADAPT:</span>
            <span className="text-sm text-text">
              {hasSuggestion.suggestedDurationMin}m{" "}
              {hasSuggestion.suggestedIntensity}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
