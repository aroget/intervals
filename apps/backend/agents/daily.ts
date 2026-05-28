/**
 * Daily orchestrator — runs Recovery Agent then Coach Agent.
 * Called by GitHub Actions cron or `pnpm analyze`.
 */
import "dotenv/config";
import { db } from "../db/client.js";
import { loadProfile, loadWellness, loadActivities } from "../db/loaders.js";
import { buildComputedMetrics } from "../data/processors/readiness.js";
import { buildComplianceReport } from "../data/processors/workoutCompliance.js";
import {
  getTrainingCapacity,
  suggestAdaptation,
} from "../data/processors/workoutAdapter.js";
import {
  getExpectedReadiness,
  checkReadinessDeviation,
} from "../data/processors/deviationChecker.js";
import {
  analyzeFitnessTrajectory,
  calculateBlockEffectiveness,
} from "../data/processors/fitnessTrajectory.js";
import { calculateBlockCompliance } from "../data/processors/weeklyCompliance.js";
import { runRecoveryAgent } from "./recovery/agent.js";
import { runCoachAgent } from "./coach/agent.js";
import { embed } from "./llm/adapter.js";
import type { AthleteProfile } from "../types.js";
import type { RecoveryOutput } from "./recovery/schema.js";
import type { ComplianceReport } from "../data/processors/workoutCompliance.js";

const MODEL = process.env.LLM_MODEL ?? "gpt-4o-mini";
const ATHLETE_ID = process.env.INTERVALS_ATHLETE_ID!;

async function storeMemory(
  athleteId: string,
  type: string,
  content: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const embedding = await embed(content);
  await db.from("agent_memories").insert({
    athlete_id: athleteId,
    memory_type: type,
    content,
    embedding,
    metadata,
  });
}

export async function loadAthleteProfile(
  athleteId: string,
): Promise<AthleteProfile> {
  return loadProfile(athleteId);
}

