"use client";

import { useState } from "react";
import { API_URL, ATHLETE_ID, fetcher } from "@/lib/api";
import useSWR from "swr";
import { useTranslations } from "next-intl";
import { WorkoutChart, WorkoutBadge } from "@/components/WorkoutChart";



interface UpcomingWorkout {
  workout_date: string;
  sport: string;
  duration_min: number;
  intensity: string;
  agent_output: {
    periodizationPhase?: string;
    workoutStructure?: string;
    rationale?: string;
    adjustmentsFromPlan?: string;
    energySystem?: string;
    phases?: { label: string; durationMin: number; intensityPct: number }[];
  };
}

const SPORT_ICONS: Record<string, string> = {
  run: "🏃",
  bike: "🚴",
  swim: "🏊",
  strength: "🏋️",
  rest: "😴",
};

const INTENSITY_DOT: Record<string, string> = {
  easy: "bg-teal",
  moderate: "bg-orange",
  hard: "bg-peach",
  rest: "bg-border",
};

const INTENSITY_BORDER: Record<string, string> = {
  easy: "border-teal/30",
  moderate: "border-orange/30",
  hard: "border-peach/30",
  rest: "border-border",
};

function WorkoutCard({ w }: { w: UpcomingWorkout }) {
  const [open, setOpen] = useState(false);
  const date = new Date(w.workout_date + "T00:00:00");
  const isToday = w.workout_date === new Date().toISOString().slice(0, 10);
  const isTomorrow = (() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return w.workout_date === tomorrow.toISOString().slice(0, 10);
  })();

  const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
  const dateStr = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const hasDetail = !!(
    w.agent_output?.workoutStructure || w.agent_output?.rationale
  );

  return (
    <div
      className={`rounded-2xl border bg-bg-card shadow-sm overflow-hidden transition-colors ${
        isToday
          ? "border-teal"
          : (INTENSITY_BORDER[w.intensity] ?? "border-border")
      }`}
    >
      {/* Card header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-bold uppercase tracking-widest ${
                  isToday ? "text-teal" : "text-muted"
                }`}
              >
                {isToday ? "Today" : isTomorrow ? "Tomorrow" : dayName}
              </span>
              {isToday && (
                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-teal animate-pulse" />
              )}
            </div>
            <p className="text-muted text-xs mt-0.5">{dateStr}</p>
          </div>
          <div className="text-3xl" aria-hidden>
            {SPORT_ICONS[w.sport] ?? "🏅"}
          </div>
        </div>

        <div className="flex items-baseline gap-3">
          <span className="text-text font-bold text-xl capitalize">
            {w.sport}
          </span>
          <span className="text-orange font-semibold">
            {w.duration_min} min
          </span>
          <div className="flex items-center gap-1.5 ml-auto">
            <WorkoutBadge
              energySystem={w.agent_output?.energySystem}
              intensity={w.intensity}
              className="text-[10px]"
            />
          </div>
        </div>

        {w.agent_output?.periodizationPhase && (
          <p className="text-muted text-xs mt-1 font-medium">
            {w.agent_output.periodizationPhase}
          </p>
        )}
      </div>

      {/* Expandable detail */}
      {hasDetail && (
        <>
          <button
            onClick={() => setOpen((o) => !o)}
            className="w-full flex items-center justify-between px-5 py-2.5 border-t border-border text-xs text-muted hover:text-text transition-colors"
            aria-expanded={open}
          >
            <span className="font-medium">
              {open ? "Hide details" : "Show details"}
            </span>
            <svg
              className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {open && (
            <div className="px-5 pb-5 space-y-3 border-t border-border pt-4 bg-bg/50">
              {w.agent_output?.phases && w.agent_output.phases.length > 0 && (
                <WorkoutChart phases={w.agent_output.phases} sport={w.sport} />
              )}
              {w.agent_output?.workoutStructure && (
                <pre className="text-xs text-text font-mono whitespace-pre-wrap leading-relaxed">
                  {w.agent_output.workoutStructure}
                </pre>
              )}
              {w.agent_output?.rationale && (
                <p className="text-xs text-muted leading-relaxed">
                  <span className="font-semibold text-text">Rationale · </span>
                  {w.agent_output.rationale}
                </p>
              )}
              {w.agent_output?.adjustmentsFromPlan && (
                <p className="text-xs text-muted leading-relaxed">
                  <span className="font-semibold text-text">
                    Adjustments ·{" "}
                  </span>
                  {w.agent_output.adjustmentsFromPlan}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PlanSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: 7 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-border bg-bg-card p-5 space-y-3 animate-pulse shadow-sm"
        >
          <div className="flex justify-between">
            <div className="space-y-1.5">
              <div className="h-3 w-16 rounded bg-border" />
              <div className="h-2.5 w-10 rounded bg-border" />
            </div>
            <div className="h-8 w-8 rounded bg-border" />
          </div>
          <div className="h-5 w-32 rounded bg-border" />
          <div className="h-3 w-48 rounded bg-border" />
        </div>
      ))}
    </div>
  );
}

export default function PlanPage() {
  const { data, isLoading, mutate } = useSWR<{ upcoming: UpcomingWorkout[] }>(
    `${API_URL}/analysis/${ATHLETE_ID}/upcoming`,
    fetcher,
    { refreshInterval: 120_000 },
  );

  const [generating, setGenerating] = useState(false);

  async function regenerate() {
    setGenerating(true);
    try {
      await fetch(`${API_URL}/analysis/${ATHLETE_ID}/generate-week`, {
        method: "POST",
      });
      setTimeout(() => {
        mutate();
        setGenerating(false);
      }, 8000);
    } catch {
      setGenerating(false);
    }
  }

  const workouts = data?.upcoming ?? [];

  // Weekly summary stats
  const totalMinutes = workouts.reduce((s, w) => s + w.duration_min, 0);
  const sportCounts = workouts.reduce<Record<string, number>>((acc, w) => {
    acc[w.sport] = (acc[w.sport] ?? 0) + 1;
    return acc;
  }, {});
  const phases = [
    ...new Set(
      workouts
        .map((w: any) => w.agent_output?.periodizationPhase)
        .filter(Boolean),
    ),
  ];

  return (
    <div className="min-h-screen bg-bg px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-text font-bold text-2xl">Training Plan</h1>
            <p className="text-muted text-sm mt-1">
              Your upcoming week, structured by the coach.
            </p>
          </div>
          <button
            onClick={regenerate}
            disabled={generating || isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-semibold text-muted hover:text-text hover:border-teal transition-colors disabled:opacity-50"
          >
            {generating ? (
              <>
                <span className="inline-block w-3.5 h-3.5 border-2 border-muted border-t-teal rounded-full animate-spin" />
                Generating…
              </>
            ) : (
              "Re-generate week"
            )}
          </button>
        </div>

        {/* Summary strip */}
        {!isLoading && workouts.length > 0 && (
          <div className="rounded-xl border border-border bg-bg-card px-5 py-4 flex items-center gap-6 flex-wrap">
            <div className="text-center">
              <p className="text-2xl font-bold text-teal">
                {Math.round(totalMinutes / 60)}h{" "}
                {totalMinutes % 60 > 0 ? `${totalMinutes % 60}m` : ""}
              </p>
              <p className="text-muted text-xs mt-0.5">planned volume</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-center">
              <p className="text-2xl font-bold text-orange">
                {workouts.length}
              </p>
              <p className="text-muted text-xs mt-0.5">sessions</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="flex flex-wrap gap-2">
              {Object.entries(sportCounts).map(([sport, count]) => (
                <span
                  key={sport}
                  className="flex items-center gap-1 text-xs text-muted font-medium"
                >
                  {SPORT_ICONS[sport] ?? "🏅"}
                  <span className="capitalize">{sport}</span>
                  <span className="text-text font-semibold">×{count}</span>
                </span>
              ))}
            </div>
            {phases.length > 0 && (
              <>
                <div className="h-8 w-px bg-border hidden sm:block" />
                <p className="text-xs text-muted">
                  Phase:{" "}
                  <span className="text-text font-semibold">{phases[0]}</span>
                </p>
              </>
            )}
          </div>
        )}

        {/* Workout cards grid */}
        {isLoading ? (
          <PlanSkeleton />
        ) : workouts.length === 0 ? (
          <div className="text-center py-16 text-muted space-y-3">
            <p className="text-5xl">📅</p>
            <p className="font-medium">No workouts planned yet.</p>
            <button
              onClick={regenerate}
              className="inline-flex items-center gap-2 mt-2 px-5 py-2.5 rounded-lg bg-teal text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Generate This Week
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-1">
            {workouts.map((w: any) => (
              <WorkoutCard key={w.workout_date} w={w} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
