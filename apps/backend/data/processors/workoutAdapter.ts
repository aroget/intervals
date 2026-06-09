/**
 * Workout adaptation logic: suggests modifications when prescribed load exceeds current capacity.
 * Does not auto-apply — athlete/coach decides via UI.
 */

export interface TrainingCapacity {
  maxTssPerHour: number;
  maxDurationMin: number;
  allowedIntensities: ("rest" | "easy" | "moderate" | "hard" | "threshold")[];
  reasoning: string;
}

export interface WorkoutSuggestion {
  shouldAdapt: boolean;
  severity: "none" | "minor" | "moderate" | "major";
  suggestedIntensity: string;
  suggestedDurationMin: number;
  reasoning: string;
  capacityGap: number; // % over capacity (negative = under)
}

/**
 * Sport-specific TSS/hour estimates.
 * Cycling baseline, running ≈70%, swimming ≈60% (less accurate without power).
 */
const TSS_PER_HOUR: Record<string, Record<string, number>> = {
  bike: { rest: 0, easy: 40, moderate: 65, hard: 85, threshold: 95 },
  run: { rest: 0, easy: 30, moderate: 50, hard: 65, threshold: 75 },
  swim: { rest: 0, easy: 25, moderate: 45, hard: 60, threshold: 70 },
  strength: { rest: 0, easy: 20, moderate: 40, hard: 60, threshold: 70 },
};

export function estimateTss(
  sport: string,
  intensity: string,
  durationMin: number,
): number {
  const sportMap = TSS_PER_HOUR[sport] ?? TSS_PER_HOUR.bike;
  const tssPerHour = sportMap[intensity] ?? 50;
  return tssPerHour * (durationMin / 60);
}

/**
 * Generates a suggested adaptation if prescribed workout exceeds current capacity.
 * Returns severity level to help athlete decide if override is reasonable.
 */
export function suggestAdaptation(
  prescribed: {
    sport: string;
    durationMin: number;
    intensity: string;
  },
  capacity: TrainingCapacity,
  recoveryReadiness: "high" | "moderate" | "low" | "rest",
): WorkoutSuggestion {
  const prescribedTss = estimateTss(
    prescribed.sport,
    prescribed.intensity,
    prescribed.durationMin,
  );
  const maxTss = capacity.maxTssPerHour * (capacity.maxDurationMin / 60);
  const capacityGap =
    maxTss > 0 ? ((prescribedTss - maxTss) / maxTss) * 100 : 100;

  // Check intensity compatibility
  const intensityAllowed = capacity.allowedIntensities.includes(
    prescribed.intensity as any,
  );

  // No adaptation needed (10% tolerance)
  if (intensityAllowed && prescribedTss <= maxTss * 1.1) {
    return {
      shouldAdapt: false,
      severity: "none",
      suggestedIntensity: prescribed.intensity,
      suggestedDurationMin: prescribed.durationMin,
      reasoning: "Within current capacity — proceed as planned",
      capacityGap,
    };
  }

  // Determine severity
  let severity: "minor" | "moderate" | "major" = "minor";
  if (capacityGap > 50 || recoveryReadiness === "rest") severity = "major";
  else if (capacityGap > 25 || !intensityAllowed) severity = "moderate";

  // Generate suggestion
  let suggestedIntensity = prescribed.intensity;
  let suggestedDuration = prescribed.durationMin;

  // Step 1: Lower intensity if not allowed
  if (!intensityAllowed) {
    const allowed = capacity.allowedIntensities;
    suggestedIntensity = allowed[allowed.length - 1];
  }

  // Step 2: Scale duration to fit capacity
  const suggestedTssPerHour = estimateTss(
    prescribed.sport,
    suggestedIntensity,
    60,
  );
  const maxDurationForCapacity =
    suggestedTssPerHour > 0 ? (maxTss / suggestedTssPerHour) * 60 * 0.95 : 30; // 5% buffer
  suggestedDuration = Math.min(
    Math.floor(maxDurationForCapacity),
    capacity.maxDurationMin,
    prescribed.durationMin,
  );

  // Minimum 20min (or rest)
  if (suggestedIntensity !== "rest" && suggestedDuration < 20) {
    suggestedDuration = 20;
  }

  let reasoning = "";
  if (severity === "major") {
    reasoning = `⚠️ MAJOR mismatch: Prescribed ${prescribed.intensity} significantly exceeds current ${recoveryReadiness} readiness. ${capacity.reasoning}. Strongly suggest adapting to ${suggestedDuration}min ${suggestedIntensity}.`;
  } else if (severity === "moderate") {
    reasoning = `⚠️ Prescribed ${prescribed.durationMin}min ${prescribed.intensity} is ${Math.round(capacityGap)}% over capacity. Consider ${suggestedDuration}min ${suggestedIntensity} instead.`;
  } else {
    reasoning = `Prescribed workout is slightly above optimal capacity. ${suggestedDuration}min ${suggestedIntensity} would be more conservative.`;
  }

  return {
    shouldAdapt: true,
    severity,
    suggestedIntensity,
    suggestedDurationMin: suggestedDuration,
    reasoning,
    capacityGap,
  };
}
