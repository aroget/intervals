/**
 * HRV Baseline Analysis
 * Calculates 30-day baseline band and 7-day rolling average to detect recovery deficits.
 */

import type { WellnessLog } from "../../types.js";

export interface HRVBaselinePoint {
  date: string;
  hrv: number | null;
  sevenDayAvg: number | null;
  baselineMean: number | null;
  baselineUpper: number | null; // mean + stdDev
  baselineLower: number | null; // mean - stdDev
  isDeficit: boolean; // 7-day avg below baseline lower bound
}

/**
 * Calculate rolling average for a window.
 */
function calculateRollingAverage(
  values: Array<{ date: string; hrv: number | null }>,
  index: number,
  windowDays: number,
): number | null {
  const endIdx = index + 1;
  const startIdx = Math.max(0, endIdx - windowDays);
  const window = values
    .slice(startIdx, endIdx)
    .map((v) => v.hrv)
    .filter((v): v is number => v != null);

  if (window.length === 0) return null;

  return Math.round(window.reduce((sum, v) => sum + v, 0) / window.length);
}

/**
 * Calculate baseline stats (mean and stdDev) for a window.
 */
function calculateBaselineStats(
  values: number[],
): { mean: number; stdDev: number } | null {
  if (values.length < 7) return null; // Need at least 7 days

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;

  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;

  const stdDev = Math.sqrt(variance);

  return { mean, stdDev };
}

/**
 * Generate HRV baseline time series with 7-day rolling avg and 30-day baseline band.
 */
export function calculateHRVBaseline(
  wellness: WellnessLog[],
): HRVBaselinePoint[] {
  if (wellness.length === 0) return [];

  // Sort by date ascending
  const sorted = [...wellness].sort(
    (a, b) => new Date(a.logDate).getTime() - new Date(b.logDate).getTime(),
  );

  // Prepare data array with dates and HRV values
  const data = sorted.map((w) => ({
    date: w.logDate,
    hrv: w.hrv ?? null,
  }));

  return data.map((point, index) => {
    // 7-day rolling average (looking back)
    const sevenDayAvg = calculateRollingAverage(data, index, 7);

    // 30-day baseline (looking back 30 days)
    const endIdx = index + 1;
    const startIdx = Math.max(0, endIdx - 30);
    const baselineWindow = data
      .slice(startIdx, endIdx)
      .map((v) => v.hrv)
      .filter((v): v is number => v != null);

    const baseline = calculateBaselineStats(baselineWindow);

    let baselineMean: number | null = null;
    let baselineUpper: number | null = null;
    let baselineLower: number | null = null;

    if (baseline) {
      baselineMean = Math.round(baseline.mean);
      baselineUpper = Math.round(baseline.mean + baseline.stdDev);
      baselineLower = Math.round(baseline.mean - baseline.stdDev);
    }

    // Check if 7-day avg is below baseline lower bound (deficit)
    const isDeficit =
      sevenDayAvg != null &&
      baselineLower != null &&
      sevenDayAvg < baselineLower;

    return {
      date: point.date,
      hrv: point.hrv,
      sevenDayAvg,
      baselineMean,
      baselineUpper,
      baselineLower,
      isDeficit,
    };
  });
}
