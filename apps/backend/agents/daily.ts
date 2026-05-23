/**
 * Daily orchestrator — runs Recovery Agent then Coach Agent.
 * Called by GitHub Actions cron or `pnpm analyze`.
 */
import "dotenv/config";
import { db } from "../db/client.js";
import { buildComputedMetrics } from "../data/processors/readiness.js";
import { buildComplianceReport } from "../data/processors/workoutCompliance.js";
import { runRecoveryAgent } from "./recovery/agent.js";
import { runCoachAgent } from "./coach/agent.js";
import { embed } from "./llm/adapter.js";
import type { Activity, AthleteProfile, WellnessLog } from "../types.js";
import type { RecoveryOutput } from "./recovery/schema.js";
import type { ComplianceReport } from "../data/processors/workoutCompliance.js";

const MODEL = process.env.LLM_MODEL ?? "gpt-4o-mini";
const ATHLETE_ID = process.env.INTERVALS_ATHLETE_ID!;

async function loadWellness(
  athleteId: string,
  daysBack: number,
): Promise<WellnessLog[]> {
  const since = new Date();
  since.setDate(since.getDate() - daysBack);
  const { data } = await db
    .from("wellness_logs")
    .select("*")
    .eq("athlete_id", athleteId)
    .gte("log_date", since.toISOString().slice(0, 10))
    .order("log_date", { ascending: true });
  return (data ?? []).map((r: any) => ({
    id: r.id,
    athleteId: r.athlete_id,
    logDate: r.log_date,
    hrv: r.hrv,
    hrvScore: r.hrv_score,
    rhr: r.rhr,
    sleepScore: r.sleep_score,
    sleepHours: r.sleep_hours,
    sleepQuality: r.sleep_quality,
  })) as WellnessLog[];
}

async function loadActivities(
  athleteId: string,
  daysBack: number,
): Promise<Activity[]> {
  const since = new Date();
  since.setDate(since.getDate() - daysBack);
  const { data } = await db
    .from("activities")
    .select("*")
    .eq("athlete_id", athleteId)
    .gte("activity_date", since.toISOString().slice(0, 10))
    .order("activity_date", { ascending: true });
  return (data ?? []).map((r: any) => ({
    id: r.id,
    athleteId: r.athlete_id,
    intervalsId: r.intervals_id,
    activityDate: r.activity_date,
    sport: r.sport,
    name: r.name,
    durationSecs: r.duration_secs,
    distanceM: r.distance_m,
    tss: r.tss,
    intensityFactor: r.intensity_factor,
    atl: r.atl ?? null,
    ctl: r.ctl ?? null,
    avgHr: r.avg_hr,
    maxHr: r.max_hr,
    avgPower: r.avg_power,
    normalizedPower: r.normalized_power,
    joules: r.joules ?? null,
    gap: r.gap ?? null,
    decoupling: r.decoupling ?? null,
    elevationM: r.elevation_m,
    notes: r.notes,
    rpe: r.rpe ?? null,
    athleteComments: r.athlete_comments ?? null,
    paceLoad: null,
    hrLoad: null,
    powerLoad: null,
    efficiencyFactor: null,
  })) as Activity[];
}

async function loadProfile(athleteId: string): Promise<AthleteProfile> {
  const { data, error } = await db
    .from("athlete_profiles")
    .select("*")
    .eq("athlete_id", athleteId)
    .single();
  if (error || !data)
    throw new Error(
      `No athlete profile found for ${athleteId}: ${error?.message ?? "no data"} (code: ${error?.code})`,
    );
  return {
    id: data.id,
    athleteId: data.athlete_id,
    name: data.name,
    goals: data.goals,
    trainingPhilosophy: data.training_philosophy,
    disciplines: data.disciplines ?? [],
    weeklyMaxHours: data.weekly_max_hours ?? {},
    preferredMetrics: data.preferred_metrics ?? [],
    cycleStartDate: data.cycle_start_date,
    ftp: data.ftp ?? null,
    runningThresholdPace: data.running_threshold_pace ?? null,
    lthr: data.lthr ?? null,
  };
}

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
        .select("id")
        .eq("athlete_id", athleteId)
        .eq("workout_date", today)
        .single(),
    ]);

  if (!force && existingAnalysis && existingWorkout) {
    console.log(
      "[daily] Analysis and workout already exist for today, skipping",
    );
    return;
  }

  if (force && (existingAnalysis || existingWorkout)) {
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
