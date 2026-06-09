"use client";

import { useState } from "react";
import { ATHLETE_ID } from "@/lib/api";
import AnalyticsSummaryStrip from "@/components/AnalyticsSummaryStrip";
import UnifiedBioMetricTimeline from "@/components/UnifiedBioMetricTimeline";
import CompliancePanelA from "@/components/CompliancePanelA";
import PhysiologyPanelB from "@/components/PhysiologyPanelB";
import DailyActionFooter from "@/components/DailyActionFooter";
import TimeframeSelectorHorizontal from "@/components/TimeframeSelectorHorizontal";

const TIMEFRAMES = [
  { label: "7D", value: 7 },
  { label: "14D", value: 14 },
  { label: "30D", value: 30 },
  { label: "90D", value: 90 },
];

export default function AnalyticsPage() {
  const [timeframe, setTimeframe] = useState(30);

  return (
    <div className="min-h-screen bg-bg px-4 py-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header with Timeframe Selector */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-text">INTERVALS COACH</h1>
            <p className="text-xs text-muted mt-1">
              Performance Analytics & Training Intelligence
            </p>
          </div>
          <TimeframeSelectorHorizontal
            value={timeframe}
            onChange={setTimeframe}
            options={TIMEFRAMES}
          />
        </div>

        {/* [1] SYSTEMIC SUMMARY STRIP */}
        <AnalyticsSummaryStrip athleteId={ATHLETE_ID} days={timeframe} />

        {/* [1.5] DAILY ACTION FOOTER - Today's Workout */}
        <DailyActionFooter athleteId={ATHLETE_ID} />

        {/* [2] UNIFIED BIO-METRIC TIMELINE */}
        <div className="rounded-2xl border border-border bg-bg-card px-4 sm:px-6 py-4 sm:py-5 shadow-sm">
          <h2 className="text-xs font-semibold tracking-[0.15em] uppercase text-muted mb-4">
            Unified Bio-Metric Timeline
          </h2>
          <p className="text-xs text-muted mb-4 leading-relaxed">
            Daily readiness bars (left axis) overlaid with TSB form curve (solid
            orange line) and TSS workload volume (dotted line, right axis). The
            shaded area represents the optimal TSB training zone (-30 to -10).
          </p>
          <UnifiedBioMetricTimeline athleteId={ATHLETE_ID} days={timeframe} />
        </div>

        {/* [3] SPLIT DEEP-DIVE PANELS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* PANEL A: TARGET COMPLIANCE */}
          <div className="rounded-2xl border border-border bg-bg-card px-4 sm:px-6 py-4 sm:py-5 shadow-sm">
            <h2 className="text-xs font-semibold tracking-[0.15em] uppercase text-muted mb-4">
              Target Compliance
            </h2>
            <CompliancePanelA athleteId={ATHLETE_ID} />
          </div>

          {/* PANEL B: PHYSIOLOGICAL SPECTRUM RESPONSES */}
          <div className="rounded-2xl border border-border bg-bg-card px-4 sm:px-6 py-4 sm:py-5 shadow-sm">
            <h2 className="text-xs font-semibold tracking-[0.15em] uppercase text-muted mb-4">
              Physiological Spectrum Responses
            </h2>
            <PhysiologyPanelB athleteId={ATHLETE_ID} />
          </div>
        </div>
      </div>
    </div>
  );
}
