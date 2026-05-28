/**
 * Checks if current readiness deviates significantly from expected range for training phase.
 * Only flags MAJOR deviations (not normal training fatigue).
 */

import type { ComputedMetrics } from "../../types.js";

export interface ExpectedReadiness {
  scoreRange: [number, number];
  tsbRange: [number, number];
  hrvTrend: "rising" | "stable" | "declining";
  description: string;
}

export interface DeviationCheck {
  severity: "none" | "minor" | "moderate" | "major";
  scoreDeviation: number;
  tsbDeviation: number;
  reason: string;
  expectedRange: ExpectedReadiness;
}

/**
 * Expected readiness ranges by training phase.
 * Week 2-3 should show progressive fatigue — that's NORMAL.
 * Only flag when significantly below expected range.
 */
export function getExpectedReadiness(weekType: string): ExpectedReadiness {
  const expectations: Record<string, ExpectedReadiness> = {
    base: {
      scoreRange: [75, 90],
      tsbRange: [-5, 10],
      hrvTrend: "stable",
      description: "Base week: expect fresh state with stable metrics",
    },
    build: {
      scoreRange: [65, 80],
      tsbRange: [-15, -5],
      hrvTrend: "stable",
      description: "Build week: moderate fatigue accumulation expected",
    },
    peak: {
      scoreRange: [55, 75],
      tsbRange: [-25, -10],
      hrvTrend: "declining",
      description: "Peak week: high load, declining metrics normal",
    },
    recovery: {
      scoreRange: [70, 90],
      tsbRange: [-5, 15],
      hrvTrend: "rising",
      description: "Recovery week: metrics should bounce back",
    },
  };

  return expectations[weekType] ?? expectations.base;
}

/**
 * Checks for MAJOR deviations only.
 * Minor day-to-day fluctuations within expected range are ignored.
 */
export function checkReadinessDeviation(
  metrics: ComputedMetrics,
  expected: ExpectedReadiness,
): DeviationCheck {
  const [minScore, maxScore] = expected.scoreRange;
  const [minTsb, maxTsb] = expected.tsbRange;

  // Calculate how far outside expected range (negative = within range)
  const scoreDeviation = Math.min(
    0,
    metrics.readinessScore - minScore,
    metrics.readinessScore - maxScore,
  );
  const tsbDeviation = Math.min(0, metrics.tsb - minTsb, metrics.tsb - maxTsb);

  // MAJOR deviation triggers (significantly below expected range)
  if (scoreDeviation < -20 || tsbDeviation < -10) {
    let reason = "⚠️ MAJOR deviation: ";
    const issues: string[] = [];

    if (scoreDeviation < -20) {
      issues.push(
        `readiness ${Math.abs(scoreDeviation)}pts below expected range`,
      );
    }
    if (tsbDeviation < -10) {
      issues.push(`TSB ${Math.abs(tsbDeviation)} deeper than expected`);
    }

    // Note: RHR deviation check removed - property not in ComputedMetrics type
    // If needed, add rhrDeviation to ComputedMetrics and calculate in readiness.ts

    reason += issues.join(", ") + `. ${expected.description}.`;

    return {
      severity: "major",
      scoreDeviation,
      tsbDeviation,
      reason,
      expectedRange: expected,
    };
  }

  // MODERATE deviation (somewhat below expected)
  if (scoreDeviation < -10 || tsbDeviation < -5) {
    return {
      severity: "moderate",
      scoreDeviation,
      tsbDeviation,
      reason: `Below expected readiness for this phase, but within manageable range. ${expected.description}.`,
      expectedRange: expected,
    };
  }

  // Within expected range — normal training fatigue
  return {
    severity: "none",
    scoreDeviation,
    tsbDeviation,
    reason: `Readiness within expected range for this training phase.`,
    expectedRange: expected,
  };
}
