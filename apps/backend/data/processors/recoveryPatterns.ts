/**
 * Recovery pattern analysis - detects individual athlete recovery patterns
 * from historical wellness and activity data.
 */
import type { WellnessLog, Activity } from "../../types.js";

export interface RecoveryPattern {
  type: string;
  description: string;
  confidence: number;
  data: Record<string, unknown>;
}

/**
 * Analyzes HRV response to high-intensity training
 */
export function analyzeHrvAfterKeyWorkouts(
  wellness: WellnessLog[],
  activities: Activity[],
): RecoveryPattern | null {
  // Find key sessions (high TSS or intensity)
  const keySessions = activities.filter(
    (a) =>
      a.tss != null &&
      (a.tss > 80 || (a.intensityFactor != null && a.intensityFactor > 0.85)),
  );

  if (keySessions.length < 5) return null; // Need at least 5 samples

  const hrvDrops: number[] = [];

  keySessions.forEach((session) => {
    const sessionDate = session.activityDate;
    const nextDay = new Date(sessionDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextDayStr = nextDay.toISOString().slice(0, 10);

    const baselineLog = wellness.find((w) => w.logDate === sessionDate);
    const nextDayLog = wellness.find((w) => w.logDate === nextDayStr);

    if (
      baselineLog?.hrv != null &&
      nextDayLog?.hrv != null &&
      baselineLog.hrv > 0
    ) {
      const drop = ((baselineLog.hrv - nextDayLog.hrv) / baselineLog.hrv) * 100;
      hrvDrops.push(drop);
    }
  });

  if (hrvDrops.length < 5) return null;

  const avgDrop = hrvDrops.reduce((a, b) => a + b, 0) / hrvDrops.length;
  const stdDev = Math.sqrt(
    hrvDrops.reduce((sum, val) => sum + Math.pow(val - avgDrop, 2), 0) /
      hrvDrops.length,
  );

  if (Math.abs(avgDrop) < 3) return null; // Not significant

  return {
    type: "hrv_after_key_sessions",
    description: `Your HRV typically ${avgDrop > 0 ? "drops" : "rises"} ${Math.abs(avgDrop).toFixed(0)}% the day after high-intensity sessions`,
    confidence: Math.min(0.9, hrvDrops.length / 10), // More samples = higher confidence
    data: { avgDrop, stdDev, sampleSize: hrvDrops.length },
  };
}

/**
 * Analyzes how many recovery days are typically needed after high load weeks
 */
export function analyzeRecoveryDaysNeeded(
  wellness: WellnessLog[],
  activities: Activity[],
): RecoveryPattern | null {
  // Group activities by week
  const weekMap = new Map<string, number>();
  activities.forEach((a) => {
    if (a.tss == null) return;
    const date = new Date(a.activityDate);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = weekStart.toISOString().slice(0, 10);
    weekMap.set(weekKey, (weekMap.get(weekKey) ?? 0) + a.tss);
  });

  // Find high load weeks (top 33%)
  const weekTss = Array.from(weekMap.entries()).sort((a, b) => b[1] - a[1]);
  if (weekTss.length < 8) return null; // Need at least 8 weeks
  const highLoadThreshold = weekTss[Math.floor(weekTss.length / 3)][1];

  const recoveryTimes: number[] = [];

  weekTss.forEach(([weekStart, tss]) => {
    if (tss < highLoadThreshold) return;

    // Count days until HRV returns to baseline
    const weekStartDate = new Date(weekStart);
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekStartDate.getDate() + 6);

    const weekBaseline =
      wellness
        .filter(
          (w) =>
            w.logDate >= weekStart &&
            w.logDate <= weekEndDate.toISOString().slice(0, 10) &&
            w.hrv != null,
        )
        .reduce((sum, w) => sum + (w.hrv ?? 0), 0) /
        wellness.filter(
          (w) =>
            w.logDate >= weekStart &&
            w.logDate <= weekEndDate.toISOString().slice(0, 10) &&
            w.hrv != null,
        ).length || 0;

    if (weekBaseline === 0) return;

    // Check following week
    let daysToRecover = 0;
    for (let i = 1; i <= 7; i++) {
      const checkDate = new Date(weekEndDate);
      checkDate.setDate(checkDate.getDate() + i);
      const checkLog = wellness.find(
        (w) => w.logDate === checkDate.toISOString().slice(0, 10),
      );
      if (checkLog?.hrv != null && checkLog.hrv >= weekBaseline * 0.95) {
        daysToRecover = i;
        break;
      }
    }

    if (daysToRecover > 0) recoveryTimes.push(daysToRecover);
  });

  if (recoveryTimes.length < 3) return null;

  const avgRecoveryDays =
    recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length;

  return {
    type: "recovery_days_needed",
    description: `You typically need ${Math.round(avgRecoveryDays)} recovery day${Math.round(avgRecoveryDays) === 1 ? "" : "s"} after high-load weeks`,
    confidence: Math.min(0.8, recoveryTimes.length / 8),
    data: { avgDays: avgRecoveryDays, sampleSize: recoveryTimes.length },
  };
}

