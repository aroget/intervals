/**
 * Tracks weekly compliance: how well athlete followed prescribed plan.
 * Calculates completion rate, TSS compliance, and identifies patterns.
 */

import type { Activity } from "../../types.js";
import { estimateTss } from "./workoutAdapter.js";

export interface WeeklyComplianceReport {
  weekStartDate: string;
  weekEndDate: string;
  weekNumber: number; // 1-4 within block
  weekType: "base" | "build" | "peak" | "recovery";
  workoutsCompleted: number;
  workoutsPrescribed: number;
  complianceRate: number; // 0-100%
  targetTss: number;
  actualTss: number;
  tssComplianceRate: number; // 0-100%
  missedDates: string[];
  completedDates: string[];
  avgRpe: number | null;
  notes: string;
}

interface PrescribedWorkout {
  workout_date: string;
  sport: string | null;
  duration_min: number | null;
  intensity: string | null;
}

/**
 * Calculate weekly compliance for a given week.
 */
export function calculateWeeklyCompliance(
  weekStartDate: string,
  weekNumber: number,
  weekType: "base" | "build" | "peak" | "recovery",
  prescribedWorkouts: PrescribedWorkout[],
  activities: Activity[],
): WeeklyComplianceReport {
  const weekStart = new Date(weekStartDate);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  // Target TSS by week type
  const targetTssMap: Record<string, number> = {
    base: 300,
    build: 450,
    peak: 550,
    recovery: 250,
  };
  const targetTss = targetTssMap[weekType];

  // Filter workouts and activities for this week
  const weekWorkouts = prescribedWorkouts.filter(
    (w) => w.workout_date >= weekStartDate && w.workout_date <= weekEndStr,
  );
  const weekActivities = activities.filter(
    (a) => a.activityDate >= weekStartDate && a.activityDate <= weekEndStr,
  );

  // Calculate actual TSS
  const actualTss = weekActivities.reduce((sum, a) => sum + (a.tss ?? 0), 0);

  // Match prescribed workouts to activities
  const activityDateSet = new Set(weekActivities.map((a) => a.activityDate));
  const prescribedDates = weekWorkouts.map((w) => w.workout_date);
  const completedDates = prescribedDates.filter((date) =>
    activityDateSet.has(date),
  );
  const missedDates = prescribedDates.filter(
    (date) => !activityDateSet.has(date),
  );

  const workoutsPrescribed = weekWorkouts.length;
  const workoutsCompleted = completedDates.length;
  const complianceRate =
    workoutsPrescribed > 0
      ? Math.round((workoutsCompleted / workoutsPrescribed) * 100)
      : 100;

  const tssComplianceRate =
    targetTss > 0 ? Math.round((actualTss / targetTss) * 100) : 0;

  // Calculate average RPE
  const rpes = weekActivities
    .map((a) => a.rpe)
    .filter((rpe): rpe is number => rpe !== null);
  const avgRpe = rpes.length > 0 ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;

  // Generate notes
  let notes = "";
  if (complianceRate === 100 && tssComplianceRate >= 90) {
    notes = "Perfect week — all workouts completed with target load achieved.";
  } else if (complianceRate >= 70) {
    notes = `Good adherence (${workoutsCompleted}/${workoutsPrescribed} completed).`;
  } else if (complianceRate >= 40) {
    notes = `Moderate adherence (${workoutsCompleted}/${workoutsPrescribed} completed). ${missedDates.length} sessions missed.`;
  } else {
    notes = `Low adherence (${workoutsCompleted}/${workoutsPrescribed} completed). Plan may need adjustment.`;
  }

  if (tssComplianceRate < 70 && complianceRate > 50) {
    notes += " Load significantly below target despite completing sessions.";
  } else if (tssComplianceRate > 130) {
    notes += " Load exceeded target — watch for overtraining.";
  }

  return {
    weekStartDate,
    weekEndDate: weekEndStr,
    weekNumber,
    weekType,
    workoutsCompleted,
    workoutsPrescribed,
    complianceRate,
    targetTss,
    actualTss: Math.round(actualTss),
    tssComplianceRate,
    missedDates,
    completedDates,
    avgRpe: avgRpe !== null ? Math.round(avgRpe * 10) / 10 : null,
    notes,
  };
}

/**
 * Calculate compliance for all weeks in current training block.
 */
export function calculateBlockCompliance(
  blockStartDate: string,
  prescribedWorkouts: PrescribedWorkout[],
  activities: Activity[],
): WeeklyComplianceReport[] {
  const weekTypes: Array<"base" | "build" | "peak" | "recovery"> = [
    "base",
    "build",
    "peak",
    "recovery",
  ];

  const reports: WeeklyComplianceReport[] = [];

  for (let weekNum = 0; weekNum < 4; weekNum++) {
    const weekStart = new Date(blockStartDate);
    weekStart.setDate(weekStart.getDate() + weekNum * 7);
    const weekStartStr = weekStart.toISOString().slice(0, 10);

    const report = calculateWeeklyCompliance(
      weekStartStr,
      weekNum + 1,
      weekTypes[weekNum],
      prescribedWorkouts,
      activities,
    );

    reports.push(report);
  }

  return reports;
}
