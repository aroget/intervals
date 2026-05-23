import { replanWeekWorkouts } from "../daily.js";
import type { AgentTool } from "../llm/types.js";

/**
 * Replans the upcoming week of workouts based on context the athlete provides
 * in the chat (e.g. challenging terrain, travel, schedule change).
 * Runs the Coach Agent sequentially for each day so sport rotation and
 * intensity spacing are respected across the whole week.
 */
export const replanWeek: AgentTool<
  { athleteId: string; notes: string; fromDate?: string },
  string
> = {
  name: "replanWeek",
  description:
    "Regenerate the full upcoming week of prescribed workouts (up to 7 days) when the athlete's situation requires multiple sessions to change — e.g. challenging terrain, travel, schedule conflict, injury risk, or a change in training focus. Always confirm with the athlete before calling this. Provide clear notes summarising the reason and any constraints.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      athleteId: { type: "string" },
      notes: {
        type: "string",
        description:
          "Context for the replanning, e.g. 'athlete will be hiking in the mountains all week — reduce run volume, favour strength and easy hikes, no hard sessions'",
      },
      fromDate: {
        type: "string",
        description:
          "First date to replan in YYYY-MM-DD format. Defaults to today if omitted.",
      },
    },
    required: ["athleteId", "notes"],
  },
  async execute({ athleteId, notes, fromDate }) {
    const from = fromDate ?? new Date().toISOString().slice(0, 10);
    const planned = await replanWeekWorkouts(athleteId, from, notes);
    const lines = planned.map(
      (w: any) =>
        `  ${w.date}: ${w.durationMin}min ${w.sport} (${w.intensity})`,
    );
    return `Week replanned successfully from ${from}:\n${lines.join("\n")}`;
  },
};
