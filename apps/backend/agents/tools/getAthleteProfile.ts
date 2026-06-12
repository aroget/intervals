import { loadProfile } from "../../db/loaders.js";
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
    try {
      return await loadProfile(athleteId);
    } catch (error) {
      return null;
    }
  },
};
