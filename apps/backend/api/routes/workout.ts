import { Hono } from "hono";
import { db } from "../../db/client.js";
import { loadProfile, loadWellness, loadActivities } from "../../db/loaders.js";
import { buildComputedMetrics } from "../../data/processors/readiness.js";
import { runRecoveryAgent } from "../../agents/recovery/agent.js";
import { runCoachAgent } from "../../agents/coach/agent.js";
import { createWorkoutEvent } from "../../data/intervals/client.js";
import type { CoachOutput } from "../../agents/coach/schema.js";

const workout = new Hono();

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
