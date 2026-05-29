/**
 * Tool: getReadinessPrediction
 * Predicts tomorrow's readiness based on current metrics
 */
import { loadWellness, loadActivities, loadProfile } from "../../db/loaders.js";
import { buildComputedMetrics } from "../../data/processors/readiness.js";
import { predictTomorrowReadiness } from "../../data/processors/readinessPrediction.js";
import type { AgentTool } from "../llm/types.js";

export const getReadinessPrediction: AgentTool<{ athleteId: string }, string> =
  {
    name: "getReadinessPrediction",
    description:
      "Predict tomorrow's readiness level to help athlete plan ahead",
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
      const profile = await loadProfile(athleteId);
      if (!profile.cycleStartDate) {
        return "Cannot predict readiness - cycle start date not set.";
      }

      const [wellness, activities] = await Promise.all([
        loadWellness(athleteId, 30),
        loadActivities(athleteId, 30),
      ]);

      const today = new Date().toISOString().slice(0, 10);
      const metrics = buildComputedMetrics({
        logs: wellness,
        activities,
        cycleStartDate: profile.cycleStartDate,
        weeklyMaxHours: profile.weeklyMaxHours,
        today,
      });

      const prediction = predictTomorrowReadiness(
        metrics,
        activities,
        wellness,
      );

      let result = `Tomorrow's Predicted Readiness: ${prediction.tomorrowReadiness.toUpperCase()} (${Math.round(prediction.confidence * 100)}% confidence)\n\n`;
      result += `Reasoning:\n${prediction.reasoning.map((r) => `- ${r}`).join("\n")}\n`;

      if (prediction.suggestedAction) {
        result += `\nSuggestion: ${prediction.suggestedAction}`;
      }

      return result;
    },
  };
