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
 * Uses hrvScore (0-10 scale) for trend detection.
 */
export function computeHrvTrend(logs: WellnessLog[]): {
  trend: "rising" | "declining" | "stable";
} {
  const currentAvg = rollingAvg(logs, "hrvScore", 3);
  const historicalAvg = rollingAvg(logs, "hrvScore", 14);

  if (currentAvg === null || historicalAvg === null) {
    return { trend: "stable" };
  }

  // If 3-day average deviates from baseline by more than ~5%
  const threshold = historicalAvg * 0.05;
  if (currentAvg > historicalAvg + threshold) return { trend: "rising" };
  if (currentAvg < historicalAvg - threshold) return { trend: "declining" };

  return { trend: "stable" };
}
