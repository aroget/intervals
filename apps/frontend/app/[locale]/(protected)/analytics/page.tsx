"use client";

import { useState } from "react";
import ComplianceMetrics from "@/components/ComplianceMetrics";
import TrainingLoadHistoryNew from "@/components/TrainingLoadHistoryNew";
import RecoveryReadinessChartNew from "@/components/RecoveryReadinessChartNew";
import TrainingStressBalanceChartNew from "@/components/TrainingStressBalanceChartNew";
import BlockEffectivenessChartNew from "@/components/BlockEffectivenessChartNew";
import TimeframeSelector from "@/components/TimeframeSelector";

const ATHLETE_ID = process.env.NEXT_PUBLIC_ATHLETE_ID ?? "";

const READINESS_TIMEFRAMES = [
  { label: "7D", value: 7 },
  { label: "14D", value: 14 },
  { label: "30D", value: 30 },
  { label: "90D", value: 90 },
];

const TSB_TIMEFRAMES = [
  { label: "7D", value: 7 },
  { label: "14D", value: 14 },
  { label: "30D", value: 30 },
  { label: "60D", value: 60 },
  { label: "90D", value: 90 },
];

const LOAD_TIMEFRAMES = [
  { label: "4W", value: 4 },
  { label: "8W", value: 8 },
  { label: "12W", value: 12 },
  { label: "24W", value: 24 },
];

export default function AnalyticsPage() {
  const [readinessTimeframe, setReadinessTimeframe] = useState(30);
  const [tsbTimeframe, setTsbTimeframe] = useState(60);
  const [loadTimeframe, setLoadTimeframe] = useState(12);

  return (
    <div className="min-h-screen bg-bg px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Recovery & Readiness Chart */}
        <div className="rounded-2xl border border-border bg-bg-card px-4 sm:px-6 py-4 sm:py-5 shadow-sm">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xs font-semibold tracking-[0.15em] uppercase text-muted">
                Recovery & Readiness
              </h2>
              <p className="text-xs text-muted mt-2 leading-relaxed">
                Daily readiness score layered with training stress (TSS) to show
                how your biometrics respond to workout load. Green indicates
                high readiness for hard sessions, while red suggests
                prioritizing recovery.
              </p>
            </div>
            <TimeframeSelector
              value={readinessTimeframe}
              onChange={setReadinessTimeframe}
              options={READINESS_TIMEFRAMES}
            />
          </div>
          <RecoveryReadinessChartNew
            athleteId={ATHLETE_ID}
            days={readinessTimeframe}
          />
        </div>

        {/* Training Stress Balance Chart */}
        <div className="rounded-2xl border border-border bg-bg-card px-4 sm:px-6 py-4 sm:py-5 shadow-sm">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xs font-semibold tracking-[0.15em] uppercase text-muted">
                Training Stress Balance (TSB)
              </h2>
              <p className="text-xs text-muted mt-2 leading-relaxed">
                Long-term fitness (CTL) vs. short-term fatigue (ATL). Form (TSB)
                is calculated as Fitness - Fatigue. Optimal training occurs when
                TSB is slightly negative (-10 to -30), indicating productive
                stress without overtraining.
              </p>
            </div>
            <TimeframeSelector
              value={tsbTimeframe}
              onChange={setTsbTimeframe}
              options={TSB_TIMEFRAMES}
            />
          </div>
          <TrainingStressBalanceChartNew
            athleteId={ATHLETE_ID}
            days={tsbTimeframe}
          />
        </div>

        {/* Block Effectiveness Chart */}
        <div className="rounded-2xl border border-border bg-bg-card px-4 sm:px-6 py-4 sm:py-5 shadow-sm">
          <h2 className="text-xs font-semibold tracking-[0.15em] uppercase text-muted mb-4">
            Current Block Effectiveness
          </h2>
          <p className="text-xs text-muted mb-4 leading-relaxed">
            Performance analysis of your current 4-week training block. Shows
            fitness gains (CTL), total training stress, intensity distribution,
            and compliance rate to help evaluate if the block is delivering
            results.
          </p>
          <BlockEffectivenessChartNew athleteId={ATHLETE_ID} />
        </div>

        {/* Compliance & Progress Metrics */}
        <div className="rounded-2xl border border-border bg-bg-card px-4 sm:px-6 py-4 sm:py-5 shadow-sm">
          <h2 className="text-xs font-semibold tracking-[0.15em] uppercase text-muted mb-4">
            Performance & Compliance
          </h2>
          <ComplianceMetrics athleteId={ATHLETE_ID} />
        </div>

        {/* Training Load History */}
        <div className="rounded-2xl border border-border bg-bg-card px-4 sm:px-6 py-4 sm:py-5 shadow-sm">
          <div className="flex items-start justify-between gap-4 mb-4">
            <h2 className="text-xs font-semibold tracking-[0.15em] uppercase text-muted">
              Training Load Progression
            </h2>
            <TimeframeSelector
              value={loadTimeframe}
              onChange={setLoadTimeframe}
              options={LOAD_TIMEFRAMES}
            />
          </div>
          <TrainingLoadHistoryNew
            athleteId={ATHLETE_ID}
            weeks={loadTimeframe}
          />
        </div>
      </div>
    </div>
  );
}
