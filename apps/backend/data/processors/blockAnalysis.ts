/**
 * Composite processor for block-level analysis.
 * Orchestrates loaders + other processors to provide complete block data.
 * Eliminates duplication across multiple endpoints.
 */

import { db } from "../../db/client.js";
import { loadActivities } from "../../db/loaders.js";
import { getCyclePosition } from "./cycleTracker.js";
import { calculateBlockCompliance } from "./weeklyCompliance.js";
import { analyzeFitnessTrajectory } from "./fitnessTrajectory.js";
import type { Activity } from "../../types.js";

// Database row type (snake_case from Supabase)
interface PrescribedWorkoutRow {
  workout_date: string;
  sport: string | null;
  duration_min: number | null;
  intensity: string | null;
  session_type: string | null;
}

export interface BlockAnalysisOptions {
  includeWorkouts?: boolean;
  includeCompliance?: boolean;
  includeFitness?: boolean;
  includeZones?: boolean;
}

export interface BlockAnalysisResult {
  blockStartDate: string;
  blockEndDate: string;
  currentWeek: number;
  weekType: "base" | "build" | "peak" | "recovery";

  // Optional sections based on options
  weeks?: {
    weekNum: number;
    weekType: string;
    startDate: string;
    endDate: string;
    days: {
      date: string;
      prescribed: {
        workoutDate: string;
        sport: string | null;
        durationMin: number | null;
        intensity: string | null;
        sessionType: string | null;
      } | null;
      completed: Activity[];
    }[];
  }[];

  compliance?: {
    weeklyReports: Array<{
      weekNum: number;
      weekType: string;
      targetTss: number;
      actualTss: number;
      tssRate: number;
      workoutsCompleted: number;
      workoutsPrescribed: number;
      complianceRate: number;
    }>;
    overallCompliance: {
      workoutsCompleted: number;
      workoutsPrescribed: number;
      complianceRate: number;
      tssComplianceRate: number;
    };
  };

  fitness?: {
    baselineCtl: number;
    checkpoints: Array<{
      weekNum: number;
      date: string;
      actualCtl: number;
      expectedCtl: number;
      trend: string;
    }>;
  };

