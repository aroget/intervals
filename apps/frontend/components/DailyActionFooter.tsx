"use client";

import { useState, useEffect } from "react";

interface TodayData {
  analysis: {
    readiness_score: number;
    agent_output: {
      readiness: string;
      summary: string;
      yesterdayImpact?: string;
      trainingImplication?: string;
      flags: string[];
      recommendation: string;
    };
  } | null;
  workout: {
    workout_date: string;
    sport: string;
    duration_min: number;
    intensity: string;
    structure: string;
    notes: string;
    rationale: string;
  } | null;
  activity?: {
    id: string;
    durationSecs: number;
    tss: number;
    distanceM?: number;
    avgHr?: number;
    avgPower?: number;
    rpe?: number;
  } | null;
}

// Today Detail Modal Component
function TodayDetailModal({
  data,
  athleteId,
  onClose,
}: {
  data: TodayData;
  athleteId: string;
  onClose: () => void;
}) {
  const [coachAnalysis, setCoachAnalysis] = useState<string | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(true);

  // Fetch coach analysis if activity exists
  useEffect(() => {
    if (data.activity?.id) {
      setLoadingAnalysis(true);
      fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/analysis/${athleteId}/activity-analysis/${data.activity.id}`,
      )
        .then((r) => r.json())
        .then((res) => setCoachAnalysis(res.analysis || null))
        .catch(() => setCoachAnalysis(null))
        .finally(() => setLoadingAnalysis(false));
    } else {
      setLoadingAnalysis(false);
    }
  }, [data.activity?.id, athleteId]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const getReadinessColor = (score: number) => {
    if (score >= 80) return "text-teal";
    if (score >= 55) return "text-orange";
    return "text-peach";
  };

  const getIntensityColor = (intensity: string) => {
    const lower = intensity.toLowerCase();
    if (lower.includes("recovery") || lower.includes("easy"))
      return "text-teal";
    if (lower.includes("threshold") || lower.includes("hard"))
      return "text-orangeBright";
    if (lower.includes("tempo") || lower.includes("moderate"))
      return "text-orange";
    return "text-text";
  };

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
            <h2 className="font-bold text-text text-lg">Today's Analysis</h2>
            <p className="text-muted text-xs mt-0.5">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
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
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-text uppercase tracking-wider">
              Prescribed Workout
            </h3>

            {data.workout ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-bg rounded-lg p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                      Duration
                    </p>
                    <p className="text-lg font-bold text-text mt-1">
                      {data.workout.duration_min} min
                    </p>
                  </div>
                  <div className="bg-bg rounded-lg p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                      Sport
                    </p>
                    <p className="text-lg font-bold text-text mt-1 capitalize">
                      {data.workout.sport}
                    </p>
                  </div>
                  <div className="bg-bg rounded-lg p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                      Intensity
                    </p>
                    <p
                      className={`text-lg font-bold mt-1 capitalize ${getIntensityColor(
                        data.workout.intensity,
                      )}`}
                    >
                      {data.workout.intensity}
                    </p>
                  </div>
                </div>

                {data.workout.rationale && (
                  <div className="bg-bg rounded-lg p-4">
                    <p className="text-sm text-text/70 leading-relaxed">
                      {data.workout.rationale}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-bg rounded-lg p-4">
                <p className="text-sm text-muted italic">
                  Rest day or workout not yet prescribed
                </p>
              </div>
            )}
          </div>

          {/* Actual Completion */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-teal uppercase tracking-wider flex items-center gap-2">
              <span>Actual Completion</span>
            </h3>

            {data.activity ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {data.activity.durationSecs && (
                  <div className="bg-bg rounded-lg p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                      Duration
                    </p>
                    <p className="text-lg font-bold text-teal mt-1">
                      {Math.round(data.activity.durationSecs / 60)} min
                    </p>
                  </div>
                )}
                {data.activity.tss && (
                  <div className="bg-bg rounded-lg p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                      TSS
                    </p>
                    <p className="text-lg font-bold text-teal mt-1">
                      {Math.round(data.activity.tss)}
                    </p>
                  </div>
                )}
                {data.activity.distanceM && (
                  <div className="bg-bg rounded-lg p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                      Distance
                    </p>
                    <p className="text-lg font-bold text-teal mt-1">
                      {data.activity.distanceM >= 1000
                        ? `${(data.activity.distanceM / 1000).toFixed(1)} km`
                        : `${Math.round(data.activity.distanceM)} m`}
                    </p>
                  </div>
                )}
                {data.activity.avgHr && (
                  <div className="bg-bg rounded-lg p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                      Avg HR
                    </p>
                    <p className="text-lg font-bold text-teal mt-1">
                      {Math.round(data.activity.avgHr)} bpm
                    </p>
                  </div>
                )}
                {data.activity.avgPower && (
                  <div className="bg-bg rounded-lg p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                      Avg Power
                    </p>
                    <p className="text-lg font-bold text-teal mt-1">
                      {Math.round(data.activity.avgPower)} W
                    </p>
                  </div>
                )}
                {data.activity.rpe && (
                  <div className="bg-bg rounded-lg p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                      RPE
                    </p>
                    <p className="text-lg font-bold text-teal mt-1">
                      {data.activity.rpe}/10
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-bg rounded-lg p-4">
                <p className="text-sm text-muted italic">
                  Workout not yet completed
                </p>
              </div>
            )}
          </div>

          {/* Coach Analysis */}
          <div className="space-y-3">
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
            ) : coachAnalysis ? (
              <div className="bg-bg rounded-lg p-4">
                <p className="text-sm text-text leading-relaxed">
                  {coachAnalysis}
                </p>
              </div>
            ) : (
              <div className="bg-bg rounded-lg p-4">
                <p className="text-sm text-muted italic">
                  {data.activity
                    ? "Analysis not yet available"
                    : "Complete today's workout to receive personalized feedback"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DailyActionFooter({
  athleteId,
}: {
  athleteId: string;
}) {
  const [data, setData] = useState<TodayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);

    // Fetch today's analysis, workout, and activity
    Promise.all([
      fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/analysis/${athleteId}/today`,
      ).then((r) => r.json()),
      fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/athlete/${athleteId}/activities?days=1`,
      ).then((r) => r.json()),
    ])
      .then(([todayData, activitiesData]) => {
        // Find today's activity if it exists
        const todayActivity = activitiesData.activities?.find(
          (a: any) => a.activityDate === today,
        );

        setData({
          analysis: todayData.analysis,
          workout: todayData.workout,
          activity: todayActivity || null,
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [athleteId]);

  if (loading || !data) {
    return (
      <div className="bg-bg-card border border-border rounded-lg p-4 animate-pulse">
        <div className="h-6 bg-muted/20 rounded w-3/4" />
      </div>
    );
  }

  const getIntensityColor = (intensity: string) => {
    const lower = intensity.toLowerCase();
    if (lower.includes("recovery") || lower.includes("easy"))
      return "text-teal";
    if (lower.includes("threshold") || lower.includes("hard"))
      return "text-orangeBright";
    if (lower.includes("tempo") || lower.includes("moderate"))
      return "text-orange";
    return "text-text";
  };

  const getIntensityDot = (intensity: string) => {
    const lower = intensity.toLowerCase();
    if (lower.includes("recovery") || lower.includes("easy")) return "bg-teal";
    if (lower.includes("threshold") || lower.includes("hard"))
      return "bg-orangeBright";
    if (lower.includes("tempo") || lower.includes("moderate"))
      return "bg-orange";
    return "bg-text";
  };

  const formatSport = (sport: string) => {
    return sport.charAt(0).toUpperCase() + sport.slice(1);
  };

  const getReadinessColor = (score: number) => {
    if (score >= 80) return "text-teal";
    if (score >= 55) return "text-orange";
    return "text-peach";
  };

  return (
    <>
      <div
        className={`bg-gradient-to-br from-bg-card to-bg-assistant border rounded-lg shadow-sm cursor-pointer transition-all ${
          data.workout
            ? "border-teal/30 hover:border-teal"
            : "border-border hover:border-teal/50"
        }`}
        onClick={() => setIsModalOpen(true)}
      >
        <div className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              <div className="flex items-center gap-2">
                {data.workout && (
                  <div
                    className={`w-2 h-2 rounded-full ${getIntensityDot(
                      data.workout.intensity,
                    )}`}
                  />
                )}
                <span className="text-xs font-semibold tracking-[0.12em] uppercase text-muted">
                  TODAY
                </span>
              </div>

              <div className="flex items-center gap-2 flex-1">
                {data.workout ? (
                  <>
                    <span className="text-sm font-semibold text-text">
                      {formatSport(data.workout.sport)}{" "}
                      {data.workout.duration_min} mins
                    </span>
                    <span className="text-sm text-muted">—</span>
                    <span
                      className={`text-sm font-semibold ${getIntensityColor(
                        data.workout.intensity,
                      )}`}
                    >
                      {data.workout.intensity}
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-muted">Rest day</span>
                )}
                {data.analysis && (
                  <span className="text-sm text-muted ml-2">
                    • Readiness{" "}
                    <span
                      className={`font-semibold ${getReadinessColor(
                        data.analysis.readiness_score,
                      )}`}
                    >
                      {data.analysis.readiness_score}/100
                    </span>
                  </span>
                )}
              </div>
            </div>

            <span className="text-xs text-muted whitespace-nowrap">
              View details →
            </span>
          </div>
        </div>
      </div>

      {/* Today Detail Modal */}
      {isModalOpen && (
        <TodayDetailModal
          data={data}
          athleteId={athleteId}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}
