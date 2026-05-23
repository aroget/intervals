import { WellnessLog } from "../../types.js";

/**
 * Computes a rolling average for a specific numeric key inside the wellness logs.
 */
export function rollingAvg(
  logs: WellnessLog[],
  key: keyof WellnessLog,
  days: number,
): number | null {
  const slice = logs.slice(-days);
  const values = slice
    .map((log) => log[key])
    .filter((val): val is number => typeof val === "number" && !isNaN(val));

  if (values.length === 0) return null;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
}

/**
 * Computes the HRV trend vector based on historical context.
 */
export function computeHrvTrend(logs: WellnessLog[]): {
  avg: number | null;
  trend: "rising" | "declining" | "stable";
} {
  const currentAvg = rollingAvg(logs, "hrvScore", 3);
  const historicalAvg = rollingAvg(logs, "hrvScore", 14);

  if (currentAvg === null || historicalAvg === null) {
    return { avg: historicalAvg, trend: "stable" };
  }

  // If 3-day average deviates from baseline by more than ~5%
  const threshold = historicalAvg * 0.05;
  if (currentAvg > historicalAvg + threshold)
    return { avg: historicalAvg, trend: "rising" };
  if (currentAvg < historicalAvg - threshold)
    return { avg: historicalAvg, trend: "declining" };

  return { avg: historicalAvg, trend: "stable" };
}
