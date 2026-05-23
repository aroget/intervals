import { structured } from "../llm/adapter.js";
import { buildCoachSystemPrompt, buildCoachUserPrompt } from "./prompt.js";
import { CoachOutputSchema, type CoachOutput } from "./schema.js";
import type { AthleteProfile, ComputedMetrics, Activity } from "../../types.js";
import type { RecoveryOutput } from "../recovery/schema.js";
import type { ComplianceReport } from "../../data/processors/workoutCompliance.js";

/**
 * Coach Agent.
 * Uses recovery analysis + athlete profile + cycle position to prescribe today's workout.
 */
export async function runCoachAgent(params: {
  profile: AthleteProfile;
  metrics: ComputedMetrics;
  recovery: RecoveryOutput;
  recentActivities: Activity[];
  today?: string;
  userRequest?: { sport?: string; durationMin?: number; notes?: string };
  upcomingWorkouts?: {
    date: string;
    sport: string;
    durationMin: number;
    intensity: string;
    periodizationPhase?: string;
  }[];
  compliance?: ComplianceReport | null;
}): Promise<CoachOutput> {
  const today = params.today ?? new Date().toISOString().slice(0, 10);

  // If the user locked a duration, override the computed daily max so the
  // prompt hard-cap matches their intent.
  const metrics = params.userRequest?.durationMin
    ? {
        ...params.metrics,
        todayMaxHours: params.userRequest.durationMin / 60,
      }
    : params.metrics;

  return structured(
    [
      { role: "system", content: buildCoachSystemPrompt(params.profile) },
      {
        role: "user",
        content: buildCoachUserPrompt({
          metrics,
          recovery: params.recovery,
          recentActivities: params.recentActivities,
          today,
          userRequest: params.userRequest,
          upcomingWorkouts: params.upcomingWorkouts,
          compliance: params.compliance,
        }),
      },
    ],
    CoachOutputSchema,
    { temperature: 1 },
  );
}
