import { db } from "../../db/client.js";
import type { AgentTool } from "../llm/types.js";

interface WorkoutSummary {
  workoutDate: string;
  sport: string | null;
  durationMin: number | null;
  intensity: string | null;
  rationale: string | null;
  periodizationPhase: string | null;
  completed: boolean;
}

export const getPrescribedWorkouts: AgentTool<
  { athleteId: string; days?: number },
  WorkoutSummary[]
> = {
  name: "getPrescribedWorkouts",
  description:
    "Fetch workouts prescribed by the Coach Agent. Use this to discuss what was planned, explain why a specific workout was chosen, or review the training structure over recent days.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      athleteId: { type: "string" },
      days: {
        type: "number",
        description: "How many days back to look (default 14, max 60)",
      },
    },
    required: ["athleteId"],
  },
  async execute({ athleteId, days = 14 }) {
    const since = new Date();
    since.setDate(since.getDate() - Math.min(days, 60));

    const { data, error } = await db
      .from("prescribed_workouts")
      .select(
        "workout_date, sport, duration_min, intensity, rationale, agent_output, completed",
      )
      .eq("athlete_id", athleteId)
      .gte("workout_date", since.toISOString().slice(0, 10))
      .order("workout_date", { ascending: false });

    if (error) throw new Error(error.message);

    return ((data ?? []) as Record<string, unknown>[]).map((row) => {
      const out = (row.agent_output as Record<string, unknown>) ?? {};
      return {
        workoutDate: row.workout_date as string,
        sport: row.sport as string | null,
        durationMin: row.duration_min as number | null,
        intensity: row.intensity as string | null,
        rationale: row.rationale as string | null,
        periodizationPhase: (out.periodizationPhase as string) ?? null,
        completed: row.completed as boolean,
      };
    });
  },
};
