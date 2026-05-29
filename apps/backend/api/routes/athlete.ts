import { Hono } from "hono";
import { z } from "zod";
import { db } from "../../db/client.js";
import { loadActivities } from "../../db/loaders.js";

const athlete = new Hono();

const ProfileSchema = z.object({
  athleteId: z.string(),
  name: z.string(),
  goals: z.string().optional(),
  trainingPhilosophy: z.string().optional(),
  disciplines: z.array(z.enum(["swim", "bike", "run", "strength"])).optional(),
  weeklyMaxHours: z.record(z.string(), z.number()).optional(),
  preferredMetrics: z.array(z.string()).optional(),
  cycleStartDate: z.string().optional(),
  ftp: z.number().int().positive().nullable().optional(),
  runningThresholdPace: z.number().int().positive().nullable().optional(),
  lthr: z.number().int().positive().nullable().optional(),
});

/** GET /athlete/:athleteId */
athlete.get("/:athleteId", async (c) => {
  const { data, error } = await db
    .from("athlete_profiles")
    .select("*")
    .eq("athlete_id", c.req.param("athleteId"))
    .single();

  if (error) return c.json({ error: "Not found" }, 404);
  return c.json({ profile: data });
});

/** PUT /athlete — create or update profile */
athlete.put("/", async (c) => {
  const body = ProfileSchema.parse(await c.req.json());

  const { error } = await db.from("athlete_profiles").upsert(
    {
      athlete_id: body.athleteId,
      name: body.name,
      goals: body.goals,
      training_philosophy: body.trainingPhilosophy,
      disciplines: body.disciplines,
      weekly_max_hours: body.weeklyMaxHours,
      preferred_metrics: body.preferredMetrics,
      cycle_start_date: body.cycleStartDate,
      ftp: body.ftp ?? undefined,
      running_threshold_pace: body.runningThresholdPace ?? undefined,
      lthr: body.lthr ?? undefined,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "athlete_id" },
  );

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ success: true });
});

/** DELETE /athlete/:athleteId — remove all athlete data from DB */
athlete.delete("/:athleteId", async (c) => {
  const athleteId = c.req.param("athleteId");
  const { error } = await db
    .from("athlete_profiles")
    .delete()
    .eq("athlete_id", athleteId);

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ success: true });
});

/** GET /athlete/:athleteId/activities — get activities with optional days filter */
athlete.get("/:athleteId/activities", async (c) => {
  const athleteId = c.req.param("athleteId");
  const days = parseInt(c.req.query("days") ?? "30", 10);

  try {
    const activities = await loadActivities(athleteId, days);
    return c.json({ activities });
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

export default athlete;
