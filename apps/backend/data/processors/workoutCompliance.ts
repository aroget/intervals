/**
 * Compares a prescribed workout against what the athlete actually did.
 * All logic is deterministic — no LLM involvement.
 */

import type { Activity } from "../../types.js";
import { estimateTss } from "./workoutAdapter.js";
import { normalizeSport } from "../intervals/mapper.js";

export interface PrescribedSummary {
  date: string;
  sport: string | null;
  durationMin: number | null;
  intensity: string | null; // easy | moderate | hard | rest
}

export interface ActualActivity {
  date: string;
  sport: string | null;
  durationSecs: number | null;
  tss: number | null;
  intensityFactor: number | null;
  avgHr: number | null;
  rpe: number | null; // 1–10 (Intervals.icu "feel" field)
  athleteComments: string | null;
}

export interface ComplianceReport {
  date: string;
  wasRestDay: boolean; // no activity found for the day
  sportMatch: boolean | null; // null if prescribed was rest
  durationDeltaMin: number | null; // actual - prescribed (positive = over, negative = under)
  durationDeltaPct: number | null; // % deviation from prescription
  rpe: number | null; // athlete-reported RPE
  athleteComments: string | null;
  complianceSummary: string; // human-readable one-liner for the prompt
}

export function buildComplianceReport(
  prescribed: PrescribedSummary,
  actual: ActualActivity | null,
): ComplianceReport {
  // No activity logged → rest day
  if (!actual) {
    const wasRest = prescribed.intensity === "rest";
    return {
      date: prescribed.date,
      wasRestDay: true,
      sportMatch: null,
      durationDeltaMin: null,
      durationDeltaPct: null,
      rpe: null,
      athleteComments: null,
      complianceSummary: wasRest
        ? "Rest day as prescribed — no activity logged."
        : `Missed session (${prescribed.sport ?? "unknown"}, ${prescribed.durationMin ?? "?"} min, ${prescribed.intensity}) — no activity found. Treat as unplanned rest.`,
    };
  }

  const prescribedMin = prescribed.durationMin ?? null;
  const actualMin =
    actual.durationSecs != null ? Math.round(actual.durationSecs / 60) : null;
  const durationDeltaMin =
    actualMin != null && prescribedMin != null
      ? actualMin - prescribedMin
      : null;
  const durationDeltaPct =
    durationDeltaMin != null && prescribedMin != null && prescribedMin > 0
      ? Math.round((durationDeltaMin / prescribedMin) * 100)
      : null;

  const sportMatch =
    prescribed.sport != null && actual.sport != null
      ? normalizeSport(actual.sport) === normalizeSport(prescribed.sport)
      : null;

  const parts: string[] = [];

  if (prescribed.intensity === "rest") {
    parts.push(
      `Trained despite rest prescription (${actual.sport ?? "unknown"}, ${actualMin ?? "?"} min)`,
    );
  } else {
    if (!sportMatch && sportMatch !== null) {
      parts.push(
        `Sport mismatch: prescribed ${prescribed.sport}, did ${actual.sport}`,
      );
    }
    if (durationDeltaPct != null) {
      if (Math.abs(durationDeltaPct) <= 10) {
        parts.push(
          `Duration on target (${actualMin} min vs ${prescribedMin} min prescribed)`,
        );
      } else if (durationDeltaPct < -10) {
        parts.push(
          `Cut short by ${Math.abs(durationDeltaPct)}% (${actualMin} min vs ${prescribedMin} min prescribed)`,
        );
      } else {
        parts.push(
          `Exceeded by ${durationDeltaPct}% (${actualMin} min vs ${prescribedMin} min prescribed)`,
        );
      }
    }
    if (actual.rpe != null) {
      const intensityLabel = prescribed.intensity ?? "unknown";
      const rpeHint = rpeVsIntensity(actual.rpe, intensityLabel);
      parts.push(`RPE ${actual.rpe}/10${rpeHint ? " (" + rpeHint + ")" : ""}`);
    }
    if (actual.athleteComments) {
      parts.push(`Athlete note: "${actual.athleteComments}"`);
    }
  }

  return {
    date: prescribed.date,
    wasRestDay: false,
    sportMatch,
    durationDeltaMin,
    durationDeltaPct,
    rpe: actual.rpe,
    athleteComments: actual.athleteComments,
    complianceSummary: parts.join(" · ") || "Completed.",
  };
}

// Sport normalization now uses centralized function from mapper.ts

function rpeVsIntensity(rpe: number, intensity: string): string {
  // Flag mismatches between prescribed intensity and felt RPE
  if (intensity === "easy" && rpe >= 7)
    return "harder than easy — check intensity";
  if (intensity === "hard" && rpe <= 4) return "felt easier than expected";
  if (intensity === "moderate" && rpe >= 9)
    return "felt very hard for a moderate session";
  return "";
}
