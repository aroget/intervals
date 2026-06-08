import { structured } from "../llm/adapter.js";
import {
  buildRecoverySystemPrompt,
  buildRecoveryUserPrompt,
} from "./prompt.js";
import { RecoveryOutputSchema, type RecoveryOutput } from "./schema.js";
import type { ComputedMetrics } from "../../types.js";

/**
 * Recovery Analysis Agent.
 * Receives pre-computed metrics (no raw numbers) and returns a structured readiness assessment.
 */
export interface YesterdayActivity {
  sport: string | null;
  durationSecs: number | null;
  tss: number | null;
  intensityFactor: number | null;
  avgHr: number | null;
}

export async function runRecoveryAgent(
  metrics: ComputedMetrics,
  today: string = new Date().toISOString().slice(0, 10),
  yesterdayActivity?: YesterdayActivity | null,
  coachingNotes?: string | null,
): Promise<RecoveryOutput> {
  return structured(
    [
      { role: "system", content: buildRecoverySystemPrompt() },
      {
        role: "user",
        content: buildRecoveryUserPrompt(
          metrics,
          today,
          yesterdayActivity,
          coachingNotes,
        ),
      },
    ],
    RecoveryOutputSchema,
    { temperature: 0.2 },
  );
}
