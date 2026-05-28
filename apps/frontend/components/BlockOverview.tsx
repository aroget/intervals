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
      </div>

      {/* Week Days List */}
      <div className="space-y-2">
        {currentWeekData.days.map((day) => (
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
              <WorkoutBadge
                intensity={day.workout.intensity}
                className="text-[10px]"
              />
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
