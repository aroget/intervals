import { db } from "../../db/client.js";
import type { AgentTool } from "../llm/types.js";
import type { AthleteProfile } from "../../types.js";

export const getAthleteProfile: AgentTool<
  { athleteId: string },
  AthleteProfile | null
> = {
  name: "getAthleteProfile",
  description:
    "Fetch the athlete profile including goals, training philosophy, weekly max hours, and disciplines.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      athleteId: { type: "string" },
    },
    required: ["athleteId"],
  },
  async execute({ athleteId }) {
    const { data, error } = await db
      .from("athlete_profiles")
      .select("*")
      .eq("athlete_id", athleteId)
      .single();

    if (error) return null;
    return data as unknown as AthleteProfile;
  },
};
