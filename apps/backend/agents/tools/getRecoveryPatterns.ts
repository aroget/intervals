/**
 * Tool: getRecoveryPatterns
 * Returns detected recovery patterns for the athlete
 */
import { loadWellness, loadActivities } from "../../db/loaders.js";
import { analyzeAllRecoveryPatterns } from "../../data/processors/recoveryPatterns.js";
import type { AgentTool } from "../llm/types.js";

export const getRecoveryPatterns: AgentTool<{ athleteId: string }, string> = {
  name: "getRecoveryPatterns",
  description:
    "Get detected recovery patterns for the athlete (e.g., HRV response to key workouts, recovery days needed)",
  parametersJsonSchema: {
    type: "object",
    properties: {
      athleteId: {
        type: "string",
        description: "The athlete's ID",
      },
    },
    required: ["athleteId"],
  },
  async execute({ athleteId }) {
    const [wellness, activities] = await Promise.all([
      loadWellness(athleteId, 90),
      loadActivities(athleteId, 90),
    ]);

    const patterns = analyzeAllRecoveryPatterns(wellness, activities);

    if (patterns.length === 0) {
      return "No recovery patterns detected yet. More training history needed (at least 5-8 weeks of data).";
    }

    const formatted = patterns
      .map(
        (p) =>
          `- ${p.description} (confidence: ${Math.round(p.confidence * 100)}%)`,
      )
      .join("\n");

    return `Detected Recovery Patterns:\n${formatted}\n\nUse these insights to inform training recommendations and recovery advice.`;
  },
};
