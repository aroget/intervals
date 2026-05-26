import { db } from "../../db/client.js";
import { loadProfile, loadWellness, loadActivities } from "../../db/loaders.js";
import { buildComputedMetrics } from "../../data/processors/readiness.js";
import { runCoachAgent } from "../coach/agent.js";
import type { AgentTool } from "../llm/types.js";

/**
 * Regenerates the prescribed workout for a specific date using the coach agent,
 * incorporating the athlete's instructions (change sport, duration, intensity, etc.).
 * Replaces the existing prescription for that date in the DB.
 */
export const regenerateWorkout: AgentTool<
  { athleteId: string; date: string; notes: string },
  string
> = {
  name: "regenerateWorkout",
  description:
    "Regenerate the prescribed workout for a specific day, incorporating the athlete's instructions. Use when the athlete wants to change the sport, duration, intensity, or overall nature of a planned session. Provide the date in YYYY-MM-DD format and clear notes describing what they want.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      athleteId: { type: "string" },
      date: {
        type: "string",
        description: "The date to regenerate (YYYY-MM-DD)",
      },
      notes: {
        type: "string",
        description:
          "The athlete's instructions, e.g. 'make it a bike ride instead of a run, keep it easy' or 'I can only do 30 minutes today'",
      },
    },
    required: ["athleteId", "date", "notes"],
  },
  async execute({ athleteId, date, notes }) {
    // Load profile, wellness, activities in parallel
    const [profile, logs, activities, weekContextResult] = await Promise.all([
      loadProfile(athleteId),
      loadWellness(athleteId, 60, date),
      loadActivities(athleteId, 90, date),
      // Load the rest of the week for sport-rotation context (excluding the target date)
      db
        .from("prescribed_workouts")
        .select("workout_date, sport, duration_min, intensity, agent_output")
        .eq("athlete_id", athleteId)
        .neq("workout_date", date)
        .gte(
          "workout_date",
          (() => {
            const d = new Date(date);
            d.setDate(d.getDate() - 3);
            return d.toISOString().slice(0, 10);
          })(),
        )
        .lte(
          "workout_date",
          (() => {
            const d = new Date(date);
            d.setDate(d.getDate() + 3);
            return d.toISOString().slice(0, 10);
          })(),
        )
        .order("workout_date", { ascending: true }),
    ]);

    const upcomingWorkouts = (weekContextResult.data ?? []).map((w: any) => ({
      date: w.workout_date as string,
      sport: w.sport as string,
      durationMin: w.duration_min as number,
      intensity: w.intensity as string,
      periodizationPhase: (w.agent_output as { periodizationPhase?: string })
        ?.periodizationPhase,
    }));

    if (!profile.cycleStartDate) {
      throw new Error("Athlete profile missing cycle_start_date");
    }

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
      recovery: {
        readiness:
          metrics.readinessScore >= 70
            ? "high"
            : metrics.readinessScore >= 50
              ? "moderate"
              : "low",
        summary: "Regenerated on athlete request.",
        yesterdayImpact: "No recovery data available.",
        trainingImplication: notes,
        recommendation: notes,
        flags: [],
        confidence: 0.8,
      },
      recentActivities: activities.slice(-14),
      today: date,
      userRequest: { notes },
      upcomingWorkouts,
    });

    // Delete existing prescription for this date, then insert the new one
    await db
      .from("prescribed_workouts")
      .delete()
      .eq("athlete_id", athleteId)
      .eq("workout_date", date);

    await db.from("prescribed_workouts").insert({
      athlete_id: athleteId,
      workout_date: date,
      sport: workout.sport,
      duration_min: workout.durationMin,
      intensity: workout.intensity,
      structure: workout.workoutStructure,
      rationale: workout.rationale,
      agent_output: workout,
    });

    return (
      `Updated ${date}: ${workout.durationMin} min ${workout.sport} (${workout.intensity}).\n` +
      `${workout.rationale ?? ""}\n` +
      (workout.workoutStructure
        ? `\nWorkout structure:\n${workout.workoutStructure}`
        : "")
    ).trim();
  },
};
