"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:7000";
const ATHLETE_ID = process.env.NEXT_PUBLIC_ATHLETE_ID ?? "";

const fetcher = (url: string) => fetch(url).then((r: any) => r.json());

interface WellnessRow {
  log_date: string;
  hrv: number | null;
  hrv_score: number | null;
  rhr: number | null;
  sleep_score: number | null;
  sleep_hours: number | null;
  sleep_quality: string | null;
}

interface WorkoutPhase {
  name: string;
  durationMin: number;
  description: string;
  targetZone?: string;
}

interface Analysis {
  analysis_date: string;
  readiness_score: number;
  hrv_trend: string;
  agent_output: {
    readiness: string;
    summary: string;
    flags: string[];
    recommendation: string;
  };
}

interface Workout {
  sport: string;
  duration_min: number;
  intensity: string;
  rationale: string;
  agent_output: {
    sport: string;
    durationMin: number;
    intensity: string;
    structure: { phases: WorkoutPhase[] };
    workoutStructure?: string;
    rationale?: string;
    adjustmentsFromPlan?: string[];
    periodizationPhase: string;
  };
}

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
  };
}

const readinessColor: Record<string, string> = {
  high: "text-teal",
  moderate: "text-orange",
  low: "text-peach",
  rest: "text-orange",
};

const intensityBorder: Record<string, string> = {
  easy: "border-border",
  moderate: "border-peach",
  hard: "border-orange",
  rest: "border-border",
};

function PushButton({ workout }: { workout: Workout }) {
  const [state, setState] = useState<"idle" | "pushing" | "done" | "error">(
    "idle",
  );

  async function push() {
    setState("pushing");
    try {
      const res = await fetch(`${API}/workout/${ATHLETE_ID}/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workout: workout.agent_output }),
      });
      if (!res.ok) throw new Error(await res.text());
      setState("done");
      setTimeout(() => setState("idle"), 3000);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  }

  const label = {
    idle: "Push to Intervals",
    pushing: "Pushing…",
    done: "Pushed ✓",
    error: "Failed — retry",
  }[state];
  return (
    <button
      onClick={push}
      disabled={state === "pushing" || state === "done"}
      className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
        state === "done"
          ? "text-teal bg-teal/10"
          : state === "error"
            ? "text-orange bg-orange/10"
            : "text-muted hover:text-text hover:bg-[var(--bg-assistant)] border border-border"
      }`}
    >
      {label}
    </button>
  );
}

// ── Intervals.icu text parser ─────────────────────────────────────────────────
interface ParsedStep {
  duration: string;
  intensity: string;
}
interface ParsedSection {
  type: "step" | "intervals";
  count?: number;
  steps: ParsedStep[];
}

function parseStep(line: string): ParsedStep | null {
  const m = line.match(/^-\s*(\S+)\s+(.+)$/);
  return m ? { duration: m[1], intensity: m[2].trim() } : null;
}

function parseWorkoutStructure(text: string): ParsedSection[] {
  const sections: ParsedSection[] = [];
  const blocks = text.trim().split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block.trim().split("\n").filter(Boolean);
    if (!lines.length) continue;
    const intervalHeader = lines[0].match(/^(\d+)x$/i);
    if (intervalHeader) {
      const steps = lines
        .slice(1)
        .map(parseStep)
        .filter((s): s is ParsedStep => !!s);
      if (steps.length)
        sections.push({
          type: "intervals",
          count: parseInt(intervalHeader[1]),
          steps,
        });
    } else {
      for (const line of lines) {
        const step = parseStep(line);
        if (step) sections.push({ type: "step", steps: [step] });
      }
    }
  }
  return sections;
}

const sectionLabel = (i: number, total: number) => {
  if (i === 0) return "Warm-up";
  if (i === total - 1) return "Cool-down";
  return "Main set";
};

