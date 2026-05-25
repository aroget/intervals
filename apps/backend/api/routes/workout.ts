import { Hono } from "hono";
import { db } from "../../db/client.js";
import { buildComputedMetrics } from "../../data/processors/readiness.js";
import { runRecoveryAgent } from "../../agents/recovery/agent.js";
import { runCoachAgent } from "../../agents/coach/agent.js";
import { createWorkoutEvent } from "../../data/intervals/client.js";
import type { Activity, AthleteProfile, WellnessLog } from "../../types.js";
import type { CoachOutput } from "../../agents/coach/schema.js";

const workout = new Hono();

// ── Helpers (same as daily.ts) ────────────────────────────────────────────────

async function loadProfile(athleteId: string): Promise<AthleteProfile> {
  const { data, error } = await db
    .from("athlete_profiles")
    .select("*")
    .eq("athlete_id", athleteId)
    .single();
  if (error || !data)
    throw new Error(`No athlete profile found for ${athleteId}`);
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

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * POST /workout/:athleteId/generate
 * Body: { sport: string, durationMin: number, notes?: string }
 * Returns: CoachOutput (structured workout)
 */
workout.post("/:athleteId/generate", async (c) => {
  const athleteId = c.req.param("athleteId");
  const body = await c.req.json<{
    sport: string;
    durationMin: number;
    notes?: string;
  }>();

  const { sport, durationMin, notes } = body;
  if (!sport || !durationMin) {
    return c.json({ error: "sport and durationMin are required" }, 400);
  }

  const today = new Date().toISOString().slice(0, 10);

  // Load all data in parallel
  const [profile, logs, activities] = await Promise.all([
    loadProfile(athleteId),
    loadWellness(athleteId, 60),
    loadActivities(athleteId, 90),
  ]);

  if (!profile.cycleStartDate) {
    return c.json({ error: "Athlete profile missing cycle_start_date" }, 400);
  }

  const metrics = buildComputedMetrics({
    logs,
    activities,
    cycleStartDate: profile.cycleStartDate,
    weeklyMaxHours: profile.weeklyMaxHours,
    today,
  });

  // Try to reuse today's recovery analysis if it exists
  let recovery: Awaited<ReturnType<typeof runRecoveryAgent>>;
  const { data: existingAnalysis } = await db
    .from("daily_analyses")
    .select("agent_output")
    .eq("athlete_id", athleteId)
    .eq("analysis_date", today)
    .single();

  if (existingAnalysis?.agent_output) {
    recovery = existingAnalysis.agent_output as typeof recovery;
  } else {
    recovery = await runRecoveryAgent(metrics, today);
  }

  const recentActivities = activities.slice(-14);
  const generated = await runCoachAgent({
    profile,
    metrics,
    recovery,
    recentActivities,
    today,
    userRequest: { sport, durationMin, notes },
  });

  return c.json({ workout: generated, recovery });
});

/**
 * POST /workout/:athleteId/push
 * Body: { workout: CoachOutput, date?: string }
 * Pushes the generated workout to Intervals.icu calendar.
 */
workout.post("/:athleteId/push", async (c) => {
  const body = await c.req.json<{
    workout: CoachOutput;
    date?: string;
  }>();

  const { workout: w, date } = body;
  if (!w) {
    return c.json({ error: "workout is required" }, 400);
  }

  const name = `${w.sport.charAt(0).toUpperCase() + w.sport.slice(1)} — ${w.intensity} ${w.durationMin}min`;

  const event = await createWorkoutEvent({
    name,
    sport: w.sport,
    durationMin: w.durationMin,
    description: w.workoutStructure,
    date,
  });

  return c.json({ event });
});

export default workout;
