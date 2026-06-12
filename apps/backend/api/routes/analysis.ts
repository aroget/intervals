/**
 * Analysis API routes - CONSOLIDATED VERSION
 * Uses composite processors to eliminate duplication.
 * Routes are thin orchestrators (~5-10 lines each).
 */

import { Hono } from "hono";
import { db } from "../../db/client.js";
import {
  runDailyAnalysis,
  loadAthleteProfile,
  replanWeekWorkouts,
} from "../../agents/daily.js";
import { chat } from "../../agents/llm/adapter.js";
import { getCyclePosition } from "../../data/processors/cycleTracker.js";
import { loadActivities, loadWellness } from "../../db/loaders.js";
import { analyzeAllRecoveryPatterns } from "../../data/processors/recoveryPatterns.js";
import { predictTomorrowReadiness } from "../../data/processors/readinessPrediction.js";
import { detectAllComplianceFrictions } from "../../data/processors/complianceFriction.js";
import { buildComputedMetrics } from "../../data/processors/readiness.js";
import { calculateTrainingQuality } from "../../data/processors/trainingQuality.js";

// Import composite processors
import { getBlockAnalysis } from "../../data/processors/blockAnalysis.js";
import {
  getRecoveryReadinessChart,
  getTrainingStressBalance,
  getTrainingLoadHistory,
  getACWRChart,
  getHRVBaselineChart,
  getReadinessPerformanceChart,
  getDecouplingTrendChart,
} from "../../data/processors/chartData.js";

const analysis = new Hono();

// ─────────────────────────────────────────────────────────────────────────────
// DAILY OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/** GET /analysis/:athleteId/today — get today's analysis and workout */
analysis.get("/:athleteId/today", async (c) => {
  const athleteId = c.req.param("athleteId");
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: dailyAnalysis }, { data: workout }] = await Promise.all([
    db
      .from("daily_analyses")
      .select("*")
      .eq("athlete_id", athleteId)
      .eq("analysis_date", today)
      .single(),
    db
      .from("prescribed_workouts")
      .select("*")
      .eq("athlete_id", athleteId)
      .eq("workout_date", today)
      .single(),
  ]);

  return c.json({ analysis: dailyAnalysis, workout });
});

/** POST /analysis/:athleteId/run — manually trigger daily analysis */
analysis.post("/:athleteId/run", async (c) => {
  const athleteId = c.req.param("athleteId");
  const today = new Date().toISOString().slice(0, 10);

  try {
    await Promise.all([
      db
        .from("daily_analyses")
        .delete()
        .eq("athlete_id", athleteId)
        .eq("analysis_date", today),
      db
        .from("prescribed_workouts")
        .delete()
        .eq("athlete_id", athleteId)
        .eq("workout_date", today),
    ]);
    await runDailyAnalysis(athleteId, today);
    return c.json({ success: true, date: today });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

/** GET /analysis/:athleteId/history — last N days of analyses */
analysis.get("/:athleteId/history", async (c) => {
  const athleteId = c.req.param("athleteId");
  const days = parseInt(c.req.query("days") ?? "30", 10);
  const since = new Date(Date.now() - days * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const { data, error } = await db
    .from("daily_analyses")
    .select("analysis_date, readiness_score, hrv_trend, agent_output")
    .eq("athlete_id", athleteId)
    .gte("analysis_date", since)
    .order("analysis_date", { ascending: false });

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ history: data });
});

/** GET /analysis/:athleteId/wellness — last N days of HRV, RHR, sleep */
analysis.get("/:athleteId/wellness", async (c) => {
  const athleteId = c.req.param("athleteId");
  const days = parseInt(c.req.query("days") ?? "7", 10);
  const since = new Date(Date.now() - days * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const { data, error } = await db
    .from("wellness_logs")
    .select(
      "log_date, hrv, hrv_score, rhr, sleep_score, sleep_hours, sleep_quality",
    )
    .eq("athlete_id", athleteId)
    .gte("log_date", since)
    .order("log_date", { ascending: false });

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ wellness: data ?? [] });
});

/** GET /analysis/:athleteId/upcoming — next N days of prescribed workouts */
analysis.get("/:athleteId/upcoming", async (c) => {
  const athleteId = c.req.param("athleteId");
  const days = parseInt(c.req.query("days") ?? "7", 10);
  const today = new Date().toISOString().slice(0, 10);
  const until = new Date(Date.now() + days * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const { data, error } = await db
    .from("prescribed_workouts")
    .select("workout_date, sport, duration_min, intensity, agent_output")
    .eq("athlete_id", athleteId)
    .gte("workout_date", today)
    .lte("workout_date", until)
    .order("workout_date", { ascending: true });

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ upcoming: data ?? [] });
});