function WorkoutStructureView({ text }: { text: string }) {
  const sections = parseWorkoutStructure(text);
  let stepCount = 0;
  const totalSteps = sections.reduce(
    (n, s) => n + (s.type === "step" ? 1 : 0),
    0,
  );

  return (
    <div className="space-y-3 pt-3 border-t border-border">
      <p className="text-xs font-semibold tracking-[0.15em] uppercase text-muted">
        Structure
      </p>
      <div className="space-y-2">
        {sections.map((section, si) => {
          if (section.type === "intervals") {
            return section.steps.map((step, i) => {
              const minPrefix = step.intensity.match(/^(min|m)\s+(.+)$/i);
              const dur = minPrefix ? `${step.duration} min` : step.duration;
              const desc = minPrefix ? minPrefix[2] : step.intensity;
              return (
                <div key={`${si}-${i}`} className="flex items-baseline gap-3">
                  <span className="text-muted text-xs font-medium w-16 shrink-0">
                    {i === 0 ? `${section.count}× set` : ""}
                  </span>
                  <span className="text-orange font-semibold text-sm shrink-0 tabular-nums">
                    {dur}
                  </span>
                  <span className="text-text text-sm flex-1">{desc}</span>
                </div>
              );
            });
          }
          const label = sectionLabel(stepCount, totalSteps);
          stepCount++;
          const step = section.steps[0];
          const minPrefix = step.intensity.match(/^(min|m)\s+(.+)$/i);
          const xPrefix = step.intensity.match(/^x\s+(.+)$/i);
          const dur = minPrefix
            ? `${step.duration} min`
            : xPrefix
              ? `${step.duration}×`
              : step.duration;
          const desc = minPrefix
            ? minPrefix[2]
            : xPrefix
              ? xPrefix[1]
              : step.intensity;
          return (
            <div key={si} className="flex items-baseline gap-3">
              <span className="text-muted text-xs font-medium w-16 shrink-0">
                {label}
              </span>
              <span className="text-orange font-semibold text-sm shrink-0 tabular-nums">
                {dur}
              </span>
              <span className="text-text text-sm flex-1">{desc}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="rounded-2xl border border-border bg-bg-card p-6 shadow-sm animate-pulse space-y-4">
      <div className="h-3 w-24 rounded bg-border" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className={`h-4 rounded bg-border ${i % 2 === 0 ? "w-full" : "w-3/4"}`}
          />
        ))}
      </div>
    </div>
  );
}

function WorkoutRow({
  w,
  isToday,
  hasDetail,
  dayLabel,
}: {
  w: UpcomingWorkout;
  isToday: boolean;
  hasDetail: boolean;
  dayLabel: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`rounded-xl border transition-colors ${
        isToday ? "border-teal bg-[var(--bg-assistant)]" : "border-border"
      }`}
    >
      {/* Summary row */}
      <button
        className="w-full flex items-center gap-4 px-4 py-3 text-left"
        onClick={() => hasDetail && setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div className="w-20 shrink-0">
          <p
            className={`text-xs font-semibold ${isToday ? "text-teal" : "text-muted"}`}
          >
            {isToday ? "Today" : dayLabel.split(",")[0]}
          </p>
          <p className="text-xs text-muted">
            {isToday
              ? dayLabel.split(",")[1]?.trim()
              : dayLabel.slice(dayLabel.indexOf(",") + 2)}
          </p>
        </div>
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <span className="font-semibold text-text capitalize text-sm">
            {w.sport}
          </span>
          <span className="text-orange text-sm font-medium">
            {w.duration_min} min
          </span>
          <span className="text-muted text-xs capitalize">· {w.intensity}</span>
        </div>
        {w.agent_output?.periodizationPhase && (
          <p className="text-xs text-muted shrink-0 hidden sm:block truncate max-w-[160px]">
            {w.agent_output.periodizationPhase}
          </p>
        )}
        {hasDetail && (
          <svg
            className={`w-4 h-4 text-muted shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        )}
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          {w.agent_output?.workoutStructure && (
            <pre className="text-xs text-text font-mono whitespace-pre-wrap leading-relaxed bg-bg rounded-lg p-3">
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
              <span className="font-semibold text-text">Adjustments · </span>
              {w.agent_output.adjustmentsFromPlan}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const {
    data,
    isLoading,
    mutate: mutateToday,
  } = useSWR<{
    analysis: Analysis;
    workout: Workout;
  }>(`${API}/analysis/${ATHLETE_ID}/today`, fetcher, {
    refreshInterval: 60_000,
  });

  const { data: wellnessData, isLoading: wellnessLoading } = useSWR<{
    wellness: WellnessRow[];
  }>(`${API}/analysis/${ATHLETE_ID}/wellness`, fetcher, {
    refreshInterval: 60_000,
  });

  const {
    data: upcomingData,
    isLoading: upcomingLoading,
    mutate: mutateUpcoming,
  } = useSWR<{
    upcoming: UpcomingWorkout[];
  }>(`${API}/analysis/${ATHLETE_ID}/upcoming`, fetcher, {
    refreshInterval: 60_000,
  });

  const [generatingWeek, setGeneratingWeek] = useState(false);
  const [analyzingToday, setAnalyzingToday] = useState(false);

  // Auto-run analysis when loaded but no workout exists for today
  useEffect(() => {
    if (!isLoading && data && !data.workout && !analyzingToday) {
      setAnalyzingToday(true);
      fetch(`${API}/analysis/${ATHLETE_ID}/run`, { method: "POST" })
        .then(() => mutateToday())
        .finally(() => setAnalyzingToday(false));
    }
  }, [data, isLoading]);

  // Auto-generate when data loads and there are no upcoming workouts
  useEffect(() => {
    if (upcomingData && upcomingData.upcoming.length === 0 && !generatingWeek) {
      setGeneratingWeek(true);
      fetch(`${API}/analysis/${ATHLETE_ID}/generate-week`, { method: "POST" })
        .then(() => mutateUpcoming())
        .finally(() => setGeneratingWeek(false));
    }
  }, [upcomingData]);

  const allDays = wellnessData?.wellness ?? [];
  const today = allDays[0] ?? null;

  /** 7-day rolling average of a metric (excludes today) */
  function weekAvg(key: keyof WellnessRow): number | null {
    const vals = allDays
      .slice(1)
      .map((r: any) => r[key] as number | null)
      .filter((v): v is number => v != null);
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  /** Compare today vs 7-day average. threshold avoids noise. */
  function trend(
    curr: number | null,
    avg: number | null | undefined,
    threshold = 1,
  ) {
    if (curr == null || avg == null) return null;
    const diff = curr - avg;
    if (Math.abs(diff) < threshold) return "stable";
    return diff > 0 ? "up" : "down";
  }

  const trendIcon = (t: ReturnType<typeof trend>) =>
    t === "up" ? "↑" : t === "down" ? "↓" : t === "stable" ? "→" : "–";
  const trendColor = (t: ReturnType<typeof trend>, higherIsBetter = true) => {
    if (t === "stable" || t == null) return "text-muted";
    const good = higherIsBetter ? t === "up" : t === "down";
    return good ? "text-teal" : "text-orange";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <CardSkeleton rows={1} />
          <CardSkeleton rows={3} />
          <CardSkeleton rows={4} />
        </div>
      </div>
    );
  }

  if (!isLoading && !analyzingToday && !data?.analysis && !data?.workout) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-bg text-muted gap-4">
        <p className="font-medium">No analysis found for today.</p>
        <button
          onClick={() =>
            fetch(`${API}/analysis/${ATHLETE_ID}/run`, { method: "POST" })
          }
          className="rounded-xl bg-orange hover:bg-peach px-5 py-2 text-white text-sm font-semibold transition-colors"
        >
          Run Analysis Now
        </button>
      </div>
    );
  }

  const { analysis, workout } = data!;

  return (
    <div className="min-h-screen bg-bg px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Health Metrics Card */}
        {wellnessLoading ? (
          <CardSkeleton rows={1} />
        ) : today ? (
          <div className="rounded-2xl border border-border bg-bg-card px-6 py-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold tracking-[0.15em] uppercase text-muted">
                Health Metrics
              </h2>
              <span className="text-xs text-muted">{today.log_date}</span>
            </div>
            <div className="flex justify-around gap-4">
              {/* HRV — prefer hrv_score (0-100 composite), fall back to raw ms */}
              <div className="space-y-1 text-center">
                <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted">
                  {today.hrv_score != null ? "HRV Score" : "HRV"}
                </p>
                <div className="flex items-baseline justify-center gap-1.5">
                  <span className="text-3xl font-bold text-orange tabular-nums">
                    {today.hrv_score != null
                      ? today.hrv_score
                      : today.hrv != null
                        ? today.hrv.toFixed(0)
                        : "–"}
                  </span>
                  <span
                    className={`text-sm font-semibold ${
                      today.hrv_score != null
                        ? trendColor(
                            trend(today.hrv_score, weekAvg("hrv_score")),
                          )
                        : trendColor(trend(today.hrv, weekAvg("hrv"), 2))
                    }`}
                  >
                    {today.hrv_score != null
                      ? trendIcon(trend(today.hrv_score, weekAvg("hrv_score")))
                      : trendIcon(trend(today.hrv, weekAvg("hrv"), 2))}
                  </span>
                </div>
                <p className="text-xs text-muted">
                  {today.hrv_score != null && today.hrv != null
                    ? `${today.hrv.toFixed(1)} ms`
                    : today.hrv_score != null
                      ? "/100"
                      : "ms"}
                </p>
              </div>

              {/* RHR */}
              <div className="space-y-1 text-center">
                <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted">
                  Resting HR
                </p>
                <div className="flex items-baseline justify-center gap-1.5">
                  <span className="text-3xl font-bold text-teal tabular-nums">
                    {today.rhr ?? "–"}
                  </span>
                  <span
                    className={`text-sm font-semibold ${trendColor(trend(today.rhr, weekAvg("rhr")), false)}`}
                  >
                    {trendIcon(trend(today.rhr, weekAvg("rhr")))}
                  </span>
                </div>
                <p className="text-xs text-muted">bpm</p>
              </div>

              {/* Sleep — show hours if available, else score only */}
              <div className="space-y-1 text-center">
                <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted">
                  {today.sleep_hours != null ? "Sleep" : "Sleep Score"}
                </p>
                <div className="flex items-baseline justify-center gap-1.5">
                  <span className="text-3xl font-bold text-orange tabular-nums">
                    {today.sleep_hours != null
                      ? today.sleep_hours.toFixed(1)
                      : (today.sleep_score ?? "–")}
                  </span>
                  <span
                    className={`text-sm font-semibold ${
                      today.sleep_hours != null
                        ? trendColor(
                            trend(
                              today.sleep_hours,
                              weekAvg("sleep_hours"),
                              0.25,
                            ),
                          )
                        : trendColor(
                            trend(today.sleep_score, weekAvg("sleep_score"), 3),
                          )
                    }`}
                  >
                    {today.sleep_hours != null
                      ? trendIcon(
                          trend(
                            today.sleep_hours,
                            weekAvg("sleep_hours"),
                            0.25,
                          ),
                        )
                      : trendIcon(
                          trend(today.sleep_score, weekAvg("sleep_score"), 3),
                        )}
                  </span>
                </div>
                <p className="text-xs text-muted capitalize">
                  {today.sleep_hours != null
                    ? today.sleep_score != null
                      ? `score ${today.sleep_score}/100`
                      : "hours"
                    : (today.sleep_quality ?? "/100")}
                </p>
              </div>

              {/* Sleep Score — only show as 4th tile if sleep_hours available */}
              {today.sleep_hours != null && (
                <div className="space-y-1 text-center">
                  <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted">
                    Sleep Score
                  </p>
                  <div className="flex items-baseline justify-center gap-1.5">
                    <span className="text-3xl font-bold text-teal tabular-nums">
                      {today.sleep_score ?? "–"}
                    </span>
                    <span
                      className={`text-sm font-semibold ${trendColor(trend(today.sleep_score, weekAvg("sleep_score"), 3))}`}
                    >
                      {trendIcon(
                        trend(today.sleep_score, weekAvg("sleep_score"), 3),
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-muted capitalize">
                    {today.sleep_quality ?? "/100"}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* Recovery Card */}
        {isLoading ? (
          <CardSkeleton rows={3} />
        ) : (
          analysis && (
            <div className="rounded-2xl border border-border bg-bg-card p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold tracking-[0.15em] uppercase text-muted">
                  Recovery Status
                </h2>
                <span className="text-xs font-medium text-muted">
                  {analysis.analysis_date}
                </span>
              </div>

              {/* KPI row */}
              <div className="flex items-baseline gap-3">
                <span className="text-[42px] font-bold leading-none text-orange">
                  {analysis.readiness_score}
                </span>
                <span className="text-sm text-muted font-medium">/100</span>
                <span
                  className={`ml-1 text-lg font-semibold capitalize ${
                    readinessColor[analysis.agent_output?.readiness] ??
                    "text-teal"
                  }`}
                >
                  {analysis.agent_output?.readiness}
                </span>
              </div>

              <p className="text-text text-sm leading-relaxed">
                {analysis.agent_output?.summary}
              </p>

              {analysis.agent_output?.flags?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {analysis.agent_output.flags.map((flag, i) => (
                    <span
                      key={i}
                      className="text-xs bg-peach/20 border border-peach text-orange rounded-full px-3 py-1 font-medium"
                    >
                      {flag}
                    </span>
                  ))}
                </div>
              )}

              <p className="text-xs text-muted font-medium">
                HRV trend: {analysis.hrv_trend}
              </p>
            </div>
          )
        )}

        {/* Workout Card */}
        {isLoading ? (
          <CardSkeleton rows={4} />
        ) : (
          <div
            className={`rounded-2xl border bg-bg-card p-6 space-y-4 shadow-sm ${
              workout
                ? (intensityBorder[workout.intensity] ?? "border-border")
                : "border-border"
            }`}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold tracking-[0.15em] uppercase text-muted">
                Prescribed Workout
              </h2>
              {workout?.agent_output?.periodizationPhase && (
                <span className="text-xs font-medium text-muted capitalize">
                  {workout.agent_output.periodizationPhase}
                </span>
              )}
            </div>

            {workout ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-bold text-teal capitalize">
                      {workout.sport}
                    </span>
                    <span className="text-orange font-semibold">
                      {workout.duration_min} min
                    </span>
                    <span className="text-muted font-medium capitalize">
                      · {workout.intensity}
                    </span>
                  </div>
                  <PushButton workout={workout} />
                </div>

                <p className="text-text text-sm leading-relaxed">
                  {workout.rationale}
                </p>

                {workout.agent_output?.workoutStructure ? (
                  <WorkoutStructureView
                    text={workout.agent_output.workoutStructure}
                  />
                ) : workout.agent_output?.structure?.phases?.length > 0 ? (
                  <div className="space-y-3 pt-3 border-t border-border">
                    <p className="text-xs font-semibold tracking-[0.15em] uppercase text-muted">
                      Structure
                    </p>
                    {workout.agent_output.structure.phases.map((phase, i) => (
                      <div key={i} className="flex gap-4 text-sm">
                        <span className="text-orange font-semibold w-12 shrink-0 tabular-nums">
                          {phase.durationMin}m
                        </span>
                        <div>
                          <span className="font-semibold text-text">
                            {phase.name}
                          </span>
                          {phase.targetZone && (
                            <span className="text-muted">
                              {" "}
                              · {phase.targetZone}
                            </span>
                          )}
                          <p className="text-muted text-xs mt-0.5">
                            {phase.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted">
                {analyzingToday
                  ? "Generating today's workout…"
                  : "No workout prescribed for today."}
              </p>
            )}
          </div>
        )}

        {/* Upcoming Workouts Card */}
        {upcomingLoading && !upcomingData ? (
          <CardSkeleton rows={5} />
        ) : (
          <div className="rounded-2xl border border-border bg-bg-card p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold tracking-[0.15em] uppercase text-muted">
                Next 7 Days
              </h2>
              {generatingWeek && (
                <span className="text-xs text-muted">Generating…</span>
              )}
            </div>
            {upcomingData?.upcoming && upcomingData.upcoming.length > 0 ? (
              <div className="space-y-2">
                {upcomingData.upcoming.map((w: any) => {
                  const date = new Date(w.workout_date + "T00:00:00");
                  const dayLabel = date.toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  });
                  const isToday =
                    w.workout_date === new Date().toISOString().slice(0, 10);
                  const hasDetail = !!(
                    w.agent_output?.workoutStructure ||
                    w.agent_output?.rationale
                  );
                  return (
                    <WorkoutRow
                      key={w.workout_date}
                      w={w}
                      isToday={isToday}
                      hasDetail={hasDetail}
                      dayLabel={dayLabel}
                    />
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted">
                {generatingWeek
                  ? "Generating your week…"
                  : "No upcoming workouts."}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
