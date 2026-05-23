import { WellnessLog } from "../../types.js";
import { computeHrvTrend, rollingAvg } from "./hrvTrend.js";
import { computeTrainingLoad } from "./trainingLoad.js";
import type { Activity, ComputedMetrics } from "../../types.js";
import { getCyclePosition, getDayOfWeek } from "./cycleTracker.js";

/**
 * Deterministic readiness score (0–100).
 * Kept strictly calculation-bound so downstream LLM execution remains grounded.
 *
 * Scoring weights:
 * HRV score / trend   40%
 * Acute Sleep score   30%
 * RHR delta           15%
 * TSB (Form Zone)     15%
 */
export function computeReadinessScore(
  logs: WellnessLog[],
  atl: number,
  tsb: number,
): number {
  let score = 50; // Neutral baseline floor

  // Ensure logs are sorted chronologically by date before grabbing the latest entry
  const sortedLogs = [...logs].sort((a, b) =>
    a.logDate.localeCompare(b.logDate),
  );
  const latestLog = sortedLogs.at(-1);
  if (!latestLog) return score;

  // — 1. HRV (40 pts) —————————————————————————————————————
  const { trend } = computeHrvTrend(sortedLogs);
  const latestHrvScore = latestLog.hrvScore;

  if (latestHrvScore !== null) {
    // Map absolute score (0–10) to -15 → +15 points
    score += (latestHrvScore / 10) * 30 - 15;
  }

  // Autonomic nervous system direction tracking
  if (trend === "rising") score += 10;
  else if (trend === "declining") score -= 10;

  // — 2. Sleep (30 pts) ————————————————————————————————————
  // Prioritizes acute recovery capacity (last night's sleep architecture)
  const latestSleep = latestLog.sleepScore;
  if (latestSleep !== null) {
    // Map absolute score (0–100) to -15 → +15 points
    score += (latestSleep / 100) * 30 - 15;
  }

  // — 3. RHR Delta (15 pts) ————————————————————————————————
  // Uses a 14-day window to prevent baseline drift tracking fatigue
  const rhrBaseline = rollingAvg(sortedLogs, "rhr", 14);
  const latestRhr = latestLog.rhr;

  if (rhrBaseline !== null && latestRhr !== null) {
    const delta = latestRhr - rhrBaseline;
    // Each bpm above baseline penalizes by 3 pts (maximum scale swing of 15 pts)
    score += Math.max(-15, Math.min(15, -delta * 3));
  }

  // — 4. TSB / Form Zones (15 pts) —————————————————————————
  // Non-linear mapping to reward optimal physiological stress blocks
  // over absolute linear values.
  let tsbScore = 0;

  if (tsb < -25) {
    tsbScore = -15; // Danger zone: high risk of structural/metabolic overreaching
  } else if (tsb >= -25 && tsb < -10) {
    tsbScore = 5; // Productive loading phase: systemic adaptation is happening
  } else if (tsb >= -10 && tsb <= 5) {
    tsbScore = 15; // Optimal window: balanced fitness and manageable load
  } else if (tsb > 5 && tsb <= 20) {
    tsbScore = 10; // Fresh / Transition phase
  } else if (tsb > 20) {
    tsbScore = 0; // Sluggish / Detraining zone
  }

  score += tsbScore;

  // — Final Constraints ————————————————————————————————————
  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Assembles all pre-computed metrics that agents consume.
 * This function is the single source of truth for numbers passed to LLMs.
 */
export function buildComputedMetrics(params: {
  logs: WellnessLog[]; // at least 14 days, sorted ascending by date
  activities: Activity[]; // at least 42 days for CTL accuracy
  cycleStartDate: string;
  weeklyMaxHours: Record<string, number>;
  today?: string;
}): ComputedMetrics {
  const today = params.today ?? new Date().toISOString().slice(0, 10);
  const { atl, ctl, tsb } = computeTrainingLoad(params.activities);
  const { avg: hrvSevenDayAvg, trend: hrvTrend } = computeHrvTrend(params.logs);
  const readinessScore = computeReadinessScore(params.logs, atl, tsb);
  const cycle = getCyclePosition(params.cycleStartDate, today);
  const dayName = getDayOfWeek(today);
  const todayMaxHours = params.weeklyMaxHours[dayName] ?? 1;

  return {
    readinessScore,
    hrvTrend,
    hrvSevenDayAvg,
    rhrSevenDayAvg: rollingAvg(params.logs, "rhr", 7),
    sleepScoreSevenDayAvg: rollingAvg(params.logs, "sleepScore", 7),
    atl: Math.round(atl * 10) / 10,
    ctl: Math.round(ctl * 10) / 10,
    tsb: Math.round(tsb * 10) / 10,
    cycleWeekNumber: cycle.weekNumber,
    cycleWeekType: cycle.weekType,
    todayMaxHours,
  };
}
