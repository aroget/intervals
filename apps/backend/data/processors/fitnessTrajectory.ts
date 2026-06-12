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
  const weeklyGains: Record<string, number> = {
    base: 3,
    build: 5,
    peak: 2,
    recovery: -3,
  };

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

  for (let weekNum = 0; weekNum < 4; weekNum++) {
    const weekStart = new Date(blockStart);
    weekStart.setDate(blockStart.getDate() + weekNum * 7);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);

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
