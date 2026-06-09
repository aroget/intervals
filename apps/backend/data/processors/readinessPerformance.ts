/**
 * Readiness vs Performance Correlation Analysis
 * Maps morning readiness scores to actual workout performance.
 */

import type { Activity } from "../../types.js";

export interface ReadinessPerformancePoint {
  date: string;
  readinessScore: number;
  performanceMetric: number; // % of target or efficiency metric
  sport: string;
  activityName: string;
  decoupling: number | null;
  intensityFactor: number | null;
  tss: number | null;
}

/**
 * Calculate performance metric from activity.
 * For now, we use:
 * - Intensity Factor as a proxy for "% of target" (0-100 scale)
 * - Lower decoupling = better performance
 */
function calculatePerformanceMetric(activity: Activity): number {
  // Primary: Use intensity factor as % of threshold (IF * 100)
  if (activity.intensityFactor != null && activity.intensityFactor > 0) {
    return Math.round(activity.intensityFactor * 100);
  }

  // Fallback: Use inverse decoupling as performance proxy
  // (lower decoupling = better performance)
  if (activity.decoupling != null && activity.decoupling >= 0) {
    // Cap at 20% decoupling, invert to 0-100 scale
    const cappedDecoupling = Math.min(activity.decoupling, 20);
    return Math.round((1 - cappedDecoupling / 20) * 100);
  }

  // No valid metric
  return 0;
}

/**
 * Map activities with readiness scores to performance points.
 */
export function analyzeReadinessPerformance(
  activities: Activity[],
  readinessMap: Map<string, number>,
): ReadinessPerformancePoint[] {
  return activities
    .filter((a) => {
      // Only include activities with readiness score and valid performance data
      return (
        readinessMap.has(a.activityDate) &&
        (a.intensityFactor != null || a.decoupling != null) &&
        a.tss != null &&
        a.tss > 20 // Exclude very easy/short sessions
      );
    })
    .map((a) => ({
      date: a.activityDate,
      readinessScore: readinessMap.get(a.activityDate)!,
      performanceMetric: calculatePerformanceMetric(a),
      sport: a.sport ?? "other",
      activityName: a.name ?? "Workout",
      decoupling: a.decoupling ?? null,
      intensityFactor: a.intensityFactor ?? null,
      tss: a.tss ?? null,
    }))
    .filter((p) => p.performanceMetric > 0); // Exclude points with no metric
}
