/**
 * Training Quality Score — 4-component composite 0-100
 *
 * A single number that summarises how well the athlete is training right now,
 * built from objective, LLM-free data:
 *
 *   Fitness Base (25%)       — Z2 aerobic efficiency (decoupling) + CTL stability
 *   Progressive Overload (30%) — Week-over-week TSS progression pattern
 *   Consistency (25%)        — Session frequency + TSS delivery vs personal baseline
 *   Load Management (20%)    — Foster monotony + ACWR (injury-risk corridor)
 */

import type { Activity, WellnessLog } from "../../types.js";
import type { AthleteProfile } from "../../types.js";

// ─── Public types ────────────────────────────────────────────────────────────

export interface TrainingQualityFactor {
  name: string;
  value: number; // raw measured value
  score: number; // 0-100
  unit?: string;
}

export interface TrainingQualityComponent {
  score: number; // 0-100
  weight: number; // contribution weight (sum = 1.0 across components)
  confidence: "low" | "medium" | "high";
  factors: TrainingQualityFactor[];
}

export interface TrainingQualityResult {
  score: number; // 0-100 weighted composite
  label: "excellent" | "good" | "fair" | "poor";
  trend: "improving" | "stable" | "declining";
  components: {
    fitnessBase: TrainingQualityComponent;
    progressiveOverload: TrainingQualityComponent;
    consistency: TrainingQualityComponent;
    loadManagement: TrainingQualityComponent;
  };
  generatedAt: string;
  dataWindowDays: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Standard deviation of an array (population). Returns 0 for < 2 items. */
function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance =
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/** Linear regression slope (rise per step). Returns 0 for < 2 points. */
function linearSlope(values: number[]): number {
  if (values.length < 2) return 0;
  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (values[i] - yMean);
    den += (i - xMean) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

/** Add days to a YYYY-MM-DD date string. */
function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Diff in days: how many days before `refDate` is `date`? Positive = earlier. */
function daysAgo(date: string, refDate: string): number {
  return Math.round(
    (new Date(refDate + "T00:00:00Z").getTime() -
      new Date(date + "T00:00:00Z").getTime()) /
      86_400_000,
  );
}

// ─── Z2 session detection ────────────────────────────────────────────────────

/**
 * Determine whether an activity qualifies as a Zone-2 endurance session.
 *
 * Rules (sport-agnostic where possible):
 *  1. Sport must be bike or run
 *  2. Duration ≥ 45 min
 *  3. TSS/hour in [30, 68]  (if TSS available — otherwise pass this gate)
 *  4. IF ≤ 0.76             (power/pace threshold — skip if not available)
 *  5. VI ≤ 1.10             (cycling only, when normalizedPower available)
 */
function isZ2Session(a: Activity, _profile: AthleteProfile): boolean {
  if (a.sport !== "bike" && a.sport !== "run") return false;
  if ((a.durationSecs ?? 0) < 45 * 60) return false;

  // At least one intensity signal must be present
  const hasTss = a.tss != null;
  const hasIf = a.intensityFactor != null;
  if (!hasTss && !hasIf) return false;

  if (hasTss && a.durationSecs) {
    const tssPerHour = a.tss! / (a.durationSecs / 3600);
    if (tssPerHour < 28 || tssPerHour > 70) return false;
  }

  if (hasIf && a.intensityFactor! > 0.77) return false;

  // Variability Index: only for cycling with both power fields
  if (
    a.sport === "bike" &&
    a.normalizedPower != null &&
    a.avgPower != null &&
    a.avgPower > 0
  ) {
    const vi = a.normalizedPower / a.avgPower;
    if (vi > 1.1) return false;
  }

  return true;
}

/** Apply temperature correction to decoupling: hot weather inflates drift. */
function tempCorrectedDecoupling(
  decoupling: number,
  tempC: number | null,
): number {
  if (tempC == null || tempC <= 20) return decoupling;
  return decoupling - clamp((tempC - 20) * 0.12, 0, 3.0);
}

// ─── Component 1: Fitness Base ───────────────────────────────────────────────

/**
 * Fitness Base (25%) — aerobic efficiency + fitness stability
 *
 * Sub-scores:
 *   A. Z2 decoupling (70%): lower = more efficient aerobic engine
 *   B. CTL stability (30%): how much fitness has been retained recently
 */
function scoreFitnessBase(
  activities: Activity[],
  refDate: string,
  profile: AthleteProfile,
): TrainingQualityComponent {
  const windowStart = addDays(refDate, -56);
  const recent = activities.filter(
    (a) => a.activityDate >= windowStart && a.activityDate <= refDate,
  );

  const z2Sessions = recent.filter(
    (a) => isZ2Session(a, profile) && a.decoupling != null,
  );

  // ── A: Decoupling score
  let decouplingScore = 50;
  let avgDecoupling = 0;
  const decouplingConfidence: "low" | "medium" | "high" =
    z2Sessions.length >= 5 ? "high" : z2Sessions.length >= 2 ? "medium" : "low";

  if (z2Sessions.length >= 1) {
    const corrected = z2Sessions.map((a) =>
      tempCorrectedDecoupling(a.decoupling!, a.average_temp),
    );
    avgDecoupling = corrected.reduce((s, v) => s + v, 0) / corrected.length;
    // 100 at ≤2%, 0 at ≥10%
    decouplingScore = clamp(100 - ((avgDecoupling - 2) / 8) * 100, 0, 100);
  }

  // ── B: CTL stability (last 28 days vs 28-56 days ago)
  const last28Start = addDays(refDate, -28);
  const last28 = recent.filter((a) => a.activityDate >= last28Start);
  const prior28 = recent.filter((a) => a.activityDate < last28Start);

  const recentCtl = last28.length > 0 ? (last28.at(-1)?.ctl ?? 0) : 0;
  const peakCtl28 = Math.max(0, ...last28.map((a) => a.ctl ?? 0));
  const priorPeakCtl = Math.max(0, ...prior28.map((a) => a.ctl ?? 0));

  // Use peak across both windows as benchmark — don't penalise for taper
  const benchmarkCtl = Math.max(peakCtl28, priorPeakCtl);
  const ctlRatio =
    benchmarkCtl > 10 ? clamp(recentCtl / benchmarkCtl, 0, 1) : 1;
  // Linear: 100 at ratio ≥0.85, 0 at ratio 0.50
  const ctlScore = clamp(((ctlRatio - 0.5) / 0.35) * 100, 0, 100);

  const score = Math.round(decouplingScore * 0.7 + ctlScore * 0.3);

  return {
    score,
    weight: 0.25,
    confidence: decouplingConfidence,
    factors: [
      {
        name: "z2_decoupling",
        value: Math.round(avgDecoupling * 10) / 10,
        score: Math.round(decouplingScore),
        unit: "%",
      },
      {
        name: "ctl_stability",
        value: Math.round(ctlRatio * 100) / 100,
        score: Math.round(ctlScore),
      },
      {
        name: "z2_sessions_count",
        value: z2Sessions.length,
        score: z2Sessions.length >= 2 ? 100 : 50,
      },
    ],
  };
}

// ─── Component 2: Progressive Overload ───────────────────────────────────────

/**
 * Get weekly TSS sums for the last N complete weeks before refDate.
 * Week 0 = most recent complete week (Mon–Sun or 7-day rolling block).
 */
function weeklyTssSeries(
  activities: Activity[],
  refDate: string,
  weeksBack: number,
): number[] {
  const result: number[] = [];
  for (let w = weeksBack - 1; w >= 0; w--) {
    const weekEnd = addDays(refDate, -(w * 7));
    const weekStart = addDays(weekEnd, -7);
    const weekTss = activities
      .filter(
        (a) =>
          a.activityDate > weekStart &&
          a.activityDate <= weekEnd &&
          a.tss != null,
      )
      .reduce((sum, a) => sum + a.tss!, 0);
    result.push(weekTss);
  }
  return result;
}

/**
 * Score a week-over-week TSS change percentage.
 * Recovery drops (−40% to −15%) get a pass; the optimal is +5% to +10%.
 */
function scoreWeeklyChange(pct: number): number {
  if (pct < -0.45) return 40; // Extreme drop (illness/injury)
  if (pct < -0.15) return 85; // Recovery week — intentional
  if (pct < 0) return 65; // Minor drop
  if (pct <= 0.05) return 78; // Maintenance
  if (pct <= 0.1) return 100; // Optimal (+5–10%)
  if (pct <= 0.15) return 82; // Slightly aggressive
  if (pct <= 0.2) return 65; // Aggressive
  return 35; // >20% spike — overreaching risk
}

/**
 * Progressive Overload (30%) — weekly TSS pattern
 *
 * Uses last 4 complete weeks. Scores each week-over-week change and
 * weights recent changes more heavily (60/40 split).
 */
function scoreProgressiveOverload(
  activities: Activity[],
  refDate: string,
): TrainingQualityComponent {
  // Use 5 weeks to compute 4 week-over-week changes
  const weekly = weeklyTssSeries(activities, addDays(refDate, -7), 5);

  const nonZeroWeeks = weekly.filter((w) => w > 0).length;
  const confidence: "low" | "medium" | "high" =
    nonZeroWeeks >= 4 ? "high" : nonZeroWeeks >= 2 ? "medium" : "low";

  if (nonZeroWeeks < 2) {
    return {
      score: 50,
      weight: 0.3,
      confidence: "low",
      factors: [
        {
          name: "weekly_tss_data_insufficient",
          value: nonZeroWeeks,
          score: 50,
        },
      ],
    };
  }

  // Build week-over-week changes for the last 3 transitions
  const changes: { from: number; to: number; pct: number; score: number }[] =
    [];
  for (let i = 1; i < weekly.length; i++) {
    if (weekly[i - 1] > 0) {
      const pct = (weekly[i] - weekly[i - 1]) / weekly[i - 1];
      changes.push({
        from: Math.round(weekly[i - 1]),
        to: Math.round(weekly[i]),
        pct,
        score: scoreWeeklyChange(pct),
      });
    }
  }

  if (changes.length === 0) {
    return {
      score: 50,
      weight: 0.3,
      confidence: "low",
      factors: [{ name: "weekly_tss_data_insufficient", value: 0, score: 50 }],
    };
  }

  // Weight recent changes more (most recent = highest weight)
  const weights =
    changes.length >= 3
      ? [0.15, 0.35, 0.5]
      : changes.length === 2
        ? [0.4, 0.6]
        : [1.0];
  const offset = changes.length - weights.length;
  const weightedScore = weights.reduce((sum, w, i) => {
    return sum + w * (changes[offset + i]?.score ?? 50);
  }, 0);

  // Also factor in absolute TSS level trend (slope over 5 weeks)
  const trendSlope = linearSlope(weekly);
  const avgWeeklyTss = weekly.reduce((s, v) => s + v, 0) / weekly.length;
  const normalizedSlope = avgWeeklyTss > 0 ? trendSlope / avgWeeklyTss : 0;

  // Slightly bonus for positive overall trend
  const trendBonus = clamp(normalizedSlope * 200, -10, 10);

  const latestChange = changes.at(-1)!;

  return {
    score: Math.round(clamp(weightedScore + trendBonus, 0, 100)),
    weight: 0.3,
    confidence,
    factors: [
      {
        name: "last_week_change_pct",
        value: Math.round(latestChange.pct * 1000) / 10,
        score: latestChange.score,
        unit: "%",
      },
      {
        name: "weekly_tss_trend_slope",
        value: Math.round(trendSlope * 10) / 10,
        score: clamp(50 + normalizedSlope * 500, 0, 100),
        unit: "TSS/week",
      },
      {
        name: "recent_weekly_tss",
        value: Math.round(weekly.at(-1) ?? 0),
        score: 100,
        unit: "TSS",
      },
    ],
  };
}

// ─── Component 3: Consistency ────────────────────────────────────────────────

/**
 * Consistency (25%) — training regularity vs personal baseline
 *
 * Sub-scores:
 *   A. Session frequency: days/week vs 8-week personal average (60%)
 *   B. TSS delivery rate: recent weekly TSS vs 8-week average (40%)
 */
function scoreConsistency(
  activities: Activity[],
  refDate: string,
): TrainingQualityComponent {
  // 8-week baseline window (weeks 2-9 back, skip current week)
  const baselineStart = addDays(refDate, -7 * 9);
  const baselineEnd = addDays(refDate, -7);
  const baselineActivities = activities.filter(
    (a) => a.activityDate >= baselineStart && a.activityDate < baselineEnd,
  );

  // Recent 4 weeks (excluding current partial week)
  const recentStart = addDays(refDate, -4 * 7);
  const recentActivities = activities.filter(
    (a) => a.activityDate >= recentStart && a.activityDate <= refDate,
  );

  const baselineWeeks = 8;
  const recentWeeks = 4;

  // Session frequency
  const baselineSessions = baselineActivities.length;
  const baselineSessionsPerWeek = baselineSessions / baselineWeeks;
  const recentSessions = recentActivities.length;
  const recentSessionsPerWeek = recentSessions / recentWeeks;

  const defaultSessionsPerWeek = 5; // fallback for new athletes
  const targetSessionsPerWeek =
    baselineSessionsPerWeek > 0
      ? baselineSessionsPerWeek
      : defaultSessionsPerWeek;

  const frequencyRatio = clamp(
    recentSessionsPerWeek / targetSessionsPerWeek,
    0,
    1.3,
  );
  // Score: 100 at ratio 0.9-1.1, drops to 50 at 0.5 or 1.3
  const frequencyScore =
    frequencyRatio >= 0.9 && frequencyRatio <= 1.1
      ? 100
      : frequencyRatio > 1.1
        ? clamp(100 - (frequencyRatio - 1.1) * 250, 60, 100)
        : clamp((frequencyRatio / 0.9) * 100, 0, 100);

  // TSS delivery
  const baselineTss = baselineActivities.reduce((s, a) => s + (a.tss ?? 0), 0);
  const baselineTssPerWeek = baselineTss / baselineWeeks;
  const recentTss = recentActivities.reduce((s, a) => s + (a.tss ?? 0), 0);
  const recentTssPerWeek = recentTss / recentWeeks;

  const defaultTssPerWeek = 300;
  const targetTssPerWeek =
    baselineTssPerWeek > 0 ? baselineTssPerWeek : defaultTssPerWeek;

  const tssRatio = clamp(recentTssPerWeek / targetTssPerWeek, 0, 1.3);
  const tssScore =
    tssRatio >= 0.85 && tssRatio <= 1.15
      ? 100
      : tssRatio > 1.15
        ? clamp(100 - (tssRatio - 1.15) * 200, 60, 100)
        : clamp((tssRatio / 0.85) * 100, 0, 100);

  const confidence: "low" | "medium" | "high" =
    baselineActivities.length >= 20
      ? "high"
      : baselineActivities.length >= 8
        ? "medium"
        : "low";

  const score = Math.round(frequencyScore * 0.6 + tssScore * 0.4);

  return {
    score,
    weight: 0.25,
    confidence,
    factors: [
      {
        name: "sessions_per_week",
        value: Math.round(recentSessionsPerWeek * 10) / 10,
        score: Math.round(frequencyScore),
      },
      {
        name: "baseline_sessions_per_week",
        value: Math.round(targetSessionsPerWeek * 10) / 10,
        score: 100,
      },
      {
        name: "tss_per_week",
        value: Math.round(recentTssPerWeek),
        score: Math.round(tssScore),
        unit: "TSS",
      },
    ],
  };
}

// ─── Component 4: Load Management ────────────────────────────────────────────

/**
 * Foster Monotony: mean_daily_load / sd_daily_load
 * High values = grinding the same load every day (bad).
 * Low values = proper hard/easy alternation (good).
 */
function computeFosterMonotony(dailyTss: number[]): number {
  if (dailyTss.length < 3) return 1.0; // insufficient data
  const mean = dailyTss.reduce((s, v) => s + v, 0) / dailyTss.length;
  const sd = stdDev(dailyTss);
  return sd > 0 ? mean / sd : mean > 0 ? 99 : 0;
}

function scoreMonotony(monotony: number): number {
  if (monotony <= 0.4) return 65; // too chaotic
  if (monotony <= 1.5) return 100; // excellent variety
  if (monotony <= 2.0) return 80; // slight concern
  if (monotony <= 2.5) return 55; // moderate grinding
  if (monotony <= 3.5) return 30; // heavy grinding
  return 10; // same workout every day
}

function scoreAcwr(acwr: number): number {
  if (acwr <= 0) return 50;
  if (acwr >= 0.8 && acwr <= 1.3) return 100; // optimal window
  if (acwr > 1.3 && acwr <= 1.5) return 70; // elevated
  if (acwr > 1.5 && acwr <= 1.8) return 35; // high risk
  if (acwr > 1.8) return 10; // danger zone
  if (acwr >= 0.6) return 70; // slightly under-loaded
  return 35; // very under-loaded
}

/**
 * Load Management (20%) — Foster monotony + ACWR
 */
function scoreLoadManagement(
  activities: Activity[],
  refDate: string,
): TrainingQualityComponent {
  // Daily TSS for last 7 days (rest days = 0)
  const dailyTss: number[] = [];
  for (let d = 6; d >= 0; d--) {
    const day = addDays(refDate, -d);
    const dayActs = activities.filter((a) => a.activityDate === day);
    dailyTss.push(dayActs.reduce((s, a) => s + (a.tss ?? 0), 0));
  }

  const monotony = computeFosterMonotony(dailyTss);
  const monotonyScore = scoreMonotony(monotony);

  // Foster strain = weekly avg daily TSS × monotony (dimensionless proxy)
  const avgDailyTss = dailyTss.reduce((s, v) => s + v, 0) / dailyTss.length;
  const fosterStrain = avgDailyTss * monotony;

  // ACWR from most recent activity with valid ATL/CTL
  const last30Start = addDays(refDate, -30);
  const recent = activities.filter(
    (a) => a.activityDate >= last30Start && a.activityDate <= refDate,
  );
  let acwr = 1.0;
  let acwrAvailable = false;
  for (let i = recent.length - 1; i >= 0; i--) {
    const a = recent[i];
    if (a.atl != null && a.ctl != null && a.ctl > 0) {
      acwr = a.atl / a.ctl;
      acwrAvailable = true;
      break;
    }
  }

  const acwrScore = scoreAcwr(acwr);

  const confidence: "low" | "medium" | "high" =
    acwrAvailable && dailyTss.some((t) => t > 0) ? "high" : "medium";

  const score = Math.round(monotonyScore * 0.5 + acwrScore * 0.5);

  return {
    score,
    weight: 0.2,
    confidence,
    factors: [
      {
        name: "foster_monotony",
        value: Math.round(monotony * 100) / 100,
        score: monotonyScore,
      },
      {
        name: "foster_strain",
        value: Math.round(fosterStrain),
        score: fosterStrain < 150 ? 100 : fosterStrain < 300 ? 75 : 45,
      },
      {
        name: "acwr",
        value: Math.round(acwr * 100) / 100,
        score: acwrScore,
      },
    ],
  };
}

// ─── Trend detection ─────────────────────────────────────────────────────────

/**
 * Compare today's composite score to a 7-day rolling average of past scores.
 */
function detectTrend(
  currentScore: number,
  pastScores: number[],
): "improving" | "stable" | "declining" {
  if (pastScores.length < 3) return "stable";
  const avg = pastScores.reduce((s, v) => s + v, 0) / pastScores.length;
  if (currentScore > avg + 5) return "improving";
  if (currentScore < avg - 5) return "declining";
  return "stable";
}

function scoreToLabel(score: number): "excellent" | "good" | "fair" | "poor" {
  if (score >= 80) return "excellent";
  if (score >= 65) return "good";
  if (score >= 50) return "fair";
  return "poor";
}

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Compute the Training Quality Score from the last 84 days of activities and wellness.
 *
 * @param activities   At least 84 days of activities (sorted by date asc recommended)
 * @param _wellness    Wellness logs (reserved for future HRV sub-scores)
 * @param profile      Athlete profile (LTHR, FTP used for Z2 detection)
 * @param refDate      Reference date (today, YYYY-MM-DD)
 * @param pastScores   Recent daily TQ scores (for trend detection, most recent last)
 */
export function calculateTrainingQuality(
  activities: Activity[],
  _wellness: WellnessLog[],
  profile: AthleteProfile,
  refDate: string,
  pastScores: number[] = [],
): TrainingQualityResult {
  const sorted = [...activities].sort((a, b) =>
    a.activityDate.localeCompare(b.activityDate),
  );

  const fitnessBase = scoreFitnessBase(sorted, refDate, profile);
  const progressiveOverload = scoreProgressiveOverload(sorted, refDate);
  const consistency = scoreConsistency(sorted, refDate);
  const loadManagement = scoreLoadManagement(sorted, refDate);

  const score = Math.round(
    fitnessBase.score * fitnessBase.weight +
      progressiveOverload.score * progressiveOverload.weight +
      consistency.score * consistency.weight +
      loadManagement.score * loadManagement.weight,
  );

  return {
    score,
    label: scoreToLabel(score),
    trend: detectTrend(score, pastScores),
    components: {
      fitnessBase,
      progressiveOverload,
      consistency,
      loadManagement,
    },
    generatedAt: new Date().toISOString(),
    dataWindowDays: 84,
  };
}
