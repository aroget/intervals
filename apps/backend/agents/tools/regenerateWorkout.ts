import { db } from "../../db/client.js";
import { buildComputedMetrics } from "../../data/processors/readiness.js";
import { runCoachAgent } from "../coach/agent.js";
import type { AgentTool } from "../llm/types.js";
import type { Activity, AthleteProfile, WellnessLog } from "../../types.js";

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
    const [profileResult, wellnessResult, activitiesResult, weekContextResult] =
      await Promise.all([
        db
          .from("athlete_profiles")
          .select("*")
          .eq("athlete_id", athleteId)
          .single(),
        db
          .from("wellness_logs")
          .select("*")
          .eq("athlete_id", athleteId)
          .gte(
            "log_date",
            (() => {
              const d = new Date(date);
              d.setDate(d.getDate() - 60);
              return d.toISOString().slice(0, 10);
            })(),
          )
          .order("log_date", { ascending: true }),
        db
          .from("activities")
          .select("*")
          .eq("athlete_id", athleteId)
          .gte(
            "activity_date",
            (() => {
              const d = new Date(date);
              d.setDate(d.getDate() - 90);
              return d.toISOString().slice(0, 10);
            })(),
          )
          .order("activity_date", { ascending: true }),
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

    if (profileResult.error || !profileResult.data) {
      throw new Error("Could not load athlete profile");
    }

    const raw = profileResult.data;
    const profile: AthleteProfile = {
      id: raw.id,
      athleteId: raw.athlete_id,
      name: raw.name,
      goals: raw.goals,
      trainingPhilosophy: raw.training_philosophy,
      disciplines: raw.disciplines ?? [],
      weeklyMaxHours: raw.weekly_max_hours ?? {},
      preferredMetrics: raw.preferred_metrics ?? [],
      cycleStartDate: raw.cycle_start_date,
      ftp: raw.ftp ?? null,
      runningThresholdPace: raw.running_threshold_pace ?? null,
      lthr: raw.lthr ?? null,
    };

    const logs: WellnessLog[] = (wellnessResult.data ?? []).map((r: any) => ({
      id: r.id,
      athleteId: r.athlete_id,
      logDate: r.log_date,
      hrv: r.hrv,
      hrvScore: r.hrv_score,
      rhr: r.rhr,
      sleepScore: r.sleep_score,
      sleepHours: r.sleep_hours,
      sleepQuality: r.sleep_quality,
    }));

    const activities: Activity[] = (activitiesResult.data ?? []).map(
      (r: any) => ({
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
      }),
    );

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
