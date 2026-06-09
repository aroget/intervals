"use client";

import { useState, useEffect } from "react";

interface SummaryMetrics {
  avgReadiness: number;
  currentReadiness: number;
  currentTsb: number;
  currentCtl: number;
  currentAtl: number;
  tsbStatus: string;
  blockScore: number;
  complianceRate: number;
  workoutsCompleted: number;
  workoutsPrescribed: number;
}

export default function AnalyticsSummaryStrip({
  athleteId,
  days = 30,
}: {
  athleteId: string;
  days?: number;
}) {
  const [metrics, setMetrics] = useState<SummaryMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/analysis/${athleteId}/summary-metrics?days=${days}`,
    )
      .then((r) => r.json())
      .then((data) => {
        setMetrics(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [athleteId, days]);

  if (loading || !metrics) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="bg-bg-card border border-border rounded-lg p-4 animate-pulse"
          >
            <div className="h-4 bg-muted/20 rounded w-2/3 mb-3" />
            <div className="h-8 bg-muted/20 rounded w-full" />
          </div>
        ))}
      </div>
    );
  }

  const getReadinessColor = (score: number) => {
    if (score >= 80) return "text-teal";
    if (score >= 55) return "text-orange";
    return "text-peach";
  };

  const getTsbColor = (tsb: number) => {
    if (tsb > 5) return "text-teal";
    if (tsb >= -30 && tsb <= -10) return "text-orange";
    if (tsb < -30) return "text-peach";
    return "text-text";
  };

  const getBlockScoreColor = (score: number) => {
    if (score >= 70) return "text-teal";
    if (score >= 50) return "text-orange";
    return "text-peach";
  };

  const getComplianceColor = (rate: number) => {
    if (rate >= 85) return "text-teal";
    if (rate >= 70) return "text-orange";
    return "text-peach";
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      {/* Avg Readiness */}
      <div className="bg-bg-card border border-border rounded-lg p-4">
        <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted mb-2">
          Avg Readiness
        </p>
        <p
          className={`text-2xl font-bold tabular-nums ${getReadinessColor(metrics.avgReadiness)}`}
        >
          {metrics.avgReadiness}{" "}
          <span className="text-sm text-muted">/ 100</span>
        </p>
      </div>

      {/* Current TSB */}
      <div className="bg-bg-card border border-border rounded-lg p-4">
        <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted mb-2">
          Current TSB
        </p>
        <p
          className={`text-2xl font-bold tabular-nums ${getTsbColor(metrics.currentTsb)}`}
        >
          {metrics.currentTsb > 0 ? "+" : ""}
          {metrics.currentTsb}
        </p>
        <p className="text-[10px] text-muted mt-1">{metrics.tsbStatus}</p>
      </div>

      {/* Block Score */}
      <div className="bg-bg-card border border-border rounded-lg p-4">
        <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted mb-2">
          Block Score
        </p>
        <p
          className={`text-2xl font-bold tabular-nums ${getBlockScoreColor(metrics.blockScore)}`}
        >
          {metrics.blockScore} <span className="text-sm text-muted">/ 100</span>
        </p>
      </div>

      {/* Total Compliance */}
      <div className="bg-bg-card border border-border rounded-lg p-4">
        <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted mb-2">
          Total Compliance
        </p>
        <p
          className={`text-2xl font-bold tabular-nums ${getComplianceColor(metrics.complianceRate)}`}
        >
          {metrics.complianceRate}%
        </p>
      </div>

      {/* Workouts Done */}
      <div className="bg-bg-card border border-border rounded-lg p-4">
        <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted mb-2">
          Workouts Done
        </p>
        <p className="text-2xl font-bold tabular-nums text-text">
          {metrics.workoutsCompleted}{" "}
          <span className="text-sm text-muted">
            / {metrics.workoutsPrescribed}
          </span>
        </p>
        <p className="text-[10px] text-muted mt-1">Complete</p>
      </div>
    </div>
  );
}
