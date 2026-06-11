"use client";

import { useState, useEffect, useCallback } from "react";
import useSWR from "swr";
import { useTranslations } from "next-intl";
import { WorkoutChart, WorkoutBadge } from "@/components/WorkoutChart";
import { API_URL, ATHLETE_ID, fetcher } from "@/lib/api";
import { formatDuration, formatDistance, formatKcal } from "@/lib/formatters";
import {
  SPORT_ICONS,
  READINESS_COLORS,
  INTENSITY_BORDERS,
} from "@/lib/constants";

// ── Types ─────────────────────────────────────────────────────────────────────

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
  block_effectiveness: number | null;
  agent_output: {
    readiness: string;
    summary: string;
    yesterdayImpact?: string;
    trainingImplication?: string;
    flags: string[];
    recommendation: string;
    blockScoreExplanation?: string;
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
    energySystem?: string;
    phases?: { label: string; durationMin: number; intensityPct: number }[];
  };
}

interface Activity {
  id: string;
  activity_date: string;
  sport: string;
  name: string | null;
  duration_secs: number | null;
  distance_m: number | null;
  tss: number | null;
  intensity_factor: number | null;
  atl: number | null;
  ctl: number | null;
  joules: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  avg_power: number | null;
  normalized_power: number | null;
  decoupling: number | null;
  elevation_m: number | null;
  rpe: number | null;
  athlete_comments: string | null;
}

interface SportProgress {
  sport: string;
  summary: string;
}

// ── WorkoutStructureView ──────────────────────────────────────────────────────

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
  const clean = line.replace(/^[-•]\s*/, ""); // strip optional leading - or bullet

  // Intervals.icu compact format: "15m description" or "15m\ndescription"
  let m = clean.match(/^(\d+)m\s+(.+)$/i);
  if (m) return { duration: `${m[1]} min`, intensity: m[2].trim() };

  // Natural language: "20 min description" or "3x10 min description"
  m = clean.match(/^(\d+(?:x\d+)?)\s+min\s+(.+)$/i);
  if (m) return { duration: `${m[1]} min`, intensity: m[2].trim() };

  return null;
}

function parseWorkoutStructure(text: string): ParsedSection[] {
  const sections: ParsedSection[] = [];
  for (const block of text.trim().split(/\n\s*\n/)) {
    const lines = block.trim().split("\n").filter(Boolean);
    if (!lines.length) continue;
    const m = lines[0].match(/^(\d+)x$/i);
    if (m) {
      const steps = lines
        .slice(1)
        .map(parseStep)
        .filter((s): s is ParsedStep => !!s);
      if (steps.length)
        sections.push({ type: "intervals", count: parseInt(m[1]), steps });
    } else {
      for (const line of lines) {
        const step = parseStep(line);
        if (step) sections.push({ type: "step", steps: [step] });
      }
    }
  }
  return sections;
}