export async function runDailyAnalysis(
  athleteId: string = ATHLETE_ID,
  today: string = new Date().toISOString().slice(0, 10),
  upcomingWorkouts?: {
    date: string;
    sport: string;
    durationMin: number;
    intensity: string;
    periodizationPhase?: string;
  }[],
  cachedProfile?: AthleteProfile,
  force = false,
): Promise<void> {
  console.log(`[daily] Running analysis for ${athleteId} on ${today}`);

  // Idempotency check — check both tables independently
  const [{ data: existingAnalysis }, { data: existingWorkout }] =
    await Promise.all([
      db
        .from("daily_analyses")
        .select("id, agent_output")
        .eq("athlete_id", athleteId)
        .eq("analysis_date", today)
        .single(),
      db
        .from("prescribed_workouts")
        .select("*")
        .eq("athlete_id", athleteId)
        .eq("workout_date", today)
        .single(),
    ]);

  if (!force && existingAnalysis) {
    console.log(
      "[daily] Analysis and workout already exist for today, skipping",
    );
    return;
  }

  if (force) {
    console.log(
      "[daily] Force flag set — deleting today's records for fresh analysis",
    );
    await Promise.all([
      existingAnalysis
        ? db
            .from("daily_analyses")
            .delete()
            .eq("id", (existingAnalysis as { id: string }).id)
        : Promise.resolve(),
      existingWorkout
        ? db
            .from("prescribed_workouts")
            .delete()
            .eq("athlete_id", athleteId)
            .eq("workout_date", today)
        : Promise.resolve(),
    ]);
  }

  const [profile, logs, activities] = await Promise.all([
    cachedProfile ? Promise.resolve(cachedProfile) : loadProfile(athleteId),
    loadWellness(athleteId, 60),
    loadActivities(athleteId, 90),
  ]);

  if (!profile.cycleStartDate) {
    throw new Error(
      "Athlete profile missing cycle_start_date. Set it before running analysis.",
    );
  }

  const metrics = buildComputedMetrics({
    logs,
    activities,
    cycleStartDate: profile.cycleStartDate,
    weeklyMaxHours: profile.weeklyMaxHours,
    today,
  });

  // ── Calculate block effectiveness ─────────────────────────────────────────
  let blockEffectiveness: number | null = null;
  try {
    // Get current block boundaries
    const cycleStart = new Date(profile.cycleStartDate);
    const todayDate = new Date(today);
    const daysSinceStart = Math.floor(
      (todayDate.getTime() - cycleStart.getTime()) / 86_400_000,
    );
    const currentBlockStart = new Date(cycleStart);
    currentBlockStart.setDate(
      cycleStart.getDate() + Math.floor(daysSinceStart / 28) * 28,
    );
    const blockStartStr = currentBlockStart.toISOString().slice(0, 10);
    const blockEndDate = new Date(currentBlockStart);
    blockEndDate.setDate(currentBlockStart.getDate() + 27);
    const blockEndStr = blockEndDate.toISOString().slice(0, 10);

    // Get baseline CTL (from last activity before block)
    const preBlockActivities = activities.filter(
      (a) => a.activityDate < blockStartStr,
    );
    const baselineCtl =
      preBlockActivities[preBlockActivities.length - 1]?.ctl ?? 70;

    // Get block activities
    const blockActivities = activities.filter(
      (a) => a.activityDate >= blockStartStr && a.activityDate <= blockEndStr,
    );

    const checkpoints = analyzeFitnessTrajectory(
      blockStartStr,
      baselineCtl,
      blockActivities,
    );

    const blockEndCtl =
      checkpoints[checkpoints.length - 1]?.actualCtl ?? baselineCtl;

    // Get prescribed workouts for compliance
    const { data: workouts } = await db
      .from("prescribed_workouts")
      .select("workout_date, sport, duration_min, intensity")
      .eq("athlete_id", athleteId)
      .gte("workout_date", blockStartStr)
      .lte("workout_date", blockEndStr);

    if (workouts && workouts.length > 0) {
      const reports = calculateBlockCompliance(
        blockStartStr,
        workouts,
        activities,
      );

      const totalCompleted = reports.reduce(
        (sum, r) => sum + r.workoutsCompleted,
        0,
      );
      const totalPrescribed = reports.reduce(
        (sum, r) => sum + r.workoutsPrescribed,
        0,
      );
      const overallCompliance =
        totalPrescribed > 0
          ? Math.round((totalCompleted / totalPrescribed) * 100)
          : 100;

      const overtrainingDays = checkpoints.filter(
        (c) => c.trend === "stalled",
      ).length;

      blockEffectiveness = calculateBlockEffectiveness(
        baselineCtl,
        blockEndCtl,
        overallCompliance,
        overtrainingDays,
      );

      console.log(
        `[daily] Block effectiveness: ${blockEffectiveness}/100 (compliance: ${overallCompliance}%, CTL gain: ${blockEndCtl - baselineCtl})`,
      );
    }
  } catch (err) {
    console.warn("[daily] Could not calculate block effectiveness:", err);
  }

  metrics.blockEffectiveness = blockEffectiveness;

  console.log(
    `[daily] Readiness: ${metrics.readinessScore}/100 | TSB: ${metrics.tsb} | Week ${metrics.cycleWeekNumber} (${metrics.cycleWeekType})`,
  );

  // ── Yesterday's activity (for recovery context) ───────────────────────────
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const yesterdayActivityForRecovery =
    activities.find((a) => a.activityDate === yesterdayStr) ?? null;

  // ── Recovery Agent (skip if analysis already exists) ──────────────────────
  let recovery: RecoveryOutput;
  if (existingAnalysis) {
    console.log(
      "[daily] Reusing existing recovery analysis, running coach only",
    );
    recovery = existingAnalysis.agent_output as RecoveryOutput;
  } else {
    recovery = await runRecoveryAgent(
      metrics,
      today,
      yesterdayActivityForRecovery
        ? {
            sport: yesterdayActivityForRecovery.sport,
            durationSecs: yesterdayActivityForRecovery.durationSecs ?? null,
            tss: yesterdayActivityForRecovery.tss ?? null,
            intensityFactor:
              yesterdayActivityForRecovery.intensityFactor ?? null,
            avgHr: yesterdayActivityForRecovery.avgHr ?? null,
          }
        : null,
    );
    console.log(
      `[daily] Recovery: ${recovery.readiness} (confidence: ${recovery.confidence})`,
    );

    await db.from("daily_analyses").insert({
      athlete_id: athleteId,
      analysis_date: today,
      readiness_score: metrics.readinessScore,
      hrv_trend: metrics.hrvTrend,
      block_effectiveness: metrics.blockEffectiveness,
      agent_output: recovery,
      model_used: MODEL,
    });
  }

  // ── Yesterday's compliance ─────────────────────────────────────────────────
  // (yesterdayStr already computed above for recovery context)

  const [{ data: yesterdayPrescription }, yesterdayActivity] =
    await Promise.all([
      db
        .from("prescribed_workouts")
        .select("sport,duration_min,intensity,workout_date")
        .eq("athlete_id", athleteId)
        .eq("workout_date", yesterdayStr)
        .single(),
      (async () => {
        const { data } = await db
          .from("activities")
          .select(
            "activity_date,sport,duration_secs,tss,intensity_factor,avg_hr,rpe,athlete_comments",
          )
          .eq("athlete_id", athleteId)
          .eq("activity_date", yesterdayStr)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        return data ?? null;
      })(),
    ]);

  let compliance: ComplianceReport | null = null;
  if (yesterdayPrescription) {
    compliance = buildComplianceReport(
      {
        date: yesterdayStr,
        sport: yesterdayPrescription.sport,
        durationMin: yesterdayPrescription.duration_min,
        intensity: yesterdayPrescription.intensity,
      },
      yesterdayActivity
        ? {
            date: yesterdayStr,
            sport: yesterdayActivity.sport,
            durationSecs: yesterdayActivity.duration_secs,
            tss: yesterdayActivity.tss,
            intensityFactor: yesterdayActivity.intensity_factor,
            avgHr: yesterdayActivity.avg_hr,
            rpe: yesterdayActivity.rpe ?? null,
            athleteComments: yesterdayActivity.athlete_comments ?? null,
          }
        : null,
    );
    console.log(
      `[daily] Yesterday compliance: ${compliance.complianceSummary}`,
    );
  }

  // ── Coach Agent ────────────────────────────────────────────────────────────
  const recentActivities = activities.slice(-14);
  const workout = await runCoachAgent({
    profile,
    metrics,
    recovery,
    recentActivities,
    today,
    upcomingWorkouts,
    compliance,
  });
  console.log(
    `[daily] Workout: ${workout.durationMin}min ${workout.sport} (${workout.intensity})`,
  );

  if (!existingWorkout || force) {
    await db.from("prescribed_workouts").insert({
      athlete_id: athleteId,
      workout_date: today,
      sport: workout.sport,
      duration_min: workout.durationMin,
      intensity: workout.intensity,
      structure: workout.workoutStructure,
      rationale: workout.rationale,
      agent_output: workout,
      model_used: MODEL,
    });
  } else {
    // Existing workout found — check if adaptation suggestion needed

    // Get expected readiness for current training phase
    const expectedReadiness = getExpectedReadiness(metrics.cycleWeekType);

    // Check for major deviation from expected trajectory
    const deviation = checkReadinessDeviation(metrics, expectedReadiness);

    if (deviation.severity === "major" || deviation.severity === "moderate") {
      // Calculate training capacity based on current state
      const capacity = getTrainingCapacity(
        metrics.readinessScore,
        metrics.tsb,
        metrics.hrvTrend,
      );

      // Generate adaptation suggestion
      const suggestion = suggestAdaptation(
        {
          sport: existingWorkout.sport ?? "bike",
          durationMin: existingWorkout.duration_min ?? 60,
          intensity: existingWorkout.intensity ?? "moderate",
        },
        capacity,
        recovery.readiness,
      );

      console.log(
        `[daily] ${deviation.severity.toUpperCase()} deviation: ${deviation.reason}`,
      );
      if (suggestion.shouldAdapt) {
        console.log(
          `[daily] Adaptation suggested: ${existingWorkout.intensity} → ${suggestion.suggestedIntensity}, ${existingWorkout.duration_min}min → ${suggestion.suggestedDurationMin}min`,
        );
      }

      // Store deviation + suggestion in agent_output for UI
      await db
        .from("prescribed_workouts")
        .update({
          agent_output: {
            ...(existingWorkout.agent_output as Record<string, unknown>),
            deviationFlag: deviation,
            adaptationSuggestion: suggestion.shouldAdapt ? suggestion : null,
          },
        })
        .eq("athlete_id", athleteId)
        .eq("workout_date", today);
    } else {
      console.log(
        `[daily] ✓ Readiness within expected range for ${metrics.cycleWeekType} week`,
      );
    }
  }

  // ── Store in semantic memory ───────────────────────────────────────────────
  const memorySummary = `${today}: ${recovery.summary} Workout prescribed: ${workout.durationMin}min ${workout.sport} (${workout.intensity}). ${workout.rationale}`;
  try {
    await storeMemory(athleteId, "analysis", memorySummary, {
      date: today,
      readiness: recovery.readiness,
    });
  } catch (err) {
    console.warn(
      "[daily] Semantic memory storage failed (non-fatal):",
      (err as Error).message,
    );
  }

  console.log("[daily] Complete");
}

