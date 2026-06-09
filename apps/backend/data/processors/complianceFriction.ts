/**
 * Compliance friction detection - identifies patterns in skipped/modified workouts
 */
import type { Activity } from "../../types.js";

export interface ComplianceFriction {
  type: string;
  severity: "high" | "moderate" | "low";
  description: string;
  actionable: string;
  data: Record<string, unknown>;
}

interface PrescribedWorkout {
  workout_date: string;
  sport: string;
  duration_min: number;
  intensity: string;
  session_type?: string;
}

/**
 * Detects patterns in skipped key sessions
 */
export function detectSkippedKeySessions(
  prescribed: PrescribedWorkout[],
  completed: Activity[],
): ComplianceFriction | null {
  const keySessions = prescribed.filter((p) => p.session_type === "key");
  if (keySessions.length < 4) return null; // Need at least 4 to establish pattern

  const skipped = keySessions.filter(
    (p) => !completed.some((a) => a.activityDate === p.workout_date),
  );

  const skipRate = skipped.length / keySessions.length;

  if (skipRate >= 0.6) {
    // 60%+ skipped
    return {
      type: "key_session_avoidance",
      severity: "high",
      description: `You've skipped ${skipped.length} of ${keySessions.length} prescribed key sessions`,
      actionable:
        "Key sessions drive fitness gains. What's blocking you? Time constraints, motivation, or physical limitations?",
      data: {
        skipRate,
        skippedCount: skipped.length,
        totalKey: keySessions.length,
      },
    };
  } else if (skipRate >= 0.4) {
    return {
      type: "key_session_avoidance",
      severity: "moderate",
      description: `Missing ${Math.round(skipRate * 100)}% of key sessions`,
      actionable:
        "Consider shorter key sessions if time is an issue, or adjust intensity if recovery is challenging.",
      data: {
        skipRate,
        skippedCount: skipped.length,
        totalKey: keySessions.length,
      },
    };
  }

  return null;
}

/**
 * Detects pattern of skipping specific sport
 */
export function detectSportAvoidance(
  prescribed: PrescribedWorkout[],
  completed: Activity[],
): ComplianceFriction | null {
  const sportMap = new Map<string, { prescribed: number; completed: number }>();

  prescribed.forEach((p) => {
    const existing = sportMap.get(p.sport) ?? { prescribed: 0, completed: 0 };
    existing.prescribed += 1;
    sportMap.set(p.sport, existing);
  });

  completed.forEach((a) => {
    if (!a.sport) return;
    const existing = sportMap.get(a.sport);
    if (existing) {
      existing.completed += 1;
    }
  });

  let worstSport: { sport: string; skipRate: number } | null = null;

  sportMap.forEach((stats, sport) => {
    const skipRate = 1 - stats.completed / stats.prescribed;
    if (
      stats.prescribed >= 3 &&
      skipRate >= 0.6 &&
      (!worstSport || skipRate > worstSport.skipRate)
    ) {
      worstSport = { sport, skipRate };
    }
  });

  if (worstSport !== null) {
    const { sport, skipRate } = worstSport;
    return {
      type: "sport_avoidance",
      severity: skipRate >= 0.75 ? "high" : "moderate",
      description: `Frequently skipping ${sport} workouts (${Math.round(skipRate * 100)}% skip rate)`,
      actionable: `Consider why ${sport} is challenging - injury risk, equipment access, weather, or preference? Adjust sport mix if needed.`,
      data: { sport, skipRate },
    };
  }

  return null;
}

/**
 * Detects pattern of doing workouts but significantly shorter than prescribed
 */
export function detectDurationReduction(
  prescribed: PrescribedWorkout[],
  completed: Activity[],
): ComplianceFriction | null {
  const matches: { prescribed: number; actual: number }[] = [];

  prescribed.forEach((p) => {
    const activity = completed.find((a) => a.activityDate === p.workout_date);
    if (activity?.durationSecs != null) {
      matches.push({
        prescribed: p.duration_min * 60,
        actual: activity.durationSecs,
      });
    }
  });

  if (matches.length < 5) return null;

  const reductions = matches.filter((m) => m.actual < m.prescribed * 0.7); // 30%+ shorter
  const reductionRate = reductions.length / matches.length;

  if (reductionRate >= 0.5) {
    const avgReduction =
      reductions.reduce((sum, r) => sum + (1 - r.actual / r.prescribed), 0) /
      reductions.length;

    return {
      type: "duration_reduction",
      severity: "moderate",
      description: `Workouts are averaging ${Math.round(avgReduction * 100)}% shorter than prescribed`,
      actionable:
        "Time-constrained? Let's adjust prescribed durations to match your realistic availability.",
      data: { avgReduction, reductionRate, count: reductions.length },
    };
  }

  return null;
}

/**
 * Detects if athlete consistently trains on different days than prescribed
 */
export function detectDayShifting(
  prescribed: PrescribedWorkout[],
  completed: Activity[],
): ComplianceFriction | null {
  let dayShifts = 0;
  let totalMatched = 0;

  prescribed.forEach((p) => {
    const exactMatch = completed.find((a) => a.activityDate === p.workout_date);
    if (exactMatch) {
      totalMatched++;
      return;
    }

    // Check +/- 2 days
    const pDate = new Date(p.workout_date);
    for (let offset = -2; offset <= 2; offset++) {
      if (offset === 0) continue;
      const checkDate = new Date(pDate);
      checkDate.setDate(pDate.getDate() + offset);
      const shiftedMatch = completed.find(
        (a) => a.activityDate === checkDate.toISOString().slice(0, 10),
      );
      if (shiftedMatch) {
        dayShifts++;
        totalMatched++;
        break;
      }
    }
  });

  if (totalMatched >= 5 && dayShifts / totalMatched >= 0.4) {
    return {
      type: "day_shifting",
      severity: "low",
      description: `Training days often shift from prescribed schedule (${Math.round((dayShifts / totalMatched) * 100)}% of workouts)`,
      actionable:
        "Your actual availability seems different from the plan. Update your preferred training days in settings?",
      data: { shiftRate: dayShifts / totalMatched, shiftedCount: dayShifts },
    };
  }

  return null;
}

/**
 * Analyzes all compliance friction patterns
 */
export function detectAllComplianceFrictions(
  prescribed: PrescribedWorkout[],
  completed: Activity[],
): ComplianceFriction[] {
  const frictions: ComplianceFriction[] = [];

  const keySkips = detectSkippedKeySessions(prescribed, completed);
  if (keySkips) frictions.push(keySkips);

  const sportAvoidance = detectSportAvoidance(prescribed, completed);
  if (sportAvoidance) frictions.push(sportAvoidance);

  const durationReduction = detectDurationReduction(prescribed, completed);
  if (durationReduction) frictions.push(durationReduction);

  const dayShifting = detectDayShifting(prescribed, completed);
  if (dayShifting) frictions.push(dayShifting);

  // Sort by severity
  return frictions.sort((a, b) => {
    const severityOrder = { high: 0, moderate: 1, low: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}
