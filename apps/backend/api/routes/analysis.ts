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

// Import composite processors
import { getBlockAnalysis } from "../../data/processors/blockAnalysis.js";
import {
  getRecoveryReadinessChart,
  getTrainingStressBalance,
  getTrainingLoadHistory,
  getBlockEffectivenessHistory,
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
      includeEffectiveness: include.includes("effectiveness"),
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
    includeEffectiveness: true,
  });

  return c.json({
    blockStartDate: result.blockStartDate,
    baselineCtl: result.fitness?.baselineCtl ?? 0,
    checkpoints: result.fitness?.checkpoints ?? [],
    effectiveness: result.effectiveness?.score ?? 0,
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

/** GET /analysis/:athleteId/block-history — last N blocks' effectiveness */
analysis.get("/:athleteId/block-history", async (c) => {
  const athleteId = c.req.param("athleteId");
  const numBlocks = parseInt(c.req.query("blocks") ?? "6", 10);

  const blocks = await getBlockEffectivenessHistory(athleteId, numBlocks);
  return c.json({ blocks });
});

/** GET /analysis/:athleteId/block-effectiveness-chart — current block metrics */
analysis.get("/:athleteId/block-effectiveness-chart", async (c) => {
  const athleteId = c.req.param("athleteId");
  const refDate = c.req.query("date") ?? new Date().toISOString().slice(0, 10);

  const result = await getBlockAnalysis(athleteId, refDate, {
    includeFitness: true,
    includeEffectiveness: true,
    includeZones: true,
    includeCompliance: true,
  });

  return c.json({
    blockStart: result.blockStartDate,
    blockEnd: result.blockEndDate,
    baselineCtl: result.fitness?.baselineCtl ?? 0,
    currentCtl:
      result.fitness?.checkpoints[result.fitness.checkpoints.length - 1]
        ?.actualCtl ?? 0,
    ctlGain:
      (result.fitness?.checkpoints[result.fitness.checkpoints.length - 1]
        ?.actualCtl ?? 0) - (result.fitness?.baselineCtl ?? 0),
    zonePercentages: result.zones ?? {},
    complianceRate: result.compliance?.overallCompliance.complianceRate ?? 100,
    effectivenessScore: result.effectiveness?.score ?? 0,
    progressiveOverloadScore:
      result.effectiveness?.components.progressiveOverload ?? 0,
    consistencyScore: result.effectiveness?.components.consistency ?? 0,
    monotonyScore: result.effectiveness?.components.monotony ?? 0,
  });
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
        .select("readiness_score, block_effectiveness")
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

  // Get block score from today's analysis (single source of truth)
  // If not available, get compliance for display purposes
  let blockScore = todayAnalysis?.block_effectiveness ?? null;
  let complianceRate = 100;
  let workoutsCompleted = 0;
  let workoutsPrescribed = 0;

  if (blockScore === null) {
    // Fallback: calculate if not in daily analysis (backward compatibility)
    const blockResult = await getBlockAnalysis(athleteId, today, {
      includeEffectiveness: true,
      includeCompliance: true,
    });
    blockScore = blockResult.effectiveness?.score ?? 0;
    complianceRate =
      blockResult.compliance?.overallCompliance.complianceRate ?? 100;
    workoutsCompleted =
      blockResult.compliance?.overallCompliance.workoutsCompleted ?? 0;
    workoutsPrescribed =
      blockResult.compliance?.overallCompliance.workoutsPrescribed ?? 0;
  } else {
    // Just get compliance for display (no recalculation of block score)
    const blockResult = await getBlockAnalysis(athleteId, today, {
      includeCompliance: true,
    });
    complianceRate =
      blockResult.compliance?.overallCompliance.complianceRate ?? 100;
    workoutsCompleted =
      blockResult.compliance?.overallCompliance.workoutsCompleted ?? 0;
    workoutsPrescribed =
      blockResult.compliance?.overallCompliance.workoutsPrescribed ?? 0;
  }

  return c.json({
    avgReadiness,
    currentReadiness: todayAnalysis?.readiness_score ?? avgReadiness,
    currentTsb: Math.round(currentTsb * 10) / 10,
    currentCtl: Math.round(currentCtl * 10) / 10,
    currentAtl: Math.round(currentAtl * 10) / 10,
    tsbStatus,
    blockScore: Math.round(blockScore),
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