  zones?: {
    zone1: number;
    zone2: number;
    zone3: number;
    zone4: number;
    zone5: number;
  };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Get comprehensive block analysis with optional sections.
 */
export async function getBlockAnalysis(
  athleteId: string,
  refDate: string,
  options: BlockAnalysisOptions = {},
): Promise<BlockAnalysisResult> {
  // Get athlete's cycle start date
  const { data: profile } = await db
    .from("athlete_profiles")
    .select("cycle_start_date")
    .eq("athlete_id", athleteId)
    .single();

  if (!profile?.cycle_start_date) {
    throw new Error("No training cycle configured");
  }

  // Calculate current block boundaries
  const cycleStart = new Date(profile.cycle_start_date);
  const refDateObj = new Date(refDate);
  const daysSinceStart = Math.floor(
    (refDateObj.getTime() - cycleStart.getTime()) / MS_PER_DAY,
  );
  const currentBlockNumber = Math.floor(daysSinceStart / 28);
  const currentBlockStart = new Date(cycleStart);
  currentBlockStart.setDate(cycleStart.getDate() + currentBlockNumber * 28);

  const blockEndDate = new Date(currentBlockStart);
  blockEndDate.setDate(currentBlockStart.getDate() + 27);

  const blockStartStr = currentBlockStart.toISOString().slice(0, 10);
  const blockEndStr = blockEndDate.toISOString().slice(0, 10);

  // Determine current week within block
  const daysIntoBlock = Math.floor(
    (refDateObj.getTime() - currentBlockStart.getTime()) / MS_PER_DAY,
  );
  const currentWeek = Math.min(Math.floor(daysIntoBlock / 7) + 1, 4);
  const weekTypes: Array<"base" | "build" | "peak" | "recovery"> = [
    "base",
    "build",
    "peak",
    "recovery",
  ];
  const weekType = weekTypes[currentWeek - 1];

  const result: BlockAnalysisResult = {
    blockStartDate: blockStartStr,
    blockEndDate: blockEndStr,
    currentWeek,
    weekType,
  };

  // Load activities once (shared by all options)
  const activities = await loadActivities(athleteId, 90, blockEndStr);
  const blockActivities = activities.filter(
    (a) => a.activityDate >= blockStartStr,
  );

  // Load workouts if needed
  let workouts: PrescribedWorkoutRow[] = [];
  if (options.includeWorkouts || options.includeCompliance) {
    const { data } = await db
      .from("prescribed_workouts")
      .select("*")
      .eq("athlete_id", athleteId)
      .gte("workout_date", blockStartStr)
      .lte("workout_date", blockEndStr)
      .order("workout_date");

    workouts = (data ?? []) as PrescribedWorkoutRow[];
  }

  // Build weeks with daily workouts
  if (options.includeWorkouts) {
    const weeks = [];
    for (let weekNum = 0; weekNum < 4; weekNum++) {
      const weekStart = new Date(currentBlockStart);
      weekStart.setDate(currentBlockStart.getDate() + weekNum * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const weekStartStr = weekStart.toISOString().slice(0, 10);
      const weekEndStr = weekEnd.toISOString().slice(0, 10);

      const days = [];
      for (let d = 0; d < 7; d++) {
        const dayDate = new Date(weekStart);
        dayDate.setDate(weekStart.getDate() + d);
        const dateStr = dayDate.toISOString().slice(0, 10);

        const workoutRow = workouts.find((w) => w.workout_date === dateStr);
        const prescribed = workoutRow
          ? {
              workoutDate: workoutRow.workout_date,
              sport: workoutRow.sport,
              durationMin: workoutRow.duration_min,
              intensity: workoutRow.intensity,
              sessionType: workoutRow.session_type,
            }
          : null;
        const completed = blockActivities.filter(
          (a) => a.activityDate === dateStr,
        );

        days.push({ date: dateStr, prescribed, completed });
      }

      weeks.push({
        weekNum: weekNum + 1,
        weekType: weekTypes[weekNum],
        startDate: weekStartStr,
        endDate: weekEndStr,
        days,
      });
    }

    result.weeks = weeks;
  }

  // Calculate compliance
  if (options.includeCompliance) {
    const reports = calculateBlockCompliance(
      blockStartStr,
      workouts,
      blockActivities,
    );

    const totalCompleted = reports.reduce(
      (sum, r) => sum + r.workoutsCompleted,
      0,
    );
    const totalPrescribed = reports.reduce(
      (sum, r) => sum + r.workoutsPrescribed,
      0,
    );
    const overallRate =
      totalPrescribed > 0
        ? Math.round((totalCompleted / totalPrescribed) * 100)
        : 100;

    const totalTargetTss = reports.reduce((sum, r) => sum + r.targetTss, 0);
    const totalActualTss = reports.reduce((sum, r) => sum + r.actualTss, 0);
    const overallTssRate =
      totalTargetTss > 0
        ? Math.round((totalActualTss / totalTargetTss) * 100)
        : 0;

    result.compliance = {
      weeklyReports: reports.map((r) => ({
        weekNum: r.weekNumber,
        weekType: r.weekType,
        targetTss: r.targetTss,
        actualTss: r.actualTss,
        tssRate: r.tssComplianceRate,
        workoutsCompleted: r.workoutsCompleted,
        workoutsPrescribed: r.workoutsPrescribed,
        complianceRate: r.complianceRate,
      })),
      overallCompliance: {
        workoutsCompleted: totalCompleted,
        workoutsPrescribed: totalPrescribed,
        complianceRate: overallRate,
        tssComplianceRate: overallTssRate,
      },
    };
  }

  // Analyze fitness trajectory
  if (options.includeFitness) {
    const baselineCtl = (() => {
      const priorActivities = activities.filter(
        (a) => a.activityDate < blockStartStr,
      );
      if (priorActivities.length === 0) return 0;
      return priorActivities[priorActivities.length - 1]?.ctl ?? 0;
    })();

    const checkpoints = analyzeFitnessTrajectory(
      blockStartStr,
      baselineCtl,
      blockActivities,
    );

    if (options.includeFitness) {
      result.fitness = {
        baselineCtl,
        checkpoints: checkpoints.map((c) => ({
          weekNum: c.weekInBlock,
          date: c.date,
          actualCtl: c.actualCtl,
          expectedCtl: c.expectedCtl,
          trend: c.trend,
        })),
      };
    }
  }

  // Calculate zone distribution
  if (options.includeZones) {
    const zoneDistribution = {
      zone1: 0,
      zone2: 0,
      zone3: 0,
      zone4: 0,
      zone5: 0,
    };

    blockActivities.forEach((a) => {
      const duration = (a.durationSecs ?? 0) / 3600; // hours
      if (duration === 0) return;

      let intensityFactor = a.intensityFactor ?? 0;

      if (intensityFactor === 0 && (a.tss ?? 0) > 0) {
        const tssPerHour = (a.tss ?? 0) / duration;
        if (tssPerHour < 50) intensityFactor = 0.5;
        else if (tssPerHour < 75) intensityFactor = 0.65;
        else if (tssPerHour < 90) intensityFactor = 0.8;
        else if (tssPerHour < 110) intensityFactor = 0.9;
        else intensityFactor = 1.0;
      }

      if (intensityFactor === 0) {
        zoneDistribution.zone2 += duration;
        return;
      }

      if (intensityFactor < 0.55) zoneDistribution.zone1 += duration;
      else if (intensityFactor < 0.75) zoneDistribution.zone2 += duration;
      else if (intensityFactor < 0.85) zoneDistribution.zone3 += duration;
      else if (intensityFactor < 0.95) zoneDistribution.zone4 += duration;
      else zoneDistribution.zone5 += duration;
    });

    const totalHours = Object.values(zoneDistribution).reduce(
      (a, b) => a + b,
      0,
    );

    result.zones = {
      zone1:
        totalHours > 0
          ? Math.round((zoneDistribution.zone1 / totalHours) * 100)
          : 0,
      zone2:
        totalHours > 0
          ? Math.round((zoneDistribution.zone2 / totalHours) * 100)
          : 0,
      zone3:
        totalHours > 0
          ? Math.round((zoneDistribution.zone3 / totalHours) * 100)
          : 0,
      zone4:
        totalHours > 0
          ? Math.round((zoneDistribution.zone4 / totalHours) * 100)
          : 0,
      zone5:
        totalHours > 0
          ? Math.round((zoneDistribution.zone5 / totalHours) * 100)
          : 0,
    };
  }

  return result;
}