// Allow direct execution: pnpm analyze [--force]
const force = process.argv.includes("--force");
runDailyAnalysis(undefined, undefined, undefined, undefined, force).catch(
  (err) => {
    console.error(err);
    process.exit(1);
  },
);

/**
 * Regenerates the prescribed workouts for the next `days` days starting from
 * `fromDate`, running the Coach Agent sequentially so each day's plan is aware
 * of the ones already prescribed before it.
 *
 * @param athleteId - the athlete to replan for
 * @param fromDate  - first date to replan (YYYY-MM-DD), defaults to today
 * @param notes     - optional context injected into every coach prompt
 *                    (e.g. "challenging mountain terrain all week")
 * @param days      - how many days to replan (default 7)
 */
export async function replanWeekWorkouts(
  athleteId: string,
  fromDate: string = new Date().toISOString().slice(0, 10),
  notes?: string,
  days = 7,
): Promise<
  { date: string; sport: string; durationMin: number; intensity: string }[]
> {
  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(fromDate);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }

  const [profile, logs, activities, { data: latestAnalysisRow }] =
    await Promise.all([
      loadProfile(athleteId),
      loadWellness(athleteId, 60),
      loadActivities(athleteId, 90),
      db
        .from("daily_analyses")
        .select("agent_output")
        .eq("athlete_id", athleteId)
        .order("analysis_date", { ascending: false })
        .limit(1)
        .single(),
    ]);

  if (!profile.cycleStartDate) {
    throw new Error("Athlete profile missing cycle_start_date");
  }

  const recoveryContext: RecoveryOutput = latestAnalysisRow?.agent_output
    ? (latestAnalysisRow.agent_output as RecoveryOutput)
    : {
        readiness: "moderate",
        summary: "Week replanned on athlete request.",
        recommendation: notes ?? "Follow the plan.",
        flags: [],
        confidence: 0.5,
        yesterdayImpact: "No recent recovery data available.",
        trainingImplication: notes ?? "Follow the plan.",
      };

  // Wipe existing prescriptions for all target dates so the loop inserts fresh
  await db
    .from("prescribed_workouts")
    .delete()
    .eq("athlete_id", athleteId)
    .in("workout_date", dates);

  const planned: {
    date: string;
    sport: string;
    durationMin: number;
    intensity: string;
  }[] = [];

  for (const date of dates) {
    const metrics = buildComputedMetrics({
      logs,
      activities,
      cycleStartDate: profile.cycleStartDate,
      weeklyMaxHours: profile.weeklyMaxHours,
      today: date,
    });

    const workout = await runCoachAgent({
      profile,
      metrics,
      recovery: recoveryContext,
      recentActivities: activities.slice(-14),
      today: date,
      userRequest: notes ? { notes } : undefined,
      upcomingWorkouts: planned.map((p) => ({
        date: p.date,
        sport: p.sport,
        durationMin: p.durationMin,
        intensity: p.intensity,
      })),
    });

    await db.from("prescribed_workouts").insert({
      athlete_id: athleteId,
      workout_date: date,
      sport: workout.sport,
      duration_min: workout.durationMin,
      intensity: workout.intensity,
      structure: workout.workoutStructure,
      rationale: workout.rationale,
      agent_output: workout,
      model_used: MODEL,
    });

    console.log(
      `[replan] ${date}: ${workout.durationMin}min ${workout.sport} (${workout.intensity})`,
    );

    planned.push({
      date,
      sport: workout.sport,
      durationMin: workout.durationMin,
      intensity: workout.intensity,
    });
  }

  return planned;
}
