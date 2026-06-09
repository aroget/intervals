"use client";

import { useState, useEffect } from "react";
import { API_URL } from "@/lib/api";

interface Day {
  date: string;
  dayOfWeek: string;
  workout: any | null;
  activity: any | null;
  completed: boolean;
}

interface WorkoutDetailModalProps {
  day: Day;
  athleteId: string;
  onClose: () => void;
}

export default function WorkoutDetailModal({
  day,
  athleteId,
  onClose,
}: WorkoutDetailModalProps) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(true);

  useEffect(() => {
    if (day.activity?.id) {
      setLoadingAnalysis(true);
      fetch(
        `${API_URL}/analysis/${athleteId}/activity-analysis/${day.activity.id}`,
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-bg-card rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto border-2 border-teal shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-gradient-to-r from-teal/10 to-transparent border-b border-border p-5 z-10">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-teal">{dateLabel}</h2>
              <p className="text-sm text-muted mt-1">
                {day.workout &&
                  `${day.workout.sport} • ${day.workout.intensity}`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-muted hover:text-text transition-colors p-1"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-5 space-y-6">
          {/* Prescribed Workout */}
          {day.workout && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-text uppercase tracking-wider">
                Prescribed Workout
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-bg rounded-lg p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                    Duration
                  </p>
                  <p className="text-lg font-bold text-teal mt-1">
                    {day.workout.duration_min} min
                  </p>
                </div>
                <div className="bg-bg rounded-lg p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                    Sport
                  </p>
                  <p className="text-lg font-bold text-teal mt-1 capitalize">
                    {day.workout.sport}
                  </p>
                </div>
              </div>
              {day.workout.rationale && (
                <div className="bg-bg rounded-lg p-4">
                  <p className="text-xs text-muted leading-relaxed">
                    {day.workout.rationale}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Actual Activity */}
          {day.activity && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-text uppercase tracking-wider">
                Actual Activity
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                {day.activity.avg_hr && (
                  <div className="bg-bg rounded-lg p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                      Avg HR
                    </p>
                    <p className="text-lg font-bold text-teal mt-1">
                      {Math.round(day.activity.avg_hr)} bpm
                    </p>
                  </div>
                )}
                {day.activity.avg_power && (
                  <div className="bg-bg rounded-lg p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                      Avg Power
                    </p>
                    <p className="text-lg font-bold text-teal mt-1">
                      {Math.round(day.activity.avg_power)} W
                    </p>
                  </div>
                )}
                {day.activity.rpe && (
                  <div className="bg-bg rounded-lg p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                      RPE
                    </p>
                    <p className="text-lg font-bold text-teal mt-1">
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
