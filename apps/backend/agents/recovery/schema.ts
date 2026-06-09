import { z } from "zod";

export const RecoveryOutputSchema = z.object({
  readiness: z.enum(["high", "moderate", "low", "rest"]),
  summary: z
    .string()
    .describe("2-3 sentence plain-language summary of today's recovery status"),
  yesterdayImpact: z
    .string()
    .describe(
      "1-2 sentences on how yesterday's session (or rest day) has impacted today's physiological state — HRV, fatigue, muscle readiness. If no session, say so explicitly.",
    ),
  trainingImplication: z
    .string()
    .describe(
      "1-2 sentences on what the recovery state means for today's workout and the overall week plan.",
    ),
  flags: z
    .array(z.string())
    .describe(
      'Specific concerns e.g. "HRV declining 3 days", "poor sleep trend"',
    ),
  recommendation: z
    .string()
    .describe("One-sentence action recommendation for the coach agent"),
  blockScoreExplanation: z
    .string()
    .optional()
    .describe(
      "1-2 sentences explaining the current block effectiveness score (only if blockEffectiveness metric is available). Be specific about patterns like compliance rate, missed workouts, or fitness trajectory.",
    ),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("How confident is this analysis (0–1) given data quality"),
});

export type RecoveryOutput = z.infer<typeof RecoveryOutputSchema>;
