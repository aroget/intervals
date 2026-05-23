import { db } from "../../db/client.js";
import type { AgentTool } from "../llm/types.js";
import {
  getCyclePosition,
  getDayOfWeek,
} from "../../data/processors/cycleTracker.js";

interface CycleInfo {
  weekNumber: 1 | 2 | 3 | 4;
  weekType: string;
  dayOfCycle: number;
  daysRemainingInWeek: number;
  isRecoveryWeek: boolean;
  todayMaxHours: number;
  dayOfWeek: string;
}

export const getCyclePosition_tool: AgentTool<
  { athleteId: string; today?: string },
  CycleInfo | null
> = {
  name: "getCyclePosition",
  description:
    "Get the current position within the 4-week training cycle (week 1=base, 2=build, 3=peak, 4=recovery) and the athlete's max training hours for today.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      athleteId: { type: "string" },
      today: {
        type: "string",
        description: "ISO date override (default: today)",
      },
    },
    required: ["athleteId"],
  },
  async execute({ athleteId, today }) {
    const { data, error } = await db
      .from("athlete_profiles")
      .select("cycle_start_date, weekly_max_hours")
      .eq("athlete_id", athleteId)
      .single();

    if (error || !data?.cycle_start_date) return null;

    const targetDate = today ?? new Date().toISOString().slice(0, 10);
    const position = getCyclePosition(
      data.cycle_start_date as string,
      targetDate,
    );
    const dayName = getDayOfWeek(targetDate);
    const weeklyMaxHours =
      (data.weekly_max_hours as Record<string, number>) ?? {};

    return {
      ...position,
      todayMaxHours: weeklyMaxHours[dayName] ?? 1,
      dayOfWeek: dayName,
    };
  },
};
