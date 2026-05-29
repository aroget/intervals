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
 * Calculates incrementally week-by-week from baseline.
 */
export function getExpectedCtl(
  baselineCtl: number,
  weekInBlock: number,
  weekType: string,
): number {
  // Expected CTL gains per week by phase
  const weeklyGains: Record<string, number> = {
    base: 3, // +3 CTL
    build: 5, // +5 CTL
    peak: 2, // +2 CTL
    recovery: -3, // -3 CTL (de-load)
  };

  // Calculate cumulative gains up to this week
  const weekTypes = ["base", "build", "peak", "recovery"];
  let cumulativeGain = 0;

  for (let i = 0; i < weekInBlock; i++) {
    const type = weekTypes[i] ?? "base";
    cumulativeGain += weeklyGains[type] ?? 3;
  }

  return baselineCtl + cumulativeGain;
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

    const expectedCtl = getExpectedCtl(
      baselineCtl,
      weekNum + 1,
      weekTypes[weekNum],
    );
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
          a.activityDate < weekStart.toISOString().slice(0, 10),
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

export interface SessionData {
  sessionType: string; // key | endurance | recovery | rest
  completed: boolean;
  hadDeviationFlag?: boolean; // Was there a ⚠️ readiness warning?
  deviationSeverity?: "moderate" | "major"; // Severity of the warning
}

/**
 * Calculate context-aware weighted compliance.
 * Reduces penalties for sessions skipped when system warned about low readiness.
 */
function calculateWeightedCompliance(sessions: SessionData[]): number {
  const baseWeights: Record<string, number> = {
    key: 3.0, // High-quality sessions — critical for adaptation
    endurance: 2.0, // Base building — important for fitness
    recovery: 1.0, // Active recovery — aids adaptation
    rest: 0.5, // Planned rest — bonus if followed
  };

  let totalWeight = 0;
  let completedWeight = 0;

  for (const session of sessions) {
    let weight = baseWeights[session.sessionType] ?? 1.0;

    // Apply penalty reduction if session was skipped with a deviation warning
    // This rewards smart skips (following system advice) vs lazy skips
    if (!session.completed && session.hadDeviationFlag) {
      if (session.deviationSeverity === "major") {
        weight *= 0.25; // 75% penalty reduction - system strongly advised skip
      } else if (session.deviationSeverity === "moderate") {
        weight *= 0.5; // 50% penalty reduction - system suggested caution
      }
    }

    totalWeight += weight;
    if (session.completed) {
      completedWeight += weight;
    }
  }

  return totalWeight > 0 ? (completedWeight / totalWeight) * 100 : 0;
}

/**
 * Get overall block effectiveness score (0-100).
 * Based on: CTL gains, weighted compliance (prioritizing key sessions), no overtraining indicators.
 */
export function calculateBlockEffectiveness(
  blockStartCtl: number,
  blockEndCtl: number,
  complianceRate: number,
  overtrainingRiskDays: number,
  sessions?: SessionData[], // Optional: for weighted compliance calculation
): number {
  // Expected CTL gain over 4 weeks: ~15 points (3+5+5+2)
  const expectedGain = 15;
  const actualGain = blockEndCtl - blockStartCtl;
  const gainScore = Math.min(100, (actualGain / expectedGain) * 100);

  // Use weighted compliance if session data provided, otherwise use raw compliance rate
  const complianceScore =
    sessions && sessions.length > 0
      ? calculateWeightedCompliance(sessions)
      : complianceRate;

  // Overtraining penalty (1 day = -5 points)
  const overtrainingPenalty = Math.min(50, overtrainingRiskDays * 5);

  const raw = gainScore * 0.5 + complianceScore * 0.5 - overtrainingPenalty;
  return Math.max(0, Math.min(100, Math.round(raw)));
}
