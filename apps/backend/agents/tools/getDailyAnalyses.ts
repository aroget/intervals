import { db } from "../../db/client.js";
import type { AgentTool } from "../llm/types.js";

interface AnalysisSummary {
  analysisDate: string;
  readinessScore: number;
  hrvTrend: string | null;
  readiness: string;
  summary: string;
  flags: string[];
  recommendation: string;
}

export const getDailyAnalyses: AgentTool<
  { athleteId: string; days?: number },
  AnalysisSummary[]
> = {
  name: "getDailyAnalyses",
  description:
    "Fetch past daily recovery analyses produced by the Recovery Agent. Returns readiness scores, HRV trends, flags, and recommendations. Use this to discuss trends in recovery over time.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      athleteId: { type: "string" },
      days: {
        type: "number",
        description: "How many days back to look (default 14, max 60)",
      },
    },
    required: ["athleteId"],
  },
  async execute({ athleteId, days = 14 }) {
    const since = new Date();
    since.setDate(since.getDate() - Math.min(days, 60));

    const { data, error } = await db
      .from("daily_analyses")
      .select("analysis_date, readiness_score, hrv_trend, agent_output")
      .eq("athlete_id", athleteId)
      .gte("analysis_date", since.toISOString().slice(0, 10))
      .order("analysis_date", { ascending: false });

    if (error) throw new Error(error.message);

    return ((data ?? []) as Record<string, unknown>[]).map((row) => {
      const out = (row.agent_output as Record<string, unknown>) ?? {};
      return {
        analysisDate: row.analysis_date as string,
        readinessScore: row.readiness_score as number,
        hrvTrend: row.hrv_trend as string | null,
        readiness: (out.readiness as string) ?? "unknown",
        summary: (out.summary as string) ?? "",
        flags: (out.flags as string[]) ?? [],
        recommendation: (out.recommendation as string) ?? "",
      };
    });
  },
};
