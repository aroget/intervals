/**
 * Tool: getComplianceFrictions
 * Detects patterns in workout compliance issues
 */
import { db } from "../../db/client.js";
import { loadActivities } from "../../db/loaders.js";
import { detectAllComplianceFrictions } from "../../data/processors/complianceFriction.js";
import type { AgentTool } from "../llm/types.js";

export const getComplianceFrictions: AgentTool<{ athleteId: string }, string> =
  {
    name: "getComplianceFrictions",
    description:
      "Identify compliance friction points (e.g., skipped key sessions, sport avoidance) to proactively address barriers",
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
      // Get last 28 days
      const since = new Date();
      since.setDate(since.getDate() - 28);
      const sinceStr = since.toISOString().slice(0, 10);

      const [{ data: workouts }, activities] = await Promise.all([
        db
          .from("prescribed_workouts")
          .select("workout_date, sport, duration_min, intensity, session_type")
          .eq("athlete_id", athleteId)
          .gte("workout_date", sinceStr)
          .order("workout_date", { ascending: true }),
        loadActivities(athleteId, 28),
      ]);

      if (!workouts || workouts.length === 0) {
        return "No prescribed workouts in the last 28 days to analyze.";
      }

      const frictions = detectAllComplianceFrictions(workouts, activities);

      if (frictions.length === 0) {
        return "No compliance friction patterns detected. Athlete is following the plan well.";
      }

      const formatted = frictions
        .map((f) => {
          return `**${f.severity.toUpperCase()} Priority**\n${f.description}\n→ ${f.actionable}`;
        })
        .join("\n\n");

      return `Detected Compliance Frictions:\n\n${formatted}\n\nUse this to guide conversation and adjust future prescriptions.`;
    },
  };
