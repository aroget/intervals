/**
 * ACWR (Acute-to-Chronic Workload Ratio) Analysis
 * Calculates daily ACWR from ATL/CTL to identify injury risk zones.
 */

import type { Activity } from "../../types.js";

export interface ACWRDataPoint {
  date: string;
  acwr: number;
  atl: number;
  ctl: number;
  riskZone: "low" | "optimal" | "elevated" | "high";
}

/**
 * Calculate ACWR risk zone based on ratio.
 * - 0.8-1.3: Optimal (green)
 * - 1.3-1.5: Elevated (yellow)
 * - >1.5: High risk (red)
 * - <0.8: Low load (gray)
 */
function getRiskZone(acwr: number): "low" | "optimal" | "elevated" | "high" {
  if (acwr < 0.8) return "low";
  if (acwr <= 1.3) return "optimal";
  if (acwr <= 1.5) return "elevated";
  return "high";
}

/**
 * Generate ACWR time series from activities.
 */
export function calculateACWRTimeSeries(
  activities: Activity[],
): ACWRDataPoint[] {
  if (activities.length === 0) return [];

  // Sort by date ascending
  const sorted = [...activities].sort(
    (a, b) =>
      new Date(a.activityDate).getTime() - new Date(b.activityDate).getTime(),
  );

  return sorted
    .filter((a) => a.atl != null && a.ctl != null && a.ctl > 0)
    .map((a) => {
      const atl = a.atl!;
      const ctl = a.ctl!;
      const acwr = ctl > 0 ? atl / ctl : 0;

      return {
        date: a.activityDate,
        acwr: Math.round(acwr * 100) / 100, // Round to 2 decimals
        atl,
        ctl,
        riskZone: getRiskZone(acwr),
      };
    });
}
