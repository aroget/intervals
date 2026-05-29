"use client";

import { useState, useEffect } from "react";
import TSSGauge from "../../components/TSSGauge";
import IntensityDistribution from "../../components/IntensityDistribution";
import CombinedTrainingChart from "../../components/CombinedTrainingChart";
import FormStatusBadge from "../../components/FormStatusBadge";
import { WorkoutBadge } from "../../components/WorkoutChart";

const ATHLETE_ID = process.env.NEXT_PUBLIC_ATHLETE_ID ?? "";

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

export default function DashboardPage() {
  const [blockData, setBlockData] = useState<BlockData | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [currentTsb, setCurrentTsb] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ATHLETE_ID) return;
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [blockRes, activitiesRes] = await Promise.all([
        fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/analysis/${ATHLETE_ID}/block-overview`,
        ),
        fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/athlete/${ATHLETE_ID}/activities?days=30`,
        ),
      ]);

      const [blockData, activitiesData] = await Promise.all([
        blockRes.json(),
        activitiesRes.json(),
      ]);

      setBlockData(blockData.block);
      setSelectedWeek(blockData.block.currentWeek);

      // Calculate current TSB
      const latestActivity = activitiesData.activities?.[0];
      if (latestActivity?.ctl != null && latestActivity?.atl != null) {
        setCurrentTsb(Math.round(latestActivity.ctl - latestActivity.atl));
      }

      setLoading(false);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
      setLoading(false);
    }
  }

  if (!ATHLETE_ID) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">
            ATHLETE_ID not configured. Set NEXT_PUBLIC_ATHLETE_ID in .env.local
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin h-12 w-12 border-4 border-teal border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!blockData) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="text-center p-8 bg-bg-card border border-peach rounded-2xl">
          <p className="text-muted">
            No training block configured. Set your cycle start date in settings.
          </p>
        </div>
      </div>
    );
  }

  const currentWeekData = blockData.weeks[selectedWeek - 1];

  // Calculate intensity distribution for selected week
  const calculateIntensityDist = () => {
    const keyCount = currentWeekData.days.filter(
      (d) =>
        d.workout?.session_type === "key" ||
        d.workout?.agent_output?.sessionType === "key",
    ).length;
    const enduranceCount = currentWeekData.days.filter(
      (d) =>
        d.workout?.session_type === "endurance" ||
        d.workout?.agent_output?.sessionType === "endurance",
    ).length;
    const recoveryCount = currentWeekData.days.filter(
      (d) =>
        d.workout?.session_type === "recovery" ||
        d.workout?.agent_output?.sessionType === "recovery",
    ).length;

    const total = keyCount + enduranceCount + recoveryCount || 1;

    const keyPrescribed = keyCount;
    const endurancePrescribed = enduranceCount;
    const recoveryPrescribed = recoveryCount;

    const keyCompleted = currentWeekData.days.filter(
      (d) =>
        (d.workout?.session_type === "key" ||
          d.workout?.agent_output?.sessionType === "key") &&
        d.completed,
    ).length;
    const enduranceCompleted = currentWeekData.days.filter(
      (d) =>
        (d.workout?.session_type === "endurance" ||
          d.workout?.agent_output?.sessionType === "endurance") &&
        d.completed,
    ).length;
    const recoveryCompleted = currentWeekData.days.filter(
      (d) =>
        (d.workout?.session_type === "recovery" ||
          d.workout?.agent_output?.sessionType === "recovery") &&
        d.completed,
    ).length;

    const totalCompleted =
      keyCompleted + enduranceCompleted + recoveryCompleted || 1;

    return {
      target: [
        {
          zone: "High",
          targetPercentage: (keyPrescribed / total) * 100,
          actualPercentage: 0,
          color: "orange-bright",
        },
        {
          zone: "Moderate",
          targetPercentage: (endurancePrescribed / total) * 100,
          actualPercentage: 0,
          color: "teal",
        },
        {
          zone: "Low",
          targetPercentage: (recoveryPrescribed / total) * 100,
          actualPercentage: 0,
          color: "peach",
        },
      ],
      actual: [
        {
          zone: "High",
          targetPercentage: 0,
          actualPercentage: (keyCompleted / totalCompleted) * 100,
          color: "orange-bright",
        },
        {
          zone: "Moderate",
          targetPercentage: 0,
          actualPercentage: (enduranceCompleted / totalCompleted) * 100,
          color: "teal",
        },
        {
          zone: "Low",
          targetPercentage: 0,
          actualPercentage: (recoveryCompleted / totalCompleted) * 100,
          color: "peach",
        },
      ],
    };
  };

  const intensityDist = calculateIntensityDist();

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Global Week Navigation */}
      <div className="bg-bg-card rounded-2xl shadow-sm border border-border p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-text">
              Training Analytics
            </h1>
            <p className="text-xs text-muted mt-1">
              {blockData.startDate} → {blockData.endDate}
            </p>
          </div>

          {/* Form Status Badge */}
          {currentTsb !== null && (
            <div className="hidden sm:block">
              <FormStatusBadge
                tsb={currentTsb}
                weekType={currentWeekData.weekType}
              />
            </div>
          )}
        </div>

        {/* Week Tabs */}
        <div className="flex gap-2">
          {blockData.weeks.map((week) => (
            <button
              key={week.weekNumber}
              onClick={() => setSelectedWeek(week.weekNumber)}
              className={`flex-1 px-3 py-3 rounded-xl font-semibold text-sm transition-all ${
                selectedWeek === week.weekNumber
                  ? "bg-teal text-white shadow-md"
                  : "bg-bg-assistant text-text border border-border hover:border-teal"
              } ${
                blockData.currentWeek === week.weekNumber
                  ? "ring-2 ring-teal ring-offset-2 ring-offset-bg"
                  : ""
              }`}
            >
              <div className="text-center">
                <div className="font-bold">Week {week.weekNumber}</div>
                <div className="text-[10px] uppercase tracking-wider opacity-90 mt-0.5">
                  {week.weekType}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Week Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* TSS Compliance Gauge */}
        <div className="bg-bg-card rounded-2xl shadow-sm border border-border p-6">
          <h3 className="text-lg font-semibold text-teal mb-4">
            Weekly Volume Target
          </h3>
          <TSSGauge
            actual={currentWeekData.actualTss}
            target={currentWeekData.targetTss}
            size={240}
          />
        </div>

        {/* Intensity Distribution */}
        <div className="bg-bg-card rounded-2xl shadow-sm border border-border p-6">
          <IntensityDistribution
            title="Session Distribution"
            targetDistribution={intensityDist.target}
            actualDistribution={intensityDist.actual}
          />
        </div>
      </div>

      {/* Daily Schedule */}
      <div className="bg-bg-card rounded-2xl shadow-sm border border-border p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-teal mb-4">
          Week {selectedWeek} Schedule
        </h3>
        <div className="space-y-2">
          {currentWeekData.days.map((day) => (
            <DayCard
              key={day.date}
              day={day}
              isToday={day.date === blockData.currentDay}
            />
          ))}
        </div>
      </div>

      {/* Combined Training Analytics Chart */}
      <div className="bg-bg-card rounded-2xl shadow-sm border border-border p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-teal mb-4">
          Training Load & Fitness Progression
        </h3>
        <CombinedTrainingChart athleteId={ATHLETE_ID} />
      </div>
    </div>
  );
}

