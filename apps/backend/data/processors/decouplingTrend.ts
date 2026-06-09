/**
 * Aerobic Decoupling Trend Analysis
 * Tracks efficiency degradation over time for endurance sessions.
 */

import type { Activity } from "../../types.js";

export interface DecouplingTrendPoint {
  date: string;
  decoupling: number;
  sport: string;
  duration: number; // hours
  tss: number;
  activityName: string;
}

export interface WeeklyDecouplingAverage {
  weekStartDate: string;
  avgDecoupling: number;
  sessionCount: number;
  sport: string;
}

/**
 * Extract decoupling data points from activities.
 * Only includes endurance sessions (>60 min) with decoupling data.
 */
export function extractDecouplingData(
  activities: Activity[],
): DecouplingTrendPoint[] {
  return activities
    .filter(
      (a) =>
        a.decoupling != null &&
        a.decoupling >= 0 &&
        a.durationSecs != null &&
        a.durationSecs >= 3600 && // At least 1 hour
        (a.sport === "bike" || a.sport === "run"), // Only aerobic sports
    )
    .map((a) => ({
      date: a.activityDate,
      decoupling: Math.round(a.decoupling! * 10) / 10, // 1 decimal
      sport: a.sport!,
      duration: Math.round((a.durationSecs! / 3600) * 10) / 10,
      tss: a.tss ?? 0,
      activityName: a.name ?? "Workout",
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/**
 * Calculate weekly averages of decoupling.
 * Groups by week and sport.
 */
export function calculateWeeklyDecoupling(
  points: DecouplingTrendPoint[],
): WeeklyDecouplingAverage[] {
  if (points.length === 0) return [];

  // Group by week start date and sport
  const weeklyMap = new Map<string, { total: number; count: number }>();

  points.forEach((p) => {
    const date = new Date(p.date);
    // Get Monday of that week
    const dayOfWeek = date.getDay();
    const monday = new Date(date);
    monday.setDate(date.getDate() - ((dayOfWeek + 6) % 7));
    const weekKey = `${monday.toISOString().slice(0, 10)}_${p.sport}`;

    const existing = weeklyMap.get(weekKey) || { total: 0, count: 0 };
    existing.total += p.decoupling;
    existing.count += 1;
    weeklyMap.set(weekKey, existing);
  });

  // Convert to array
  return Array.from(weeklyMap.entries())
    .map(([key, data]) => {
      const [weekStartDate, sport] = key.split("_");
      return {
        weekStartDate,
        avgDecoupling: Math.round((data.total / data.count) * 10) / 10,
        sessionCount: data.count,
        sport,
      };
    })
    .sort(
      (a, b) =>
        new Date(a.weekStartDate).getTime() -
        new Date(b.weekStartDate).getTime(),
    );
}
