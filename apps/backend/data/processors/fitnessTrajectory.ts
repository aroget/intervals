/**
 * Tracks CTL (fitness) progression and compares against expected trajectory.
 * Flags when athlete is falling behind or ahead of plan.
 */

import type { Activity } from "../../types.js";

export interface FitnessCheckpoint {
  date: string;
  weekInBlock: number;
  weekType: "base" | "build" | "peak" | "recovery";
  expectedCtl: number;
  actualCtl: number;
  deviation: number;
  deviationPct: number;
  trend: "ahead" | "on_track" | "behind" | "stalled";
  note: string;
}

/**
 * Calculate expected CTL progression for a training block.
 * Assumes linear CTL growth during build weeks, maintenance during peak, recovery in week 4.
 */
export function getExpectedCtl(
  baselineCtl: number,
  weekInBlock: number,
  weekType: string,
): number {
  // Expected CTL gains per week by phase
  const weeklyGains: Record<string, number> = {
    base: 3, // Steady aerobic building
    build: 5, // Aggressive loading
    peak: 2, // Maintain with quality
    recovery: -3, // Controlled de-load
  };

  const gain = weeklyGains[weekType] ?? 3;
  return baselineCtl + gain * weekInBlock;
}

/**
 * Analyze fitness trajectory for current training block.
 */
export function analyzeFitnessTrajectory(
  blockStartDate: string,
  baselineCtl: number,
  activities: Activity[],
): FitnessCheckpoint[] {
  const weekTypes: Array<"base" | "build" | "peak" | "recovery"> = [
    "base",
    "build",
    "peak",
    "recovery",
  ];

  const checkpoints: FitnessCheckpoint[] = [];
  const blockStart = new Date(blockStartDate);

  // Get CTL at end of each week
  for (let weekNum = 0; weekNum < 4; weekNum++) {
    const weekStart = new Date(blockStart);
    weekStart.setDate(blockStart.getDate() + weekNum * 7);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);

    // Find last activity of the week with CTL data
    const weekActivities = activities.filter(
      (a) =>
        a.activityDate >= weekStart.toISOString().slice(0, 10) &&
        a.activityDate <= weekEndStr,
    );

    const lastActivity = weekActivities[weekActivities.length - 1];
    const actualCtl = lastActivity?.ctl ?? baselineCtl;

    const expectedCtl = getExpectedCtl(baselineCtl, weekNum + 1, weekTypes[weekNum]);
    const deviation = actualCtl - expectedCtl;
    const deviationPct =
      expectedCtl > 0 ? Math.round((deviation / expectedCtl) * 100) : 0;

    // Determine trend
    let trend: "ahead" | "on_track" | "behind" | "stalled" = "on_track";
    let note = "";

    if (deviationPct > 10) {
      trend = "ahead";
      note = `CTL ${Math.abs(deviationPct)}% ahead of plan — excellent progression.`;
    } else if (deviationPct < -10) {
      trend = "behind";
      note = `CTL ${Math.abs(deviationPct)}% below expected — fitness gains lagging.`;
    } else if (Math.abs(deviation) < 2) {
      trend = "on_track";
      note = "CTL progression on target.";
    }

    // Check for stalled fitness (CTL not increasing in build weeks)
    if (
      weekNum > 0 &&
      (weekTypes[weekNum] === "build" || weekTypes[weekNum] === "peak")
    ) {
      const prevWeekActivities = activities.filter(
        (a) =>
          a.activityDate >=
            new Date(weekStart.getTime() - 7 * 86_400_000)
              .toISOString()
              .slice(0, 10) &&
          a.activityDate <
            weekStart.toISOString().slice(0, 10),
      );
      const prevCtl =
        prevWeekActivities[prevWeekActivities.length - 1]?.ctl ?? baselineCtl;

      if (actualCtl <= prevCtl + 1) {
        trend = "stalled";
        note = `CTL stalled at ${Math.round(actualCtl)} — insufficient training stimulus during ${weekTypes[weekNum]} week.`;
      }
    }

    checkpoints.push({
      date: weekEndStr,
      weekInBlock: weekNum + 1,
      weekType: weekTypes[weekNum],
      expectedCtl: Math.round(expectedCtl),
      actualCtl: Math.round(actualCtl),
      deviation: Math.round(deviation),
      deviationPct,
      trend,
      note,
    });
  }

  return checkpoints;
}

/**
 * Get overall block effectiveness score (0-100).
 * Based on: CTL gains, compliance, no overtraining indicators.
 */
export function calculateBlockEffectiveness(
  blockStartCtl: number,
  blockEndCtl: number,
  complianceRate: number,
  overtrainingRiskDays: number,
): number {
  // Expected CTL gain over 4 weeks: ~15 points (3+5+5+2)
  const expectedGain = 15;
  const actualGain = blockEndCtl - blockStartCtl;
  const gainScore = Math.min(100, (actualGain / expectedGain) * 100);

  // Compliance penalty
  const complianceScore = complianceRate;

  // Overtraining penalty (1 day = -5 points)
  const overtrainingPenalty = Math.min(50, overtrainingRiskDays * 5);

  const raw = (gainScore * 0.5 + complianceScore * 0.5) - overtrainingPenalty;
  return Math.max(0, Math.min(100, Math.round(raw)));
}