// ─────────────────────────────────────────────────────────────────────────────
// WORKOUT PLANNING
// ─────────────────────────────────────────────────────────────────────────────

/** POST /analysis/:athleteId/replan-week — regenerate next N days of workouts */
analysis.post("/:athleteId/replan-week", async (c) => {
  const athleteId = c.req.param("athleteId");
  const body = (await c.req.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const fromDate =
    (body.fromDate as string | undefined) ??
    new Date().toISOString().slice(0, 10);
  const notes = body.notes as string | undefined;

  try {
    const planned = await replanWeekWorkouts(athleteId, fromDate, notes);
    return c.json({ success: true, planned });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

/** POST /analysis/:athleteId/generate-week — generate workouts (fire-and-forget) */
analysis.post("/:athleteId/generate-week", async (c) => {
  const athleteId = c.req.param("athleteId");

  (async () => {
    try {
      await replanWeekWorkouts(athleteId, undefined, undefined, 7);
    } catch (err) {
      console.error("[generate-week]", err);
    }
  })();

  return c.json({ started: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCK ANALYSIS (CONSOLIDATED)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /analysis/:athleteId/block — flexible block endpoint with query params
 *
 * Query params:
 * - date: reference date (default: today)
 * - include: comma-separated list of sections
 *   Options: workouts, compliance, fitness, effectiveness, zones
 *   Example: ?include=workouts,compliance
 *
 * Replaces: /block-overview, /compliance, /fitness-trajectory
 */
analysis.get("/:athleteId/block", async (c) => {
  const athleteId = c.req.param("athleteId");
  const refDate = c.req.query("date") ?? new Date().toISOString().slice(0, 10);
  const includeStr = c.req.query("include") ?? "";
  const include = includeStr.split(",").filter(Boolean);

  try {
    const result = await getBlockAnalysis(athleteId, refDate, {
      includeWorkouts: include.includes("workouts"),
      includeCompliance: include.includes("compliance"),
      includeFitness: include.includes("fitness"),
      includeZones: include.includes("zones"),
    });

    return c.json(result);
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

/**
 * LEGACY ENDPOINTS (kept for backwards compatibility, redirect to /block)
 */

/** GET /analysis/:athleteId/block-overview — DEPRECATED: use /block?include=workouts */
analysis.get("/:athleteId/block-overview", async (c) => {
  const athleteId = c.req.param("athleteId");
  const refDate = c.req.query("date") ?? new Date().toISOString().slice(0, 10);

  const result = await getBlockAnalysis(athleteId, refDate, {
    includeWorkouts: true,
  });

  return c.json({
    block: {
      startDate: result.blockStartDate,
      endDate: result.blockEndDate,
      weeks: result.weeks,
      currentWeek: result.currentWeek,
      currentDay: refDate,
    },
  });
});

/** GET /analysis/:athleteId/compliance — DEPRECATED: use /block?include=compliance */
analysis.get("/:athleteId/compliance", async (c) => {
  const athleteId = c.req.param("athleteId");
  const refDate = c.req.query("date") ?? new Date().toISOString().slice(0, 10);

  const result = await getBlockAnalysis(athleteId, refDate, {
    includeCompliance: true,
  });

  return c.json({
    blockStartDate: result.blockStartDate,
    blockEndDate: result.blockEndDate,
    weeklyReports: result.compliance?.weeklyReports ?? [],
    overallCompliance: result.compliance?.overallCompliance ?? {},
  });
});

/** GET /analysis/:athleteId/fitness-trajectory — DEPRECATED: use /block?include=fitness */
analysis.get("/:athleteId/fitness-trajectory", async (c) => {
  const athleteId = c.req.param("athleteId");
  const refDate = c.req.query("date") ?? new Date().toISOString().slice(0, 10);

  const result = await getBlockAnalysis(athleteId, refDate, {
    includeFitness: true,
  });

  return c.json({
    blockStartDate: result.blockStartDate,
    baselineCtl: result.fitness?.baselineCtl ?? 0,
    checkpoints: result.fitness?.checkpoints ?? [],
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CHART DATA (CONSOLIDATED)
// ─────────────────────────────────────────────────────────────────────────────

/** GET /analysis/:athleteId/recovery-readiness-chart — daily readiness + TSS */
analysis.get("/:athleteId/recovery-readiness-chart", async (c) => {
  const athleteId = c.req.param("athleteId");
  const days = parseInt(c.req.query("days") ?? "30", 10);

  const data = await getRecoveryReadinessChart(athleteId, days);
  return c.json({ data });
});

/** GET /analysis/:athleteId/training-stress-balance — ATL/CTL/TSB chart */
analysis.get("/:athleteId/training-stress-balance", async (c) => {
  const athleteId = c.req.param("athleteId");
  const days = parseInt(c.req.query("days") ?? "90", 10);

  const data = await getTrainingStressBalance(athleteId, days);
  return c.json({ data });
});

/** GET /analysis/:athleteId/training-load-history — weekly TSS aggregation */
analysis.get("/:athleteId/training-load-history", async (c) => {
  const athleteId = c.req.param("athleteId");
  const weeks = parseInt(c.req.query("weeks") ?? "16", 10);

  const data = await getTrainingLoadHistory(athleteId, weeks);
  return c.json({ weeks: data });
});

/** GET /analysis/:athleteId/training-quality — today's Training Quality Score (computes on-the-fly if not stored) */
analysis.get("/:athleteId/training-quality", async (c) => {
  const athleteId = c.req.param("athleteId");
  const date = c.req.query("date") ?? new Date().toISOString().slice(0, 10);

  const { data } = await db
    .from("daily_analyses")
    .select("analysis_date, training_quality")
    .eq("athlete_id", athleteId)
    .eq("analysis_date", date)
    .single();

  // Return stored result if available
  if (data?.training_quality) {
    return c.json({ date: data.analysis_date, ...data.training_quality });
  }

  // Compute on-the-fly from existing activity + wellness data
  const [activities, wellness, profile] = await Promise.all([
    loadActivities(athleteId, 180),
    loadWellness(athleteId, 120),
    loadAthleteProfile(athleteId),
  ]);

  if (!activities.length) {
    return c.json({ error: "No activity data available", date }, 404);
  }

  const activitiesAsOf = activities.filter((a) => a.activityDate <= date);
  const wellnessAsOf = wellness.filter((w) => w.logDate <= date);
  const tq = calculateTrainingQuality(
    activitiesAsOf,
    wellnessAsOf,
    profile,
    date,
    [],
  );

  return c.json({ date, ...tq });
});

/**
 * POST /analysis/:athleteId/training-quality/backfill
 * Computes and stores training_quality for all daily_analyses rows that are missing it.
 * Query param: days=90 (default). Useful for first-run or after algorithm changes.
 */
analysis.post("/:athleteId/training-quality/backfill", async (c) => {
  const athleteId = c.req.param("athleteId");
  const days = Math.min(parseInt(c.req.query("days") ?? "90", 10), 180);
  const since = new Date(Date.now() - days * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  // Load existing analysis rows that are missing training_quality
  const { data: rows, error } = await db
    .from("daily_analyses")
    .select("id, analysis_date, training_quality")
    .eq("athlete_id", athleteId)
    .gte("analysis_date", since)
    .lte("analysis_date", today)
    .order("analysis_date", { ascending: true });

  if (error) return c.json({ error: error.message }, 500);

  const missing = (rows ?? []).filter((r: any) => r.training_quality == null);
  if (missing.length === 0) {
    return c.json({
      updated: 0,
      message: "All rows already have training_quality scores.",
    });
  }

  // Bulk-load data once (extra window for the sliding computation)
  const dataWindowDays = days + 90;
  const [activities, wellness, profile] = await Promise.all([
    loadActivities(athleteId, dataWindowDays),
    loadWellness(athleteId, Math.min(dataWindowDays, 180)),
    loadAthleteProfile(athleteId),
  ]);

  // Process each missing date in chronological order, building up pastScores for trend
  const pastScores: number[] = [];
  let updated = 0;

  for (const row of missing as any[]) {
    const dateStr: string = row.analysis_date;
    const activitiesAsOf = activities.filter((a) => a.activityDate <= dateStr);
    const wellnessAsOf = wellness.filter((w) => w.logDate <= dateStr);

    const tq = calculateTrainingQuality(
      activitiesAsOf,
      wellnessAsOf,
      profile,
      dateStr,
      [...pastScores],
    );

    const { error: updateError } = await db
      .from("daily_analyses")
      .update({ training_quality: tq })
      .eq("id", row.id);

    if (!updateError) {
      updated++;
      pastScores.push(tq.score);
      if (pastScores.length > 14) pastScores.shift();
    }
  }

  return c.json({
    updated,
    total: missing.length,
    message: `Backfilled training_quality for ${updated}/${missing.length} rows.`,
  });
});

/** GET /analysis/:athleteId/training-quality/history — 90-day trend for history chart */
analysis.get("/:athleteId/training-quality/history", async (c) => {
  const athleteId = c.req.param("athleteId");
  const days = Math.min(parseInt(c.req.query("days") ?? "90", 10), 180);
  const since = new Date(Date.now() - days * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  // Load bulk data once — activities need extra history for the sliding window
  // (fitness base uses 56-day window, so we need days + 84 days of activities)
  const dataWindowDays = days + 90;
  const [activities, wellness, profile, storedRows] = await Promise.all([
    loadActivities(athleteId, dataWindowDays),
    loadWellness(athleteId, Math.min(dataWindowDays, 180)),
    loadAthleteProfile(athleteId),
    db
      .from("daily_analyses")
      .select("analysis_date, training_quality")
      .eq("athlete_id", athleteId)
      .gte("analysis_date", since)
      .lte("analysis_date", today)
      .order("analysis_date", { ascending: true })
      .then(({ data }) => data ?? []),
  ]);

  // Build lookup of already-stored TQ scores (skip re-computing those)
  const stored = new Map<string, any>(
    (storedRows as any[])
      .filter((r) => r.training_quality != null)
      .map((r) => [r.analysis_date, r.training_quality]),
  );

  // Enumerate each calendar date in the range that has at least one activity
  // (avoid computing for rest days with no data at all)
  const activityDates = new Set(activities.map((a) => a.activityDate));

  // For each date in the analysis window, compute or use stored value
  const history: any[] = [];
  const pastScores: number[] = [];

  // Enumerate dates from since → today (inclusive)
  const cursor = new Date(since + "T00:00:00Z");
  const end = new Date(today + "T00:00:00Z");

  while (cursor <= end) {
    const dateStr = cursor.toISOString().slice(0, 10);

    // Only emit dates that had a stored analysis OR had training activity
    if (stored.has(dateStr) || activityDates.has(dateStr)) {
      let tq = stored.get(dateStr);

      if (!tq) {
        // Compute on the fly — filter activities to those available as of dateStr
        const activitiesAsOf = activities.filter(
          (a) => a.activityDate <= dateStr,
        );
        const wellnessAsOf = wellness.filter((w) => w.logDate <= dateStr);
        tq = calculateTrainingQuality(
          activitiesAsOf,
          wellnessAsOf,
          profile,
          dateStr,
          [...pastScores],
        );
      }

      history.push({
        date: dateStr,
        score: tq?.score ?? null,
        label: tq?.label ?? null,
        trend: tq?.trend ?? null,
        fitnessBase: tq?.components?.fitnessBase?.score ?? null,
        progressiveOverload: tq?.components?.progressiveOverload?.score ?? null,
        consistency: tq?.components?.consistency?.score ?? null,
        loadManagement: tq?.components?.loadManagement?.score ?? null,
      });

      if (tq?.score != null) pastScores.push(tq.score);
      if (pastScores.length > 14) pastScores.shift();
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return c.json({ days, history });
});

/** GET /analysis/:athleteId/summary-metrics — aggregate metrics for dashboard */
analysis.get("/:athleteId/summary-metrics", async (c) => {
  const athleteId = c.req.param("athleteId");
  const days = parseInt(c.req.query("days") ?? "30", 10);
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: todayAnalysis }, { data: recentAnalyses }, activities] =
    await Promise.all([
      db
        .from("daily_analyses")
        .select("readiness_score, training_quality")
        .eq("athlete_id", athleteId)
        .eq("analysis_date", today)
        .single(),
      db
        .from("daily_analyses")
        .select("readiness_score")
        .eq("athlete_id", athleteId)
        .gte(
          "analysis_date",
          new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10),
        )
        .order("analysis_date", { ascending: false }),
      loadActivities(athleteId, 120),
    ]);

  const avgReadiness =
    recentAnalyses && recentAnalyses.length > 0
      ? Math.round(
          recentAnalyses.reduce((sum, a) => sum + a.readiness_score, 0) /
            recentAnalyses.length,
        )
      : (todayAnalysis?.readiness_score ?? 0);

  const latestActivity = activities[0];
  const currentCtl = latestActivity?.ctl ?? 0;
  const currentAtl = latestActivity?.atl ?? 0;
  const currentTsb = currentCtl - currentAtl;

  let tsbStatus = "Optimal";
  if (currentTsb > 5) tsbStatus = "Fresh";
  else if (currentTsb < -30) tsbStatus = "Fatigued";
  else if (currentTsb >= -30 && currentTsb <= -10) tsbStatus = "Optimal";
  else tsbStatus = "Moderate";

  // Training quality score from today's analysis
  const tqData = todayAnalysis?.training_quality as { score?: number } | null;
  const blockScore = tqData?.score ?? null;

  // Compliance via block analysis
  const blockResult = await getBlockAnalysis(athleteId, today, {
    includeCompliance: true,
  });
  const complianceRate =
    blockResult.compliance?.overallCompliance.complianceRate ?? 100;
  const workoutsCompleted =
    blockResult.compliance?.overallCompliance.workoutsCompleted ?? 0;
  const workoutsPrescribed =
    blockResult.compliance?.overallCompliance.workoutsPrescribed ?? 0;

  return c.json({
    avgReadiness,
    currentReadiness: todayAnalysis?.readiness_score ?? avgReadiness,
    currentTsb: Math.round(currentTsb * 10) / 10,
    currentCtl: Math.round(currentCtl * 10) / 10,
    currentAtl: Math.round(currentAtl * 10) / 10,
    tsbStatus,
    blockScore: blockScore != null ? Math.round(blockScore) : null,
    complianceRate,
    workoutsCompleted,
    workoutsPrescribed,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ANALYSIS & PATTERNS
// ─────────────────────────────────────────────────────────────────────────────

/** GET /analysis/:athleteId/recovery-patterns — detected recovery patterns */
analysis.get("/:athleteId/recovery-patterns", async (c) => {
  const athleteId = c.req.param("athleteId");
  const days = parseInt(c.req.query("days") ?? "90", 10);

  const [wellness, activities] = await Promise.all([
    loadWellness(athleteId, days),
    loadActivities(athleteId, days),
  ]);

  const patterns = analyzeAllRecoveryPatterns(wellness, activities);
  return c.json({ patterns });
});

/** GET /analysis/:athleteId/readiness-prediction — predict tomorrow's readiness */
analysis.get("/:athleteId/readiness-prediction", async (c) => {
  const athleteId = c.req.param("athleteId");

  const profile = await loadAthleteProfile(athleteId);
  if (!profile.cycleStartDate) {
    return c.json({ error: "Cycle start date not set" }, 400);
  }

  const [wellness, activities] = await Promise.all([
    loadWellness(athleteId, 30),
    loadActivities(athleteId, 30),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const metrics = buildComputedMetrics({
    logs: wellness,
    activities,
    cycleStartDate: profile.cycleStartDate,
    weeklyMaxHours: profile.weeklyMaxHours,
    today,
  });

  const prediction = predictTomorrowReadiness(metrics, activities, wellness);
  return c.json({ prediction });
});

/** GET /analysis/:athleteId/compliance-frictions — detect compliance issues */
analysis.get("/:athleteId/compliance-frictions", async (c) => {
  const athleteId = c.req.param("athleteId");
  const days = parseInt(c.req.query("days") ?? "28", 10);
  const since = new Date(Date.now() - days * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const [{ data: workouts }, activities] = await Promise.all([
    db
      .from("prescribed_workouts")
      .select("workout_date, sport, duration_min, intensity, session_type")
      .eq("athlete_id", athleteId)
      .gte("workout_date", since)
      .order("workout_date", { ascending: true }),
    loadActivities(athleteId, days),
  ]);

  if (!workouts || workouts.length === 0) {
    return c.json({ frictions: [] });
  }

  const frictions = detectAllComplianceFrictions(workouts, activities);
  return c.json({ frictions });
});

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVITIES & ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────

/** GET /analysis/:athleteId/recent-activities — last N activities */
analysis.get("/:athleteId/recent-activities", async (c) => {
  const athleteId = c.req.param("athleteId");
  const limit = parseInt(c.req.query("limit") ?? "5", 10);

  const { data, error } = await db
    .from("activities")
    .select("*")
    .eq("athlete_id", athleteId)
    .order("activity_date", { ascending: false })
    .limit(limit);

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ activities: data ?? [] });
});

/** GET /analysis/:athleteId/activity-analysis/:activityId — AI post-workout analysis */
analysis.get("/:athleteId/activity-analysis/:activityId", async (c) => {
  const { activityId, athleteId } = c.req.param();

  const { data: activity, error } = await db
    .from("activities")
    .select("*")
    .eq("id", activityId)
    .single();

  if (error || !activity) return c.json({ error: "Not found" }, 404);

  // Return cached if available
  if (activity.post_workout_analysis) {
    return c.json({ analysis: activity.post_workout_analysis });
  }

  // Generate analysis
  const [{ data: profile }, { data: prescribed }] = await Promise.all([
    db
      .from("athlete_profiles")
      .select("cycle_start_date")
      .eq("athlete_id", activity.athlete_id)
      .single(),
    db
      .from("prescribed_workouts")
      .select("sport, duration_min, intensity, rationale")
      .eq("athlete_id", activity.athlete_id)
      .eq("workout_date", activity.activity_date)
      .single(),
  ]);

  let cycleContext = "";
  if (profile?.cycle_start_date) {
    const cycle = getCyclePosition(
      profile.cycle_start_date as string,
      activity.activity_date as string,
    );
    cycleContext = `\nTraining Phase: Week ${cycle.weekNumber} (${cycle.weekType}) of 4-week cycle`;
  }

  let prescribedContext = "";
  if (prescribed) {
    prescribedContext = `\nPrescribed: ${prescribed.sport} for ${prescribed.duration_min}min at ${prescribed.intensity} intensity. ${prescribed.rationale ?? ""}`;
  }

  const durMin = activity.duration_secs
    ? Math.round((activity.duration_secs as number) / 60)
    : null;

  const prompt = `You are a sports coach analyzing a workout.${cycleContext}${prescribedContext}

Completed: ${activity.sport} — ${durMin}min
TSS: ${activity.tss ?? "—"} | IF: ${activity.intensity_factor ?? "—"}
Avg HR: ${activity.avg_hr ?? "—"} bpm | RPE: ${activity.rpe ?? "—"}/10
${activity.athlete_comments ? `Notes: ${activity.athlete_comments}` : ""}

Write 2-3 sentences analyzing: 1) alignment with plan/phase, 2) effort quality, 3) key takeaway.`;

  const analysisText = await chat([{ role: "user", content: prompt }], {
    temperature: 0.4,
    maxTokens: 200,
  });

  // Cache it
  await db
    .from("activities")
    .update({ post_workout_analysis: analysisText })
    .eq("id", activityId);

  return c.json({ analysis: analysisText });
});

/** GET /analysis/:athleteId/sport-progress — per-sport progress summary */
analysis.get("/:athleteId/sport-progress", async (c) => {
  const athleteId = c.req.param("athleteId");
  const today = new Date().toISOString().slice(0, 10);

  // Check cache
  const { data: todayAnalysis } = await db
    .from("daily_analyses")
    .select("id, agent_output")
    .eq("athlete_id", athleteId)
    .eq("analysis_date", today)
    .single();

  const cached = (todayAnalysis?.agent_output as Record<string, unknown>)
    ?.sport_progress;
  if (cached) return c.json({ sportProgress: cached, cached: true });

  // Generate new analysis
  const since = new Date(Date.now() - 30 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const { data: activities } = await db
    .from("activities")
    .select("activity_date, sport, tss")
    .eq("athlete_id", athleteId)
    .gte("activity_date", since)
    .order("activity_date", { ascending: true });

  if (!activities || activities.length === 0) {
    return c.json({ sportProgress: [], cached: false });
  }

  // Compute per-sport stats (simplified)
  const sportMap = new Map<string, { count: number; totalTss: number }>();
  activities.forEach((a) => {
    const sport = (a.sport as string) ?? "other";
    const entry = sportMap.get(sport) ?? { count: 0, totalTss: 0 };
    entry.count++;
    entry.totalTss += (a.tss as number) ?? 0;
    sportMap.set(sport, entry);
  });

  const statsLines = [...sportMap.entries()]
    .map(
      ([sport, s]) =>
        `${sport}: ${s.count} sessions, avg TSS ${Math.round(s.totalTss / s.count)}`,
    )
    .join("\n");

  const prompt = `For each sport, write one sentence (20-30 words) assessing progress. Return JSON array: [{"sport":"...","summary":"..."}]\n\n${statsLines}`;

  let sportProgress: { sport: string; summary: string }[] = [];
  try {
    const raw = await chat([{ role: "user", content: prompt }], {
      temperature: 0.3,
      maxTokens: 300,
    });
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) sportProgress = JSON.parse(match[0]);
  } catch {
    // Return empty on parse failure
  }

  // Cache it
  if (todayAnalysis) {
    const updated = {
      ...(todayAnalysis.agent_output as Record<string, unknown>),
      sport_progress: sportProgress,
    };
    await db
      .from("daily_analyses")
      .update({ agent_output: updated })
      .eq("id", todayAnalysis.id);
  }

  return c.json({ sportProgress, cached: false });
});

// ─────────────────────────────────────────────────────────────────────────────
// NEW ANALYTICS CHARTS
// ─────────────────────────────────────────────────────────────────────────────

/** GET /analysis/:athleteId/acwr-chart — ACWR injury risk corridor */
analysis.get("/:athleteId/acwr-chart", async (c) => {
  const athleteId = c.req.param("athleteId");
  const days = parseInt(c.req.query("days") ?? "90", 10);

  const data = await getACWRChart(athleteId, days);
  return c.json({ data });
});

/** GET /analysis/:athleteId/hrv-baseline-chart — HRV baseline + 7-day avg */
analysis.get("/:athleteId/hrv-baseline-chart", async (c) => {
  const athleteId = c.req.param("athleteId");
  const days = parseInt(c.req.query("days") ?? "60", 10);

  const data = await getHRVBaselineChart(athleteId, days);
  return c.json({ data });
});

/** GET /analysis/:athleteId/readiness-performance-chart — Readiness vs Performance scatter */
analysis.get("/:athleteId/readiness-performance-chart", async (c) => {
  const athleteId = c.req.param("athleteId");
  const days = parseInt(c.req.query("days") ?? "90", 10);

  const data = await getReadinessPerformanceChart(athleteId, days);
  return c.json({ data });
});

/** GET /analysis/:athleteId/decoupling-trend-chart — Aerobic decoupling trends */
analysis.get("/:athleteId/decoupling-trend-chart", async (c) => {
  const athleteId = c.req.param("athleteId");
  const days = parseInt(c.req.query("days") ?? "90", 10);

  const result = await getDecouplingTrendChart(athleteId, days);
  return c.json(result);
});

export default analysis;
