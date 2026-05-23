import { Activity } from "../../types.js";

/**
 * Banister impulse-response model for training load.
 *
 * Prefers Intervals.icu's own ATL/CTL values (icu_atl, icu_ctl) from the most
 * recent activity when available — these are computed by Intervals with full
 * historical data and calibrated thresholds.
 *
 * Falls back to a local EWMA calculation when Intervals values are absent
 * (e.g. activities without a TSS, or before first sync).
 *
 * ATL (Acute Training Load)   = 7-day EWMA TSS  → "fatigue"
 * CTL (Chronic Training Load) = 42-day EWMA TSS → "fitness"
 * TSB (Training Stress Balance) = CTL - ATL      → "form"
 */
export function computeTrainingLoad(activities: Activity[]): {
  atl: number;
  ctl: number;
  tsb: number;
} {
  if (!activities.length) return { atl: 0, ctl: 0, tsb: 0 };

  // Use Intervals.icu's own values from the most recent activity that has them.
  // Skip entries where ctl=0 — Intervals returns 0 when the load hasn't been
  // computed yet (e.g. immediately after upload). A non-zero CTL is required
  // because a training athlete can never have a true chronic load of zero.
  for (let i = activities.length - 1; i >= 0; i--) {
    const a = activities[i];
    if (a.atl != null && a.ctl != null && a.ctl > 0) {
      const atl = Math.round(a.atl);
      const ctl = Math.round(a.ctl);
      return { atl, ctl, tsb: ctl - atl };
    }
  }

  // Fallback: local EWMA from TSS values.
  const tssByDate = new Map<string, number>();
  for (const a of activities) {
    const tss = a.tss ?? 0;
    tssByDate.set(a.activityDate, (tssByDate.get(a.activityDate) ?? 0) + tss);
  }

  const dates = Array.from(tssByDate.keys()).sort();
  const atlDecay = 1 - Math.exp(-1 / 7);
  const ctlDecay = 1 - Math.exp(-1 / 42);

  let atl = 0;
  let ctl = 0;
  for (const date of dates) {
    const tss = tssByDate.get(date) ?? 0;
    atl = atl + atlDecay * (tss - atl);
    ctl = ctl + ctlDecay * (tss - ctl);
  }

  return {
    atl: Math.round(atl),
    ctl: Math.round(ctl),
    tsb: Math.round(ctl - atl),
  };
}