/**
 * Detects back-to-back key session tolerance
 */
export function analyzeBackToBackTolerance(
  wellness: WellnessLog[],
  activities: Activity[],
): RecoveryPattern | null {
  const keySessions = activities
    .filter(
      (a) =>
        a.tss != null &&
        (a.tss > 80 || (a.intensityFactor != null && a.intensityFactor > 0.85)),
    )
    .sort((a, b) => a.activityDate.localeCompare(b.activityDate));

  const backToBackPairs: { hrv1: number; hrv2: number; gap: number }[] = [];

  for (let i = 0; i < keySessions.length - 1; i++) {
    const date1 = new Date(keySessions[i].activityDate);
    const date2 = new Date(keySessions[i + 1].activityDate);
    const dayGap = Math.floor((date2.getTime() - date1.getTime()) / 86_400_000);

    if (dayGap <= 2) {
      const log1 = wellness.find(
        (w) => w.logDate === keySessions[i].activityDate,
      );
      const log2 = wellness.find(
        (w) => w.logDate === keySessions[i + 1].activityDate,
      );

      if (log1?.hrv != null && log2?.hrv != null) {
        backToBackPairs.push({
          hrv1: log1.hrv,
          hrv2: log2.hrv,
          gap: dayGap,
        });
      }
    }
  }

  if (backToBackPairs.length < 3) return null;

  const avgHrvDrop =
    backToBackPairs.reduce(
      (sum, p) => sum + ((p.hrv1 - p.hrv2) / p.hrv1) * 100,
      0,
    ) / backToBackPairs.length;

  return {
    type: "back_to_back_tolerance",
    description: `Back-to-back key sessions cause a ${Math.abs(avgHrvDrop).toFixed(0)}% ${avgHrvDrop > 0 ? "drop" : "rise"} in HRV`,
    confidence: Math.min(0.85, backToBackPairs.length / 6),
    data: { avgHrvDrop, sampleSize: backToBackPairs.length },
  };
}

/**
 * Main function to analyze all recovery patterns
 */
export function analyzeAllRecoveryPatterns(
  wellness: WellnessLog[],
  activities: Activity[],
): RecoveryPattern[] {
  const patterns: RecoveryPattern[] = [];

  const hrvPattern = analyzeHrvAfterKeyWorkouts(wellness, activities);
  if (hrvPattern) patterns.push(hrvPattern);

  const recoveryDays = analyzeRecoveryDaysNeeded(wellness, activities);
  if (recoveryDays) patterns.push(recoveryDays);

  const backToBack = analyzeBackToBackTolerance(wellness, activities);
  if (backToBack) patterns.push(backToBack);

  return patterns.filter((p) => p.confidence >= 0.5); // Only return confident patterns
}
