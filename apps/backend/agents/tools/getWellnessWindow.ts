import { db } from "../../db/client.js";
import type { AgentTool } from "../llm/types.js";
import type { WellnessLog } from "../../types.js";

export const getWellnessWindow: AgentTool<
  { days: number; athleteId: string },
  WellnessLog[]
> = {
  name: "getWellnessWindow",
  description:
    "Fetch wellness logs (HRV, RHR, sleep score) for the last N days. Use this to look up recent recovery data.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      athleteId: { type: "string", description: "Athlete ID" },
      days: {
        type: "number",
        description: "Number of days to look back (max 90)",
      },
    },
    required: ["athleteId", "days"],
  },
  async execute({ athleteId, days }) {
    const since = new Date();
    since.setDate(since.getDate() - Math.min(days, 90));
    const { data, error } = await db
      .from("wellness_logs")
      .select("*")
      .eq("athlete_id", athleteId)
      .gte("log_date", since.toISOString().slice(0, 10))
      .order("log_date", { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as WellnessLog[];
  },
};
