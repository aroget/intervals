/**
 * Readiness prediction - predicts tomorrow's readiness based on current training load
 */
import type { Activity, Wellness, ComputedMetrics } from "../../types.js";

export interface ReadinessPrediction {
  tomorrowReadiness: "high" | "moderate" | "low";
  confidence: number;
  reasoning: string[];
  suggestedAction?: string;
}

/**
 * Predicts tomorrow's readiness score based on current metrics and trends
 */
export function predictTomorrowReadiness(
  metrics: ComputedMetrics,
  recentActivities: Activity[],
  recentWellness: Wellness[],
): ReadinessPrediction {
  const reasoning: string[] = [];
  let score = 50; // Base score

  // Factor 1: Current TSB trend
  if (metrics.tsb < -30) {
    score -= 15;
    reasoning.push("High fatigue accumulation (TSB < -30)");
  } else if (metrics.tsb < -15) {
    score -= 8;
    reasoning.push("Moderate fatigue (TSB -15 to -30)");
  } else if (metrics.tsb > 10) {
    score += 10;
    reasoning.push("Well-rested (positive TSB)");
  }

  // Factor 2: Recent training load (last 3 days)
  const last3DaysTss =
    recentActivities.slice(0, 3).reduce((sum, a) => sum + (a.tss ?? 0), 0) / 3;
  const avgTss =
    recentActivities.reduce((sum, a) => sum + (a.tss ?? 0), 0) /
    recentActivities.length;

  if (last3DaysTss > avgTss * 1.5) {
    score -= 12;
    reasoning.push("High recent load (50% above average)");
  } else if (last3DaysTss > avgTss * 1.2) {
    score -= 6;
    reasoning.push("Elevated recent load");
  }

  // Factor 3: HRV trend
  const today = recentWellness[0];
  const yesterday = recentWellness[1];
  if (today?.hrv != null && yesterday?.hrv != null) {
    const hrvChange = ((today.hrv - yesterday.hrv) / yesterday.hrv) * 100;
    if (hrvChange < -10) {
      score -= 10;
      reasoning.push("HRV dropped 10%+ from yesterday");
    } else if (hrvChange < -5) {
      score -= 5;
      reasoning.push("HRV declining");
    } else if (hrvChange > 5) {
      score += 8;
      reasoning.push("HRV improving");
    }
  }

  // Factor 4: Sleep quality
  if (today?.sleepScore != null) {
    if (today.sleepScore < 60) {
      score -= 8;
      reasoning.push("Poor sleep quality");
    } else if (today.sleepScore > 80) {
      score += 5;
      reasoning.push("Good sleep quality");
    }
  } else if (today?.sleepHours != null) {
    if (today.sleepHours < 6.5) {
      score -= 8;
      reasoning.push("Insufficient sleep (<6.5h)");
    } else if (today.sleepHours >= 8) {
      score += 5;
      reasoning.push("Adequate sleep (8+ hours)");
    }
  }

  // Factor 5: Week position (more fatigued later in week)
  if (metrics.cycleWeekNumber === 3) {
    score -= 5;
    reasoning.push("Peak week - cumulative fatigue expected");
  } else if (metrics.cycleWeekNumber === 4) {
    score += 5;
    reasoning.push("Recovery week - fresher expected");
  }

  // Factor 6: Yesterday's workout
  const yesterday_activity = recentActivities[0];
  if (yesterday_activity?.tss != null && yesterday_activity.tss > 100) {
    score -= 8;
    reasoning.push("High-load workout yesterday");
  }

  // Clamp score
  const finalScore = Math.max(0, Math.min(100, score));

  // Determine readiness level
  let readiness: "high" | "moderate" | "low";
  if (finalScore >= 65) {
    readiness = "high";
  } else if (finalScore >= 40) {
    readiness = "moderate";
  } else {
    readiness = "low";
  }

  // Calculate confidence based on data availability
  let confidence = 0.5;
  if (today?.hrv != null) confidence += 0.15;
  if (today?.sleepScore != null || today?.sleepHours != null)
    confidence += 0.15;
  if (recentActivities.length >= 14) confidence += 0.15;
  if (yesterday_activity != null) confidence += 0.05;

  // Suggested action
  let suggestedAction: string | undefined;
  if (readiness === "low") {
    suggestedAction = "Consider a recovery day or very light activity";
  } else if (readiness === "high" && metrics.cycleWeekNumber !== 4) {
    suggestedAction = "Good opportunity for a quality session";
  }

  return {
    tomorrowReadiness: readiness,
    confidence: Math.min(1.0, confidence),
    reasoning,
    suggestedAction,
  };
}
