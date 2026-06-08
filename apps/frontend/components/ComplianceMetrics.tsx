"use client";

import { useState, useEffect } from "react";
import ComplianceRing from "./ComplianceRing";

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
  weekStartDate: string;
  weekEndDate: string;
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

interface Day {
  date: string;
  dayOfWeek: string;
  workout: any | null;
  activity: any | null;
  completed: boolean;
}

interface BlockWeek {
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
  weeks: BlockWeek[];
  currentWeek: number;
  currentDay: string;
}

// Workout Detail Modal Component
function WorkoutDetailModal({
  day,
  athleteId,
  onClose,
}: {
  day: Day;
  athleteId: string;
  onClose: () => void;
}) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(true);

  useEffect(() => {
    if (day.activity?.id) {
      setLoadingAnalysis(true);
      fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/analysis/${athleteId}/activity-analysis/${day.activity.id}`,
      )
        .then((r) => r.json())
        .then((data) => setAnalysis(data.analysis || null))
        .catch(() => setAnalysis(null))
        .finally(() => setLoadingAnalysis(false));
    } else {
      setLoadingAnalysis(false);
    }
  }, [day.activity?.id, athleteId]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const dateLabel = new Date(day.date + "T00:00:00").toLocaleDateString(
    "en-US",
    {
      weekday: "long",
      month: "long",
      day: "numeric",
    },
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl bg-bg-card border border-border rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Modal header */}
        <div className="sticky top-0 bg-bg-card border-b border-border px-6 py-4 flex items-start justify-between gap-4 rounded-t-2xl">
          <div>
            <h2 className="font-bold text-text text-lg">{dateLabel}</h2>
            <p className="text-muted text-xs mt-0.5 capitalize">
              {day.workout?.sport || "Workout"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-text transition-colors p-1 rounded-lg"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Prescribed Workout */}
          {day.workout && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-text uppercase tracking-wider">
                Prescribed Workout
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-bg rounded-lg p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                    Duration
                  </p>
                  <p className="text-lg font-bold text-text mt-1">
                    {day.workout.duration_min || "—"}{" "}
                    {day.workout.duration_min ? "min" : ""}
                  </p>
                </div>
                <div className="bg-bg rounded-lg p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                    Sport
                  </p>
                  <p className="text-lg font-bold text-text mt-1 capitalize">
                    {day.workout.sport || "—"}
                  </p>
                </div>
                {(day.workout.agent_output?.targetTss ||
                  day.workout.target_tss) && (
                  <div className="bg-bg rounded-lg p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                      Target TSS
                    </p>
                    <p className="text-lg font-bold text-text mt-1">
                      {Math.round(
                        day.workout.agent_output?.targetTss ||
                          day.workout.target_tss,
                      )}
                    </p>
                  </div>
                )}
                {day.workout.session_type && (
                  <div className="bg-bg rounded-lg p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                      Session Type
                    </p>
                    <p className="text-lg font-bold text-text mt-1 capitalize">
                      {day.workout.session_type}
                    </p>
                  </div>
                )}
                {day.workout.intensity && (
                  <div className="bg-bg rounded-lg p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                      Intensity
                    </p>
                    <p className="text-lg font-bold text-text mt-1 capitalize">
                      {day.workout.intensity}
                    </p>
                  </div>
                )}
              </div>
              {day.workout.rationale && (
                <div className="bg-bg rounded-lg p-4">
                  <p className="text-xs text-text/70 leading-relaxed">
                    {day.workout.rationale}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Actual Completion */}
          {day.completed && day.activity && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-teal uppercase tracking-wider flex items-center gap-2">
                <span>Actual Completion</span>
                <span className="text-xs font-bold">✓</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {day.activity.duration_secs && (
                  <div className="bg-bg rounded-lg p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                      Duration
                    </p>
                    <p className="text-lg font-bold text-teal mt-1">
                      {Math.round(day.activity.duration_secs / 60)} min
                    </p>
                  </div>
                )}
                {day.activity.tss && (
                  <div className="bg-bg rounded-lg p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                      TSS
                    </p>
                    <p className="text-lg font-bold text-teal mt-1">
                      {Math.round(day.activity.tss)}
                    </p>
                  </div>
                )}
                {day.activity.distance_m && (
                  <div className="bg-bg rounded-lg p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                      Distance
                    </p>
                    <p className="text-lg font-bold text-teal mt-1">
                      {day.activity.distance_m >= 1000
                        ? `${(day.activity.distance_m / 1000).toFixed(1)} km`
                        : `${Math.round(day.activity.distance_m)} m`}
                    </p>
                  </div>
                )}
                {day.activity.avg_hr && (
                  <div className="bg-bg rounded-lg p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                      Avg HR
                    </p>
                    <p className="text-lg font-bold text-text mt-1">
                      {Math.round(day.activity.avg_hr)} bpm
                    </p>
                  </div>
                )}
                {day.activity.avg_power && (
                  <div className="bg-bg rounded-lg p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                      Avg Power
                    </p>
                    <p className="text-lg font-bold text-text mt-1">
                      {Math.round(day.activity.avg_power)} W
                    </p>
                  </div>
                )}
                {day.activity.rpe && (
                  <div className="bg-bg rounded-lg p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                      RPE
                    </p>
                    <p className="text-lg font-bold text-text mt-1">
                      {day.activity.rpe}/10
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Coach Analysis */}
          <div className="border-t border-border pt-5 space-y-3">
            <h3 className="text-sm font-bold text-text uppercase tracking-wider">
              Coach Analysis
            </h3>
            {loadingAnalysis ? (
              <div className="flex items-center gap-2 text-muted text-sm animate-pulse">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-teal animate-bounce [animation-delay:-0.3s]" />
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-teal animate-bounce [animation-delay:-0.15s]" />
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-teal animate-bounce" />
                <span className="ml-1">Analyzing execution...</span>
              </div>
            ) : analysis ? (
              <div className="bg-bg rounded-lg p-4">
                <p className="text-sm text-text leading-relaxed">{analysis}</p>
              </div>
            ) : (
              <p className="text-muted text-sm italic">
                No analysis available for this workout.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ComplianceMetrics({
  athleteId,
}: {
  athleteId: string;
}) {
  const [complianceData, setComplianceData] = useState<any>(null);
  const [fitnessData, setFitnessData] = useState<any>(null);
  const [blockData, setBlockData] = useState<BlockData | null>(null);
  const [currentTsb, setCurrentTsb] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [selectedWorkoutDay, setSelectedWorkoutDay] = useState<Day | null>(
    null,
  );

  useEffect(() => {
    fetchData();
  }, [athleteId]);

  async function fetchData() {
    try {
      const [complianceRes, fitnessRes, activitiesRes, blockRes] =
        await Promise.all([
          fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/analysis/${athleteId}/compliance`,
          ),
          fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/analysis/${athleteId}/fitness-trajectory`,
          ),
          fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/athlete/${athleteId}/activities?days=30`,
          ),
          fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/analysis/${athleteId}/block-overview`,
          ),
        ]);

      const [compliance, fitness, activitiesData, blockResponse] =
        await Promise.all([
          complianceRes.json(),
          fitnessRes.json(),
          activitiesRes.json(),
          blockRes.json(),
        ]);

      setComplianceData(compliance);
      setFitnessData(fitness);
      setBlockData(blockResponse.block);
      setSelectedWeek(blockResponse.block.currentWeek);

      // Calculate current TSB from latest activity
      const latestActivity = activitiesData.activities?.[0];
      if (latestActivity?.ctl != null && latestActivity?.atl != null) {
        setCurrentTsb(Math.round(latestActivity.ctl - latestActivity.atl));
      }

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
    !blockData ||
    !fitnessData.checkpoints ||
    !complianceData.weeklyReports
  ) {
    return (
      <div className="text-center p-8 bg-bg-card border border-border rounded-2xl">
        <p className="text-muted">No compliance data available</p>
      </div>
    );
  }

  // Calculate transparent scoring components
  const volumeAdherence =
    complianceData.overallCompliance.tssComplianceRate || 0;
  const workoutConsistency =
    complianceData.overallCompliance.complianceRate || 0;
  const fitnessGain =
    fitnessData.checkpoints.length > 0
      ? Math.round(
          ((fitnessData.checkpoints[fitnessData.checkpoints.length - 1]
            .actualCtl -
            fitnessData.baselineCtl) /
            fitnessData.baselineCtl) *
            100,
        )
      : 0;

  // Get current week data
  const currentWeekData = blockData.weeks.find(
    (w) => w.weekNumber === selectedWeek,
  );
  const complianceWeekData = complianceData.weeklyReports.find(
    (w: WeeklyReport) => w.weekNumber === selectedWeek,
  );

  return (
    <>
      {/* Workout Detail Modal */}
      {selectedWorkoutDay && (
        <WorkoutDetailModal
          day={selectedWorkoutDay}
          athleteId={athleteId}
          onClose={() => setSelectedWorkoutDay(null)}
        />
      )}

      <div className="space-y-6">
        {/* Unified Training Block & Schedule Card */}
        <div className="bg-bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          {/* Header: Block Title + Overall Stats */}
          <div className="p-4 sm:p-6 border-b border-border bg-gradient-to-r from-teal/5 to-transparent">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              {/* Left: Block Title & Dates */}
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-teal mb-2">
                  Training Block
                </h2>
                <p className="text-sm text-text/60 font-medium">
                  {blockData.startDate} → {blockData.endDate}
                </p>
              </div>

              {/* Right: Overall Block Stats */}
              <div className="flex gap-4 sm:gap-6">
                <div className="text-center">
                  <p className="text-2xl sm:text-3xl font-bold tabular-nums text-teal">
                    {complianceData.overallCompliance.complianceRate}%
                  </p>
                  <p className="text-[10px] font-bold tracking-wider uppercase text-text/60 mt-1">
                    Total Compliance
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-2xl sm:text-3xl font-bold tabular-nums text-orange-bright">
                    {complianceData.overallCompliance.workoutsCompleted}
                    <span className="text-lg text-text/40">
                      /{complianceData.overallCompliance.workoutsPrescribed}
                    </span>
                  </p>
                  <p className="text-[10px] font-bold tracking-wider uppercase text-text/60 mt-1">
                    Workouts Done
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation: Interactive Week Progress Bar */}
          <div className="p-4 sm:p-6 border-b border-border bg-bg-assistant">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
              {complianceData.weeklyReports.map((week: WeeklyReport) => {
                const isCurrent = week.weekNumber === blockData.currentWeek;
                const isSelected = week.weekNumber === selectedWeek;
                const avgCompliance = Math.round(
                  (week.tssComplianceRate + week.complianceRate) / 2,
                );
                const isCompleted = week.weekNumber < blockData.currentWeek;
                const isPlanned = week.weekNumber > blockData.currentWeek;

                return (
                  <button
                    key={week.weekNumber}
                    onClick={() => setSelectedWeek(week.weekNumber)}
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

          {/* Split Content Body: Daily Schedule (Left) + Weekly Metrics (Right) */}
          {currentWeekData && complianceWeekData && (
            <div className="p-4 sm:p-6">
              {/* Right Column: Weekly Metrics (1/3 width on desktop) */}
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
                      {complianceWeekData.targetTss}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-bg-assistant border border-border">
                    <p className="text-[10px] font-bold tracking-wider uppercase text-text/60 mb-1">
                      Compliance Target
                    </p>
                    <p className="text-3xl font-bold tabular-nums text-orange-bright">
                      {complianceWeekData.complianceRate}%
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

                {/* Compliance Rings */}
                <div className="grid grid-cols-2 gap-4 ">
                  {/* Volume Compliance */}
                  <div className="flex flex-col items-center p-4 rounded-lg bg-bg-assistant border border-border">
                    <ComplianceRing
                      actual={complianceWeekData.actualTss}
                      target={complianceWeekData.targetTss}
                      size={100}
                      strokeWidth={10}
                    />
                    <div className="mt-3 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-text/70 mb-1">
                        Volume Compliance
                      </p>
                      <p className="text-xs font-semibold text-text tabular-nums">
                        {Math.round(complianceWeekData.actualTss)} /{" "}
                        {complianceWeekData.targetTss} TSS
                      </p>
                    </div>
                  </div>

                  {/* Workout Consistency */}
                  <div className="flex flex-col items-center p-4 rounded-lg bg-bg-assistant border border-border">
                    <ComplianceRing
                      actual={complianceWeekData.workoutsCompleted}
                      target={Math.max(
                        complianceWeekData.workoutsPrescribed,
                        1,
                      )}
                      size={100}
                      strokeWidth={10}
                    />
                    <div className="mt-3 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-text/70 mb-1">
                        Workout Consistency
                      </p>
                      <p className="text-xs font-semibold text-text tabular-nums">
                        {complianceWeekData.workoutsCompleted} /{" "}
                        {complianceWeekData.workoutsPrescribed} Sessions
                      </p>
                    </div>
                  </div>
                </div>

                {/* Week Notes (if any) */}
                {complianceWeekData.notes && (
                  <div className="mt-4 mb-4 p-3 rounded-lg bg-bg-card border border-border">
                    <p className="text-xs text-text/60 leading-relaxed italic">
                      "{complianceWeekData.notes}"
                    </p>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 p-t-6">
                {/* Left Column: Daily Schedule (2/3 width on desktop) */}
                <div className="lg:col-span-2">
                  <h3 className="text-base font-bold text-text mb-4 flex items-center gap-2">
                    <span>Daily Schedule</span>
                    <span className="text-xs font-medium text-text/50 uppercase">
                      (Week {selectedWeek})
                    </span>
                  </h3>

                  <div className="space-y-2">
                    {currentWeekData.days
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
                                setSelectedWorkoutDay(day);
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
                                    {new Date(day.date).toLocaleDateString(
                                      "en-US",
                                      { month: "short", day: "numeric" },
                                    )}
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
                                    <span className="text-xs text-text/50">
                                      •
                                    </span>
                                    <span className="text-sm font-medium text-text capitalize">
                                      {day.workout.sport || "Workout"}
                                    </span>
                                    {sessionType && (
                                      <>
                                        <span className="text-xs text-text/50">
                                          •
                                        </span>
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
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
