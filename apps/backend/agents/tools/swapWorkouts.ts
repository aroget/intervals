import { db } from "../../db/client.js";
import type { AgentTool } from "../llm/types.js";

/**
 * Swaps two prescribed workouts by date.
 * The sport, duration, intensity, and full agent_output of each day are exchanged.
 */
export const swapWorkouts: AgentTool<
  { athleteId: string; date1: string; date2: string },
  string
> = {
  name: "swapWorkouts",
  description:
    "Swap two days in the prescribed training plan. Use when the athlete wants to do tomorrow's workout today, or exchange any two days. Provide both dates in YYYY-MM-DD format.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      athleteId: { type: "string" },
      date1: {
        type: "string",
        description: "First date (YYYY-MM-DD), e.g. today's date",
      },
      date2: {
        type: "string",
        description: "Second date (YYYY-MM-DD), e.g. tomorrow's date",
      },
    },
    required: ["athleteId", "date1", "date2"],
  },
  async execute({ athleteId, date1, date2 }) {
    const { data, error } = await db
      .from("prescribed_workouts")
      .select(
        "id, workout_date, sport, duration_min, intensity, agent_output, rationale",
      )
      .eq("athlete_id", athleteId)
      .in("workout_date", [date1, date2])
      .order("workout_date", { ascending: true });

    if (error) throw new Error(`DB error: ${error.message}`);

    const w1 = data?.find((r: any) => r.workout_date === date1);
    const w2 = data?.find((r: any) => r.workout_date === date2);

    if (!w1) throw new Error(`No prescribed workout found for ${date1}`);
    if (!w2) throw new Error(`No prescribed workout found for ${date2}`);

    // Swap: write w2's content into w1's date, and vice versa
    const [r1, r2] = await Promise.all([
      db
        .from("prescribed_workouts")
        .update({
          sport: w2.sport,
          duration_min: w2.duration_min,
          intensity: w2.intensity,
          agent_output: w2.agent_output,
          rationale: w2.rationale,
        })
        .eq("id", w1.id),
      db
        .from("prescribed_workouts")
        .update({
          sport: w1.sport,
          duration_min: w1.duration_min,
          intensity: w1.intensity,
          agent_output: w1.agent_output,
          rationale: w1.rationale,
        })
        .eq("id", w2.id),
    ]);

    if (r1.error)
      throw new Error(`Failed to update ${date1}: ${r1.error.message}`);
    if (r2.error)
      throw new Error(`Failed to update ${date2}: ${r2.error.message}`);

    return (
      `Swapped workouts:\n` +
      `  ${date1}: now ${w2.sport ?? "rest"} ${w2.duration_min ? `(${w2.duration_min} min, ${w2.intensity})` : ""}\n` +
      `  ${date2}: now ${w1.sport ?? "rest"} ${w1.duration_min ? `(${w1.duration_min} min, ${w1.intensity})` : ""}`
    );
  },
};
