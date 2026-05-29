"use client";

import ComplianceMetrics from "@/components/ComplianceMetrics";
import TrainingLoadHistory from "@/components/TrainingLoadHistory";

const ATHLETE_ID = process.env.NEXT_PUBLIC_ATHLETE_ID ?? "";

export default function AnalyticsPage() {
  return (
    <div className="min-h-screen bg-bg px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Compliance & Progress Metrics */}
        <div className="rounded-2xl border border-border bg-bg-card px-4 sm:px-6 py-4 sm:py-5 shadow-sm">
          <h2 className="text-xs font-semibold tracking-[0.15em] uppercase text-muted mb-4">
            Performance & Compliance
          </h2>
          <ComplianceMetrics athleteId={ATHLETE_ID} />
        </div>

        {/* Training Load History */}
        <div className="rounded-2xl border border-border bg-bg-card px-4 sm:px-6 py-4 sm:py-5 shadow-sm">
          <h2 className="text-xs font-semibold tracking-[0.15em] uppercase text-muted mb-4">
            Training Load Progression
          </h2>
          <TrainingLoadHistory athleteId={ATHLETE_ID} />
        </div>
      </div>
    </div>
  );
}