function DayCard({ day, isToday }: { day: Day; isToday: boolean }) {
  const hasDeviation = day.workout?.agent_output?.deviationFlag;
  const hasSuggestion = day.workout?.agent_output?.adaptationSuggestion;
  const hasActivity = day.activity && day.completed;

  const plannedTss = day.workout?.tss || 0;
  const actualTss = day.activity?.tss || 0;
  const tssProgress = plannedTss > 0 ? (actualTss / plannedTss) * 100 : 0;

  const getSportColor = (sport: string) => {
    const sportLower = sport?.toLowerCase() || "";
    if (sportLower.includes("run")) return "text-orange-bright";
    if (sportLower.includes("bike") || sportLower.includes("ride"))
      return "text-teal";
    if (sportLower.includes("swim")) return "text-blue-500";
    return "text-text";
  };

  const getSessionTypeConfig = (sessionType: string) => {
    const configs = {
      key: {
        label: "High Intensity",
        color: "text-orange-bright border-orange-bright/30 bg-orange-bright/10",
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
    };
    return configs[sessionType as keyof typeof configs] || null;
  };

  return (
    <div
      className={`bg-bg-assistant rounded-xl border p-4 transition-all ${
        isToday
          ? "ring-2 ring-teal border-teal shadow-md"
          : "border-border hover:border-teal/50"
      } ${
        hasDeviation?.severity === "major"
          ? "border-l-4 border-l-orange-bright"
          : ""
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: Date & Workout Info */}
        <div className="flex items-start gap-4 flex-1">
          {/* Date Box */}
          <div className="text-center min-w-[60px]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
              {day.dayOfWeek}
            </p>
            <p className="text-2xl font-bold tabular-nums text-text mt-1">
              {new Date(day.date).getDate()}
            </p>
            {isToday && (
              <span className="text-[9px] font-bold uppercase tracking-wider text-teal mt-1 block">
                Today
              </span>
            )}
          </div>

          {/* Workout Details */}
          <div className="flex-1">
            {day.workout ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`text-lg font-bold ${getSportColor(day.workout.sport)}`}
                  >
                    {Math.round(plannedTss)} TSS
                  </span>
                  <span className="text-xs text-muted">·</span>
                  <span className="text-sm text-muted">
                    {day.workout.duration_min}min {day.workout.sport}
                  </span>

                  {(() => {
                    const sessionType =
                      day.workout.session_type ??
                      day.workout.agent_output?.sessionType;
                    const typeConfig = sessionType
                      ? getSessionTypeConfig(sessionType)
                      : null;
                    return typeConfig ? (
                      <span
                        className={`text-[9px] font-bold px-2 py-1 rounded-md border ${typeConfig.color}`}
                      >
                        {typeConfig.label}
                      </span>
                    ) : null;
                  })()}
                </div>

                {/* TSS Progress Bar (Planned vs Actual) */}
                {hasActivity && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted">Completed</span>
                      <span className="font-semibold text-text">
                        {Math.round(actualTss)} / {Math.round(plannedTss)} TSS
                      </span>
                    </div>
                    <div className="relative h-2 bg-bg-user rounded-full overflow-hidden border border-border">
                      {/* Planned baseline */}
                      <div className="absolute inset-0 bg-muted/20" />
                      {/* Actual progress */}
                      <div
                        className={`absolute inset-y-0 left-0 transition-all ${
                          tssProgress >= 90 && tssProgress <= 104
                            ? "bg-teal"
                            : tssProgress < 90
                              ? "bg-peach"
                              : "bg-orange-bright"
                        }`}
                        style={{ width: `${Math.min(tssProgress, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 text-muted">
                <span className="text-2xl">🛌</span>
                <span className="text-sm italic">Rest Day</span>
              </div>
            )}

            {/* Adaptation Suggestion */}
            {hasSuggestion && (
              <div className="mt-2 p-2 bg-orange-bright/10 border border-orange-bright/30 rounded-lg">
                <span className="text-xs font-bold text-orange-bright">
                  ADAPT: {hasSuggestion.suggestedDurationMin}m{" "}
                  {hasSuggestion.suggestedIntensity}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Status & CTA */}
        <div className="flex flex-col items-end gap-2">
          {day.completed && <span className="text-teal text-2xl">✓</span>}
          {hasDeviation?.severity === "major" && (
            <span className="text-orange-bright text-xl">⚠️</span>
          )}
          {isToday && day.workout && (
            <button className="px-4 py-2 bg-teal text-white text-sm font-semibold rounded-lg hover:bg-teal/90 transition-colors">
              View Workout
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
