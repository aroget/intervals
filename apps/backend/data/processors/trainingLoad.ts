import { Activity } from "../../types.js";

/**
 * Get training load metrics (ATL, CTL, TSB) from Intervals.icu.
 *
 * ALWAYS uses Intervals.icu's own ATL/CTL values (icu_atl, icu_ctl) from the
 * most recent activity. These are computed by Intervals.icu with full
 * historical data and calibrated thresholds.
 *
 * NO LOCAL CALCULATION - if Intervals.icu values aren't available, returns
 * zeros and logs a warning to run sync.
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
  if (!activities.length) {
    console.warn("[trainingLoad] No activities found");
    return { atl: 0, ctl: 0, tsb: 0 };
  }

  // Use Intervals.icu's own values from the most recent activity that has them.
  // Skip entries where ctl=0 — Intervals returns 0 when the load hasn't been
  // computed yet (e.g. immediately after upload). A non-zero CTL is required
  // because a training athlete can never have a true chronic load of zero.
  for (let i = activities.length - 1; i >= 0; i--) {
    const a = activities[i];
    if (a.atl != null && a.ctl != null && a.ctl > 0) {
      const atl = Math.round(a.atl);
      const ctl = Math.round(a.ctl);
      console.log(
        `[trainingLoad] ✅ Using Intervals.icu values from ${a.activityDate}: ATL=${atl}, CTL=${ctl}, TSB=${ctl - atl}`,
      );
      return { atl, ctl, tsb: ctl - atl };
    }
  }

  // No valid Intervals.icu values found - return zeros and warn
  console.warn(
    "[trainingLoad] ⚠️  No valid ATL/CTL values found in activities. Run 'pnpm sync' to fetch from Intervals.icu",
  );
  return { atl: 0, ctl: 0, tsb: 0 };
}