function WorkoutStructureView({ text }: { text: string }) {
  const t = useTranslations("dashboard.workout");
  const sections = parseWorkoutStructure(text);
  let stepCount = 0;
  const totalSteps = sections.reduce(
    (n, s) => n + (s.type === "step" ? 1 : 0),
    0,
  );

  const label = (i: number, total: number) => {
    if (i === 0) return t("warmUp");
    if (i === total - 1) return t("coolDown");
    return t("mainSet");
  };

  const labelStyle: Record<string, string> = {
    [t("warmUp")]: "text-teal",
    [t("mainSet")]: "text-orange",
    [t("coolDown")]: "text-teal",
  };

  return (
    <div className="space-y-4 pt-3 border-t border-border">
      <p className="text-xs font-semibold tracking-[0.15em] uppercase text-muted">
        {t("structure")}
      </p>
      <div className="space-y-3">
        {sections.map((section, si) => {
          if (section.type === "intervals") {
            return section.steps.map((step, i) => (
              <div key={`${si}-${i}`}>
                {i === 0 && (
                  <p
                    className={`text-sm font-semibold mb-0.5 ${labelStyle[t("mainSet")]}`}
                  >
                    {t("mainSet")}
                  </p>
                )}
                <p className="text-sm text-text">
                  {step.duration} {step.intensity}
                </p>
              </div>
            ));
          }
          const lbl = label(stepCount, totalSteps);
          stepCount++;
          const step = section.steps[0];
          return (
            <div key={si}>
              <p
                className={`text-sm font-semibold mb-0.5 ${labelStyle[lbl] ?? "text-muted"}`}
              >
                {lbl}
              </p>
              <p className="text-sm text-text">
                {step.duration} {step.intensity}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── PushButton ────────────────────────────────────────────────────────────────

function PushButton({ workout }: { workout: Workout }) {
  const t = useTranslations("dashboard.workout");
  const [state, setState] = useState<"idle" | "pushing" | "done" | "error">(
    "idle",
  );

  async function push() {
    setState("pushing");
    try {
      const res = await fetch(`${API_URL}/workout/${ATHLETE_ID}/push`, {
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
    idle: t("push"),
    pushing: t("pushing"),
    done: t("pushed"),
    error: t("pushFailed"),
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

// ── CardSkeleton ──────────────────────────────────────────────────────────────

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

// ── Activity Modal ────────────────────────────────────────────────────────────

function ActivityModal({
  activity,
  onClose,
}: {
  activity: Activity;
  onClose: () => void;
}) {
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  useEffect(() => {
    setLoadingAi(true);
    fetch(`${API_URL}/analysis/${ATHLETE_ID}/activity-analysis/${activity.id}`)
      .then((r: any) => r.json())
      .then((d) => setAiAnalysis(d.analysis ?? null))
      .catch(() => setAiAnalysis(null))
      .finally(() => setLoadingAi(false));
  }, [activity.id]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const dateLabel = new Date(
    activity.activity_date + "T00:00:00",
  ).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg bg-bg-card border border-border rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Modal header */}
        <div className="sticky top-0 bg-bg-card border-b border-border px-6 py-4 flex items-start justify-between gap-4 rounded-t-2xl">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">
                {SPORT_ICONS[activity.sport] ?? "🏅"}
              </span>
              <h2 className="font-bold text-text text-base">
                {activity.name ?? activity.sport}
              </h2>
            </div>
            <p className="text-muted text-xs mt-0.5">{dateLabel}</p>
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

        <div className="px-6 py-5 space-y-5">
          {/* Key metrics grid */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: "Duration",
                value: formatDuration(activity.duration_secs),
              },
              { label: "Distance", value: formatDistance(activity.distance_m) },
              { label: "Energy", value: formatKcal(activity.joules) },
              {
                label: "TSS",
                value:
                  activity.tss != null
                    ? Math.round(activity.tss).toString()
                    : "—",
              },
              {
                label: "IF",
                value:
                  activity.intensity_factor != null
                    ? activity.intensity_factor.toFixed(2)
                    : "—",
              },
              {
                label: "RPE",
                value: activity.rpe != null ? `${activity.rpe}/10` : "—",
              },
              {
                label: "Avg HR",
                value:
                  activity.avg_hr != null
                    ? `${Math.round(activity.avg_hr)} bpm`
                    : "—",
              },
              {
                label: "Avg Power",
                value:
                  activity.avg_power != null
                    ? `${Math.round(activity.avg_power)} W`
                    : "—",
              },
              {
                label: "Decoupling",
                value:
                  activity.decoupling != null
                    ? `${activity.decoupling.toFixed(1)}%`
                    : "—",
              },
              {
                label: "Elevation",
                value:
                  activity.elevation_m != null
                    ? `${Math.round(activity.elevation_m)} m`
                    : "—",
              },
              {
                label: "ATL",
                value:
                  activity.atl != null
                    ? Math.round(activity.atl).toString()
                    : "—",
              },
              {
                label: "CTL",
                value:
                  activity.ctl != null
                    ? Math.round(activity.ctl).toString()
                    : "—",
              },
            ]
              .filter(({ value }) => value !== "—")
              .map(({ label, value }) => (
                <div key={label} className="bg-bg rounded-xl p-3 text-center">
                  <p className="text-muted text-[10px] font-semibold uppercase tracking-widest">
                    {label}
                  </p>
                  <p className="text-text font-semibold text-sm mt-0.5 tabular-nums">
                    {value}
                  </p>
                </div>
              ))}
          </div>

          {/* Athlete notes */}
          {activity.athlete_comments && (
            <div className="bg-bg rounded-xl px-4 py-3">
              <p className="text-muted text-xs font-semibold uppercase tracking-widest mb-1">
                Your notes
              </p>
              <p className="text-text text-sm leading-relaxed">
                {activity.athlete_comments}
              </p>
            </div>
          )}

          {/* AI post-workout analysis */}
          <div className="border-t border-border pt-4 space-y-2">
            <p className="text-muted text-xs font-semibold uppercase tracking-widest">
              Coach Analysis
            </p>
            {loadingAi ? (
              <div className="flex items-center gap-2 text-muted text-sm animate-pulse">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-teal animate-bounce [animation-delay:-0.3s]" />
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-teal animate-bounce [animation-delay:-0.15s]" />
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-teal animate-bounce" />
                <span className="ml-1">Analyzing…</span>
              </div>
            ) : aiAnalysis ? (
              <p className="text-text text-sm leading-relaxed">{aiAnalysis}</p>
            ) : (
              <p className="text-muted text-sm">No analysis available.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Recent Activity Row ───────────────────────────────────────────────────────

function ActivityRow({
  activity,
  onClick,
}: {
  activity: Activity;
  onClick: () => void;
}) {
  const date = new Date(activity.activity_date + "T00:00:00");
  const dayLabel = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 px-4 py-3 rounded-xl border border-border hover:border-teal hover:bg-[var(--bg-assistant)] transition-colors text-left group"
    >
      <span className="text-xl shrink-0">
        {SPORT_ICONS[activity.sport] ?? "🏅"}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-text text-sm capitalize">
            {activity.sport}
          </span>
          {activity.name && activity.name !== activity.sport && (
            <span className="text-muted text-xs truncate">{activity.name}</span>
          )}
        </div>
        <p className="text-muted text-xs mt-0.5">{dayLabel}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {activity.tss != null && (
          <span className="text-xs text-muted font-medium tabular-nums">
            {Math.round(activity.tss)} TSS
          </span>
        )}
        <span className="text-orange text-sm font-semibold tabular-nums">
          {formatDuration(activity.duration_secs)}
        </span>
        <svg
          className="w-4 h-4 text-muted group-hover:text-teal transition-colors"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}

// ── Main DashboardPage ────────────────────────────────────────────────────────

export default function DashboardPage() {
  const t = useTranslations("dashboard");

  const {
    data,
    isLoading,
    mutate: mutateToday,
  } = useSWR<{ analysis: Analysis; workout: Workout }>(
    `${API_URL}/analysis/${ATHLETE_ID}/today`,
    fetcher,
    {
      refreshInterval: 0,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  const { data: wellnessData, isLoading: wellnessLoading } = useSWR<{
    wellness: WellnessRow[];
  }>(`${API_URL}/analysis/${ATHLETE_ID}/wellness`, fetcher, {
    refreshInterval: 0,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const { data: activitiesData, isLoading: activitiesLoading } = useSWR<{
    activities: Activity[];
  }>(`${API_URL}/athlete/${ATHLETE_ID}/activities?days=30`, fetcher, {
    refreshInterval: 0,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const { data: progressData } = useSWR<{ sportProgress: SportProgress[] }>(
    `${API_URL}/analysis/${ATHLETE_ID}/sport-progress`,
    fetcher,
    {
      refreshInterval: 0,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  const [analyzingToday, setAnalyzingToday] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(
    null,
  );
  const [showBlockScoreInfo, setShowBlockScoreInfo] = useState(false);

  useEffect(() => {
    if (!isLoading && data && !data.workout && !analyzingToday) {
      setAnalyzingToday(true);
      fetch(`${API_URL}/analysis/${ATHLETE_ID}/run`, { method: "POST" })
        .then(() => mutateToday())
        .finally(() => setAnalyzingToday(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, isLoading, analyzingToday]);

  const closeModal = useCallback(() => setSelectedActivity(null), []);

  const allDays = wellnessData?.wellness ?? [];
  const today = allDays[0] ?? null;

  function weekAvg(key: keyof WellnessRow): number | null {
    const vals = allDays
      .slice(1)
      .map((r: any) => r[key] as number | null)
      .filter((v): v is number => v != null);
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

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

  const trendIcon = (tr: ReturnType<typeof trend>) =>
    tr === "up" ? "↑" : tr === "down" ? "↓" : tr === "stable" ? "—" : "";
  const trendColor = (tr: ReturnType<typeof trend>) => {
    if (tr === "stable" || tr == null) return "text-muted";
    return "text-orange";
  };

  // Show loading until we have analysis with readiness (prevents workout flickering)
  if (isLoading || analyzingToday || (!data?.analysis && !data?.workout)) {
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
            fetch(`${API_URL}/analysis/${ATHLETE_ID}/run`, { method: "POST" })
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
    <>
      {/* Activity detail modal */}
      {selectedActivity && (
        <ActivityModal activity={selectedActivity} onClose={closeModal} />
      )}

      <div className="min-h-screen bg-bg px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Health Metrics Card */}
          {wellnessLoading ? (
            <CardSkeleton rows={1} />
          ) : today ? (
            <div className="rounded-2xl border border-border bg-bg-card px-4 sm:px-6 py-4 sm:py-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-semibold tracking-[0.15em] uppercase text-muted">
                  {t("health.title")}
                </h2>
                <span className="text-xs text-muted">{today.log_date}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                {/* HRV */}
                <div className="space-y-1 text-center">
                  <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted">
                    {today.hrv_score != null ? "HRV Score" : t("health.hrv")}
                  </p>
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-2xl sm:text-3xl font-bold text-teal tabular-nums">
                      {today.hrv_score != null
                        ? today.hrv_score
                        : today.hrv != null
                          ? today.hrv.toFixed(0)
                          : "–"}
                    </span>
                    <span className="text-xs sm:text-sm font-semibold text-teal">
                      {today.hrv_score != null ? "/100" : "ms"}
                    </span>
                    <span
                      className={`text-sm font-semibold ${today.hrv_score != null ? trendColor(trend(today.hrv_score, weekAvg("hrv_score"))) : trendColor(trend(today.hrv, weekAvg("hrv"), 2))}`}
                    >
                      {today.hrv_score != null
                        ? trendIcon(
                            trend(today.hrv_score, weekAvg("hrv_score")),
                          )
                        : trendIcon(trend(today.hrv, weekAvg("hrv"), 2))}
                    </span>
                  </div>
                  {today.hrv_score != null && today.hrv != null && (
                    <p className="text-xs text-muted">
                      {today.hrv.toFixed(1)} ms
                    </p>
                  )}
                </div>

                {/* RHR */}
                <div className="space-y-1 text-center">
                  <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted">
                    {t("health.rhr")}
                  </p>
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-2xl sm:text-3xl font-bold text-teal tabular-nums">
                      {today.rhr ?? "–"}
                    </span>
                    <span className="text-xs sm:text-sm font-semibold text-teal">
                      bpm
                    </span>
                    <span
                      className={`text-sm font-semibold ${trendColor(trend(today.rhr, weekAvg("rhr")))}`}
                    >
                      {trendIcon(trend(today.rhr, weekAvg("rhr")))}
                    </span>
                  </div>
                </div>

                {/* Sleep hours or Sleep Score */}
                <div className="space-y-1 text-center">
                  <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted">
                    {today.sleep_hours != null
                      ? t("health.sleep")
                      : "Sleep Score"}
                  </p>
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-2xl sm:text-3xl font-bold text-teal tabular-nums">
                      {today.sleep_hours != null
                        ? today.sleep_hours.toFixed(1)
                        : (today.sleep_score ?? "–")}
                    </span>
                    <span className="text-xs sm:text-sm font-semibold text-teal">
                      {today.sleep_hours != null ? "h" : "/100"}
                    </span>
                    <span
                      className={`text-sm font-semibold ${today.sleep_hours != null ? trendColor(trend(today.sleep_hours, weekAvg("sleep_hours"), 0.25)) : trendColor(trend(today.sleep_score, weekAvg("sleep_score"), 3))}`}
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
                  {today.sleep_hours != null && today.sleep_score != null && (
                    <p className="text-xs text-muted">
                      score {today.sleep_score}/100
                    </p>
                  )}
                </div>

                {/* Sleep Score (separate column when sleep_hours is available) */}
                {today.sleep_hours != null && (
                  <div className="space-y-1 text-center">
                    <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted">
                      Sleep Score
                    </p>
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-2xl sm:text-3xl font-bold text-teal tabular-nums">
                        {today.sleep_score ?? "–"}
                      </span>
                      <span className="text-xs sm:text-sm font-semibold text-teal">
                        /100
                      </span>
                      <span
                        className={`text-sm font-semibold ${trendColor(trend(today.sleep_score, weekAvg("sleep_score"), 3))}`}
                      >
                        {trendIcon(
                          trend(today.sleep_score, weekAvg("sleep_score"), 3),
                        )}
                      </span>
                    </div>
                    {today.sleep_quality && (
                      <p className="text-xs text-muted capitalize">
                        {today.sleep_quality}
                      </p>
                    )}
                  </div>
                )}

                {/* Readiness */}
                {analysis && (
                  <div className="space-y-1 text-center">
                    <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted">
                      Readiness
                    </p>
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-2xl sm:text-3xl font-bold tabular-nums text-teal">
                        {analysis.readiness_score}
                      </span>
                      <span className="text-xs sm:text-sm font-semibold text-teal">
                        /100
                      </span>
                    </div>
                  </div>
                )}

                {/* Block Effectiveness */}
                {analysis?.block_effectiveness != null && (
                  <div className="space-y-1 text-center">
                    <div className="relative flex items-center justify-center gap-1">
                      <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted">
                        Block Score
                      </p>
                      {/* Info Icon */}
                      <button
                        onMouseEnter={() => setShowBlockScoreInfo(true)}
                        onMouseLeave={() => setShowBlockScoreInfo(false)}
                        onClick={() =>
                          setShowBlockScoreInfo(!showBlockScoreInfo)
                        }
                        className="text-muted hover:text-text transition-colors"
                        aria-label="Block Score Information"
                      >
                        <svg
                          className="w-3 h-3"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>

                      {/* Tooltip - positioned absolutely to not affect layout */}
                      {showBlockScoreInfo && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 z-50 bg-bg-card border-2 border-teal rounded-lg shadow-xl p-3 text-xs text-text leading-relaxed pointer-events-none">
                          {analysis.agent_output?.blockScoreExplanation ??
                            "Block effectiveness reflects your training consistency and fitness adaptations over the past 4 weeks."}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-2xl sm:text-3xl font-bold tabular-nums text-teal">
                        {Math.round(analysis.block_effectiveness)}
                      </span>
                      <span className="text-xs sm:text-sm font-semibold text-teal">
                        /100
                      </span>
                    </div>
                    <p className="text-[9px] text-muted">
                      4-week effectiveness
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* Welcome Summary Card */}
          {analysis && (
            <div className="rounded-2xl border border-border bg-gradient-to-br from-bg-card to-bg-assistant px-4 sm:px-6 py-5 sm:py-6 shadow-sm">
              <div className="flex items-start gap-3 mb-4">
                <span className="text-2xl">👋</span>
                <div className="flex-1">
                  <h1 className="text-lg font-bold text-text mb-1">
                    {new Date().toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                  </h1>
                  <p className="text-xs text-muted">
                    {workout?.agent_output?.periodizationPhase && (
                      <span className="capitalize">
                        {workout.agent_output.periodizationPhase} Week •{" "}
                      </span>
                    )}
                    Readiness {analysis.readiness_score}/100
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* State: What biometrics are telling us */}
                {analysis.agent_output?.summary && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold tracking-[0.12em] uppercase text-teal">
                        📊 State
                      </span>
                    </div>
                    <p className="text-sm text-text leading-relaxed">
                      {analysis.agent_output.summary}
                    </p>
                  </div>
                )}

                {/* Action: Today's workout and why */}
                {workout && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold tracking-[0.12em] uppercase text-orange">
                        🎯 Today's Action
                      </span>
                    </div>
                    <p className="text-sm text-text leading-relaxed">
                      <span className="font-semibold capitalize">
                        {workout.sport}
                      </span>{" "}
                      for{" "}
                      <span className="font-semibold">
                        {workout.duration_min} minutes
                      </span>{" "}
                      at{" "}
                      <span className="font-semibold capitalize">
                        {workout.intensity}
                      </span>{" "}
                      intensity. {workout.rationale}
                    </p>
                  </div>
                )}

                {/* Big Picture: Block progress context */}
                {(analysis.agent_output?.trainingImplication ||
                  analysis.block_effectiveness != null) && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold tracking-[0.12em] uppercase text-text opacity-60">
                        🏔️ Big Picture
                      </span>
                    </div>
                    <div className="text-sm text-text leading-relaxed space-y-1">
                      {analysis.block_effectiveness != null && (
                        <p>
                          Your current 4-week training block is scoring{" "}
                          <span
                            className={`font-semibold ${
                              analysis.block_effectiveness >= 75
                                ? "text-teal"
                                : analysis.block_effectiveness >= 50
                                  ? "text-orange"
                                  : "text-peach"
                            }`}
                          >
                            {Math.round(analysis.block_effectiveness)}/100
                          </span>{" "}
                          effectiveness
                          {analysis.block_effectiveness >= 75
                            ? " — excellent progress toward your goals."
                            : analysis.block_effectiveness >= 50
                              ? " — solid progress with room to optimize."
                              : " — needs attention to get back on track."}
                        </p>
                      )}
                      {analysis.agent_output?.trainingImplication && (
                        <p>{analysis.agent_output.trainingImplication}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Recovery flags if any */}
                {analysis.agent_output?.flags &&
                  analysis.agent_output.flags.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                      {analysis.agent_output.flags.map((flag, i) => (
                        <span
                          key={i}
                          className="text-xs font-medium px-2.5 py-1 rounded-full bg-peach/10 text-peach border border-peach/20"
                        >
                          ⚠️ {flag}
                        </span>
                      ))}
                    </div>
                  )}
              </div>
            </div>
          )}

          {/* Workout Card */}
          <div
            className={`rounded-2xl border bg-bg-card p-4 sm:p-6 space-y-4 shadow-sm ${workout ? (INTENSITY_BORDERS[workout.intensity] ?? "border-border") : "border-border"}`}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold tracking-[0.15em] uppercase text-muted">
                {t("workout.title")}
              </h2>
              {workout?.agent_output?.periodizationPhase && (
                <span className="text-xs font-medium text-muted capitalize">
                  {workout.agent_output.periodizationPhase}
                </span>
              )}
            </div>
            {workout ? (
              <>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-baseline gap-2 sm:gap-3">
                    <span className="text-2xl sm:text-3xl font-bold text-teal capitalize">
                      {workout.sport}
                    </span>
                    <span className="text-orange font-semibold text-sm sm:text-base">
                      {workout.duration_min} min
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <WorkoutBadge
                      energySystem={workout.agent_output?.energySystem}
                      intensity={workout.intensity}
                    />
                    <PushButton workout={workout} />
                  </div>
                </div>
                <p className="text-text text-sm leading-relaxed">
                  {workout.rationale}
                </p>

                {/* Today's prescription context */}
                {analysis &&
                  (analysis.agent_output?.trainingImplication ||
                    analysis.agent_output?.recommendation) && (
                    <div className="space-y-1.5 pt-3 border-t border-border">
                      <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted">
                        Today's prescription context
                      </p>
                      <p className="text-sm text-text leading-relaxed">
                        {analysis.agent_output.trainingImplication ??
                          analysis.agent_output.recommendation}
                      </p>
                    </div>
                  )}

                {/* Training load badges */}
                {(() => {
                  const latestAct = activitiesData?.activities?.[0] ?? null;
                  const tsb =
                    latestAct?.ctl != null && latestAct?.atl != null
                      ? Math.round(latestAct.ctl - latestAct.atl)
                      : null;
                  return (
                    latestAct &&
                    (latestAct.atl != null || latestAct.ctl != null) && (
                      <div className="flex items-center gap-2 pt-3 border-t border-border flex-wrap">
                        {latestAct.atl != null && (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-orange/10 text-orange border border-orange/20">
                            ATL&nbsp;{Math.round(latestAct.atl)}
                          </span>
                        )}
                        {latestAct.ctl != null && (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-teal/10 text-teal border border-teal/20">
                            CTL&nbsp;{Math.round(latestAct.ctl)}
                          </span>
                        )}
                        {tsb !== null && (
                          <span
                            className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                              tsb >= 0
                                ? "bg-teal/10 text-teal border-teal/20"
                                : "bg-orange/10 text-orange border-orange/20"
                            }`}
                          >
                            TSB&nbsp;{tsb > 0 ? `+${tsb}` : tsb}
                          </span>
                        )}
                      </div>
                    )
                  );
                })()}

                {workout.agent_output?.phases &&
                workout.agent_output.phases.length > 0 ? (
                  <div className="pt-3 border-t border-border space-y-3">
                    <p className="text-xs font-semibold tracking-[0.15em] uppercase text-muted">
                      {t("workout.structure")}
                    </p>
                    <WorkoutChart
                      phases={workout.agent_output.phases}
                      sport={workout.agent_output.sport}
                    />
                    {workout.agent_output.workoutStructure && (
                      <pre className="text-sm text-text font-sans whitespace-pre-wrap leading-relaxed">
                        {workout.agent_output.workoutStructure}
                      </pre>
                    )}
                  </div>
                ) : workout.agent_output?.workoutStructure ? (
                  <div className="pt-3 border-t border-border space-y-2">
                    <p className="text-xs font-semibold tracking-[0.15em] uppercase text-muted">
                      {t("workout.structure")}
                    </p>
                    <pre className="text-sm text-text font-sans whitespace-pre-wrap leading-relaxed">
                      {workout.agent_output.workoutStructure}
                    </pre>
                  </div>
                ) : workout.agent_output?.structure?.phases?.length > 0 ? (
                  <div className="space-y-3 pt-3 border-t border-border">
                    <p className="text-xs font-semibold tracking-[0.15em] uppercase text-muted">
                      {t("workout.structure")}
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
                {analyzingToday ? t("workout.generating") : t("workout.noData")}
              </p>
            )}
          </div>

          {/* Sport Progress Card */}
          {progressData?.sportProgress &&
            progressData.sportProgress.length > 0 && (
              <div className="rounded-2xl border border-border bg-bg-card p-4 sm:p-6 space-y-4 shadow-sm">
                <h2 className="text-xs font-semibold tracking-[0.15em] uppercase text-muted">
                  {t("progress.title")}
                </h2>
                <div className="space-y-3">
                  {progressData.sportProgress.map((sp) => (
                    <div key={sp.sport} className="flex items-start gap-3">
                      <span className="text-xl shrink-0 mt-0.5">
                        {SPORT_ICONS[sp.sport] ?? "🏅"}
                      </span>
                      <div>
                        <p className="text-text text-xs font-semibold capitalize mb-0.5">
                          {sp.sport}
                        </p>
                        <p className="text-muted text-sm leading-relaxed">
                          {sp.summary}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>
      </div>
    </>
  );
}
