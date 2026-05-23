import { db } from "../../db/client.js";
import type { AgentTool } from "../llm/types.js";
import type { Activity } from "../../types.js";

export const getWorkoutHistory: AgentTool<
  { athleteId: string; days?: number; sport?: string },
  Activity[]
> = {
  name: "getWorkoutHistory",
  description:
    "Fetch completed activities for the athlete. Optionally filter by sport (run, bike, swim, strength) and number of days back.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      athleteId: { type: "string" },
      days: {
        type: "number",
        description: "Days to look back (default 30, max 365)",
      },
      sport: {
        type: "string",
        description: "Filter by sport type e.g. run, bike, swim",
      },
    },
    required: ["athleteId"],
  },
  async execute({ athleteId, days = 30, sport }) {
    const since = new Date();
    since.setDate(since.getDate() - Math.min(days, 365));

    let query = db
      .from("activities")
      .select("*")
      .eq("athlete_id", athleteId)
      .gte("activity_date", since.toISOString().slice(0, 10))
      .order("activity_date", { ascending: false });

    if (sport) query = query.eq("sport", sport.toLowerCase());

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as Activity[];
  },
};
