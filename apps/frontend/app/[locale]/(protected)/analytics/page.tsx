"use client";

import { useState } from "react";
import { ATHLETE_ID } from "@/lib/api";
import AnalyticsSummaryStrip from "@/components/AnalyticsSummaryStrip";
import UnifiedBioMetricTimeline from "@/components/UnifiedBioMetricTimeline";
import ACWRCorridorChart from "@/components/ACWRCorridorChart";
import HRVBaselineChart from "@/components/HRVBaselineChart";
import ReadinessPerformanceScatter from "@/components/ReadinessPerformanceScatter";
import AerobicDecouplingChart from "@/components/AerobicDecouplingChart";
import BlockEffectivenessTrend from "@/components/BlockEffectivenessTrend";
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

        {/* [1.6] BLOCK EFFECTIVENESS TREND - Current Training Block */}
        <div className="rounded-2xl border border-border bg-bg-card px-4 sm:px-6 py-4 sm:py-5 shadow-sm">
          <BlockEffectivenessTrend athleteId={ATHLETE_ID} />
        </div>

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

        {/* [3] ADVANCED ANALYTICS - 2x2 GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ACWR Corridor */}
          <div className="rounded-2xl bg-bg-card px-4 sm:px-6 py-4 sm:py-5 shadow-sm">
            <h2 className="text-xs font-semibold tracking-[0.15em] uppercase text-muted mb-4">
              ACWR Injury Risk Corridor
            </h2>
            <p className="text-xs text-muted mb-4 leading-relaxed">
              Acute-to-Chronic Workload Ratio tracks injury risk. Green zone
              (0.8-1.3) = optimal training stimulus. Red zone (&gt;1.5) = high
              injury risk — time to reduce volume.
            </p>
            <ACWRCorridorChart athleteId={ATHLETE_ID} days={timeframe} />
          </div>

          {/* HRV Baseline */}
          <div className="rounded-2xl border border-border bg-bg-card px-4 sm:px-6 py-4 sm:py-5 shadow-sm">
            <h2 className="text-xs font-semibold tracking-[0.15em] uppercase text-muted mb-4">
              HRV Baseline vs. 7-Day Average
            </h2>
            <p className="text-xs text-muted mb-4 leading-relaxed">
              30-day baseline band (orange) shows your normal HRV range. When
              the 7-day average (teal line) drops below the lower bound, it
              signals a deep recovery deficit.
            </p>
            <HRVBaselineChart
              athleteId={ATHLETE_ID}
              days={Math.min(timeframe, 60)}
            />
          </div>

          {/* Readiness vs Performance Scatter */}
          <div className="rounded-2xl border border-border bg-bg-card px-4 sm:px-6 py-4 sm:py-5 shadow-sm">
            <h2 className="text-xs font-semibold tracking-[0.15em] uppercase text-muted mb-4">
              Readiness vs. Performance Analysis
            </h2>
            <p className="text-xs text-muted mb-4 leading-relaxed">
              Each workout plotted by morning readiness (X-axis) and performance
              metric (Y-axis). Clusters reveal your "sweet spots" where you
              perform best at certain readiness levels.
            </p>
            <ReadinessPerformanceScatter
              athleteId={ATHLETE_ID}
              days={timeframe}
            />
          </div>

          {/* Aerobic Decoupling Trend */}
          <div className="rounded-2xl border border-border bg-bg-card px-4 sm:px-6 py-4 sm:py-5 shadow-sm">
            <h2 className="text-xs font-semibold tracking-[0.15em] uppercase text-muted mb-4">
              Aerobic Decoupling Trend
            </h2>
            <p className="text-xs text-muted mb-4 leading-relaxed">
              Weekly average of Pw:Hr / Pa:Hr drift in endurance sessions. Below
              5% = efficient aerobic engine. Above 5% = prioritize low-intensity
              volume over high-intensity work.
            </p>
            <AerobicDecouplingChart athleteId={ATHLETE_ID} days={timeframe} />
          </div>
        </div>
      </div>
    </div>
  );
}
