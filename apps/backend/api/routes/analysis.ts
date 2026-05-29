import { Hono } from "hono";
import { db } from "../../db/client.js";
import {
  runDailyAnalysis,
  loadAthleteProfile,
  replanWeekWorkouts,
} from "../../agents/daily.js";
import { chat } from "../../agents/llm/adapter.js";
import { getCyclePosition } from "../../data/processors/cycleTracker.js";
import {
  calculateBlockCompliance,
  calculateWeeklyCompliance,
} from "../../data/processors/weeklyCompliance.js";
import {
  analyzeFitnessTrajectory,
  calculateBlockEffectiveness,
} from "../../data/processors/fitnessTrajectory.js";
import { loadActivities, loadWellness } from "../../db/loaders.js";
import { analyzeAllRecoveryPatterns } from "../../data/processors/recoveryPatterns.js";
import { predictTomorrowReadiness } from "../../data/processors/readinessPrediction.js";
import { detectAllComplianceFrictions } from "../../data/processors/complianceFriction.js";
import { buildComputedMetrics } from "../../data/processors/readiness.js";

const analysis = new Hono();
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

/** POST /analysis/:athleteId/replan-week — regenerate the next 7 days of prescribed workouts */
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

/** POST /analysis/:athleteId/run — manually trigger daily analysis (always force-regenerates) */
analysis.post("/:athleteId/run", async (c) => {
  const athleteId = c.req.param("athleteId");
  const today = new Date().toISOString().slice(0, 10);

  try {
    // Delete today's existing records so the idempotency guard doesn't skip.
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

/** GET /analysis/:athleteId/history — last 30 days of analyses */
analysis.get("/:athleteId/history", async (c) => {
  const athleteId = c.req.param("athleteId");
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data, error } = await db
    .from("daily_analyses")
    .select("analysis_date, readiness_score, hrv_trend, agent_output")
    .eq("athlete_id", athleteId)
    .gte("analysis_date", since.toISOString().slice(0, 10))
    .order("analysis_date", { ascending: false });

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ history: data });
});

/** GET /analysis/:athleteId/wellness — last 7 days of HRV, RHR, sleep */
analysis.get("/:athleteId/wellness", async (c) => {
  const athleteId = c.req.param("athleteId");
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const { data, error } = await db
    .from("wellness_logs")
    .select(
      "log_date, hrv, hrv_score, rhr, sleep_score, sleep_hours, sleep_quality",
    )
    .eq("athlete_id", athleteId)
    .gte("log_date", since.toISOString().slice(0, 10))
    .order("log_date", { ascending: false });

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ wellness: data ?? [] });
});

/** GET /analysis/:athleteId/upcoming — next 7 days of prescribed workouts */
analysis.get("/:athleteId/upcoming", async (c) => {
  const athleteId = c.req.param("athleteId");
  const today = new Date().toISOString().slice(0, 10);
  const until = new Date();
  until.setDate(until.getDate() + 7);

  const { data, error } = await db
    .from("prescribed_workouts")
    .select("workout_date, sport, duration_min, intensity, agent_output")
    .eq("athlete_id", athleteId)
    .gte("workout_date", today)
    .lte("workout_date", until.toISOString().slice(0, 10))
    .order("workout_date", { ascending: true });

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ upcoming: data ?? [] });
});

/** POST /analysis/:athleteId/generate-week — generate workouts for the next 7 days (fire-and-forget) */
analysis.post("/:athleteId/generate-week", async (c) => {
  const athleteId = c.req.param("athleteId");

  // Run in background so the response returns immediately.
  // Uses replanWeekWorkouts which only writes to prescribed_workouts —
  // never daily_analyses — so future-dated stale analyses cannot accumulate.
  (async () => {
    try {
      await replanWeekWorkouts(athleteId, undefined, undefined, 7);
    } catch (err) {
      console.error("[generate-week]", err);
    }
  })();

  return c.json({ started: true });
});

/** GET /analysis/:athleteId/block-history — last 6 blocks' effectiveness scores */
analysis.get("/:athleteId/block-history", async (c) => {
  const athleteId = c.req.param("athleteId");

  // Get athlete profile for cycle start
  const { data: profile } = await db
    .from("athlete_profiles")
    .select("cycle_start_date")
    .eq("athlete_id", athleteId)
    .single();

  if (!profile?.cycle_start_date) {
    return c.json({ blocks: [] });
  }

  const cycleStart = new Date(profile.cycle_start_date);
  const today = new Date();
  const daysSinceStart = Math.floor(
    (today.getTime() - cycleStart.getTime()) / 86_400_000,
  );
  const currentBlockNumber = Math.floor(daysSinceStart / 28);

  // Get last 6 blocks (or fewer if not enough history)
  const blocks = [];
  const startBlock = Math.max(0, currentBlockNumber - 5);

  for (let i = startBlock; i <= currentBlockNumber; i++) {
    const blockStart = new Date(cycleStart);
    blockStart.setDate(cycleStart.getDate() + i * 28);
    const blockEnd = new Date(blockStart);
    blockEnd.setDate(blockStart.getDate() + 27);

    const blockStartStr = blockStart.toISOString().slice(0, 10);
    const blockEndStr = blockEnd.toISOString().slice(0, 10);

    // Get the last analysis in this block that has block_effectiveness
    const { data: analysis } = await db
      .from("daily_analyses")
      .select("block_effectiveness, analysis_date")
      .eq("athlete_id", athleteId)
      .gte("analysis_date", blockStartStr)
      .lte("analysis_date", blockEndStr)
      .not("block_effectiveness", "is", null)
      .order("analysis_date", { ascending: false })
      .limit(1)
      .single();

    if (analysis?.block_effectiveness != null) {
      blocks.push({
        blockNumber: i + 1,
        startDate: blockStartStr,
        endDate: blockEndStr,
        effectiveness: analysis.block_effectiveness,
        isCurrent: i === currentBlockNumber,
      });
    }
  }

  return c.json({ blocks });
});

/** GET /analysis/:athleteId/training-load-history — TSS per week for last 16 weeks */
analysis.get("/:athleteId/training-load-history", async (c) => {
  const athleteId = c.req.param("athleteId");

  // Get athlete profile for cycle start
  const { data: profile } = await db
    .from("athlete_profiles")
    .select("cycle_start_date")
    .eq("athlete_id", athleteId)
    .single();

  // Get activities from last 16 weeks
  const since = new Date();
  since.setDate(since.getDate() - 16 * 7);

  const { data: activities } = await db
    .from("activities")
    .select("activity_date, tss")
    .eq("athlete_id", athleteId)
    .gte("activity_date", since.toISOString().slice(0, 10))
    .order("activity_date", { ascending: true });

  if (!activities || activities.length === 0) {
    return c.json({ weeks: [] });
  }

  // Group by week (Monday start)
  const weekMap = new Map<
    string,
    { weekStart: string; totalTss: number; activities: number }
  >();

  activities.forEach((a) => {
    if (a.tss == null) return;
    const date = new Date(a.activity_date + "T00:00:00");
    const dayOfWeek = date.getDay();
    const monday = new Date(date);
    monday.setDate(date.getDate() - ((dayOfWeek + 6) % 7)); // Get Monday
    const weekKey = monday.toISOString().slice(0, 10);

    const existing = weekMap.get(weekKey) ?? {
      weekStart: weekKey,
      totalTss: 0,
      activities: 0,
    };
    existing.totalTss += a.tss;
    existing.activities += 1;
    weekMap.set(weekKey, existing);
  });

  const weeks = Array.from(weekMap.values()).sort((a, b) =>
    a.weekStart.localeCompare(b.weekStart),
  );

  // Add cycle week information if available
  if (profile?.cycle_start_date) {
    const cycleStart = new Date(profile.cycle_start_date);
    weeks.forEach((week) => {
      const weekDate = new Date(week.weekStart + "T00:00:00");
      const daysSinceStart = Math.floor(
        (weekDate.getTime() - cycleStart.getTime()) / 86_400_000,
      );
      const cycleWeek = (Math.floor(daysSinceStart / 7) % 4) + 1;
      const weekTypes = ["Base", "Build", "Peak", "Recovery"];
      (week as any).cycleWeek = cycleWeek;
      (week as any).weekType = weekTypes[cycleWeek - 1];
      (week as any).isRecoveryWeek = cycleWeek === 4;
    });
  }

  return c.json({ weeks });
});

/** GET /analysis/:athleteId/recovery-patterns — detected recovery patterns */
analysis.get("/:athleteId/recovery-patterns", async (c) => {
  const athleteId = c.req.param("athleteId");

  const [wellness, activities] = await Promise.all([
    loadWellness(athleteId, 90),
    loadActivities(athleteId, 90),
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

  // Get last 28 days (current block)
  const since = new Date();
  since.setDate(since.getDate() - 28);
  const sinceStr = since.toISOString().slice(0, 10);

  const [{ data: workouts }, activities] = await Promise.all([
    db
      .from("prescribed_workouts")
      .select("workout_date, sport, duration_min, intensity, session_type")
      .eq("athlete_id", athleteId)
      .gte("workout_date", sinceStr)
      .order("workout_date", { ascending: true }),
    loadActivities(athleteId, 28),
  ]);

  if (!workouts || workouts.length === 0) {
    return c.json({ frictions: [] });
  }

  const frictions = detectAllComplianceFrictions(workouts, activities);

  return c.json({ frictions });
});

export default analysis;

// ─── New routes appended below ───────────────────────────────────────────────

/** GET /analysis/:athleteId/recent-activities — last 5 completed activities */
analysis.get("/:athleteId/recent-activities", async (c) => {
  const athleteId = c.req.param("athleteId");

  const { data, error } = await db
    .from("activities")
    .select(
      "id, activity_date, sport, pace_load, hr_load, power_load, efficiency_factor, name, duration_secs, distance_m, tss, intensity_factor, atl, ctl, joules, avg_hr, max_hr, avg_power, normalized_power, elevation_m, rpe, athlete_comments, average_temp",
    )
    .eq("athlete_id", athleteId)
    .order("activity_date", { ascending: false })
    .limit(5);

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ activities: data ?? [] });
});

/** GET /analysis/:athleteId/activity-analysis/:activityId — cached AI post-workout analysis */
analysis.get("/:athleteId/activity-analysis/:activityId", async (c) => {
  const { activityId, athleteId } = c.req.param();

  const { data: activity, error } = await db
    .from("activities")
    .select(
      "id, athlete_id, activity_date, sport, pace_load, hr_load, power_load, efficiency_factor, name, duration_secs, distance_m, tss, intensity_factor, avg_hr, avg_power, normalized_power, elevation_m, rpe, athlete_comments, post_workout_analysis, average_temp",
    )
    .eq("id", activityId)
    .single();

  if (error || !activity) return c.json({ error: "Not found" }, 404);

  // Return cached result if available
  if (activity.post_workout_analysis) {
    return c.json({ analysis: activity.post_workout_analysis });
  }

  // Fetch training context: athlete profile (for cycle position) and prescribed workout
  const [{ data: profile }, { data: prescribed }] = await Promise.all([
    db
      .from("athlete_profiles")
      .select("cycle_start_date")
      .eq("athlete_id", activity.athlete_id)
      .single(),
    db
      .from("prescribed_workouts")
      .select("sport, duration_min, intensity, rationale, structure")
      .eq("athlete_id", activity.athlete_id)
      .eq("workout_date", activity.activity_date)
      .single(),
  ]);

  // Build training phase context
  let cycleContext = "";
  if (profile?.cycle_start_date) {
    const cycle = getCyclePosition(
      profile.cycle_start_date as string,
      activity.activity_date as string,
    );
    cycleContext = `\nTraining Phase: Week ${cycle.weekNumber} (${cycle.weekType}) of 4-week cycle`;
  }

  // Build prescribed workout context
  let prescribedContext = "";
  if (prescribed) {
    const structureDesc = prescribed.structure
      ? `\n  - Structure: ${JSON.stringify(prescribed.structure).slice(0, 100)}...`
      : "";
    prescribedContext = `\nPrescribed Workout:
  - Sport: ${prescribed.sport ?? "any"}
  - Target Duration: ${prescribed.duration_min ?? "flexible"} min
  - Intensity: ${prescribed.intensity ?? "moderate"}
  - Rationale: ${prescribed.rationale ?? "—"}${structureDesc}`;
  }

  // Generate analysis
  const durMin = activity.duration_secs
    ? Math.round((activity.duration_secs as number) / 60)
    : null;
  const distKm = activity.distance_m
    ? ((activity.distance_m as number) / 1000).toFixed(1)
    : null;

  const prompt = `You are a sports coach analyzing a completed workout.${cycleContext}${prescribedContext}

Completed Activity: ${activity.sport} — ${activity.name ?? "untitled"}
Date: ${activity.activity_date}
Duration: ${durMin != null ? `${durMin} min` : "—"}${distKm ? ` | Distance: ${distKm} km` : ""}
TSS: ${activity.tss ?? "—"} | IF: ${activity.intensity_factor ?? "—"}
Avg HR: ${activity.avg_hr ?? "—"} bpm | Avg Power: ${activity.avg_power ?? "—"} W | NP: ${activity.normalized_power ?? "—"} W
Efficiency Factor: ${activity.efficiency_factor ?? "—"}
Elevation: ${activity.elevation_m != null ? `${activity.elevation_m} m` : "—"}
Average Temp: ${activity.average_temp != null ? `${activity.average_temp}°C` : "—"}
RPE: ${activity.rpe != null ? `${activity.rpe}/10` : "—"}
Pace Load: ${activity.pace_load ?? "—"} | HR Load: ${activity.hr_load ?? "—"} | Power Load: ${activity.power_load ?? "—"} 
Athlete notes: ${activity.athlete_comments ?? "none"}

Write a 2-3 sentence analysis covering:
1. How well this aligns with the prescribed plan (if any) and training phase
2. Effort quality and data patterns (efficiency factor, RPE vs objective load, etc.)
3. One key takeaway or adjustment

Write only the analysis text, no headers or labels.`;

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

/** GET /analysis/:athleteId/sport-progress — per-sport progress summary (cached daily) */
analysis.get("/:athleteId/sport-progress", async (c) => {
  const athleteId = c.req.param("athleteId");
  const today = new Date().toISOString().slice(0, 10);

  // Check cache in today's daily_analysis agent_output
  const { data: todayAnalysis } = await db
    .from("daily_analyses")
    .select("id, agent_output")
    .eq("athlete_id", athleteId)
    .eq("analysis_date", today)
    .single();

  const cached = (todayAnalysis?.agent_output as Record<string, unknown>)
    ?.sport_progress;
  if (cached) return c.json({ sportProgress: cached, cached: true });

  // Query last 30 days of activities
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const midpoint = new Date();
  midpoint.setDate(midpoint.getDate() - 15);

  const { data: activities } = await db
    .from("activities")
    .select("activity_date, sport, tss, duration_secs")
    .eq("athlete_id", athleteId)
    .gte("activity_date", since.toISOString().slice(0, 10))
    .order("activity_date", { ascending: true });

  if (!activities || activities.length === 0) {
    return c.json({ sportProgress: [], cached: false });
  }

  // Compute per-sport stats
  const midStr = midpoint.toISOString().slice(0, 10);
  const sportMap = new Map<
    string,
    { first: number[]; second: number[]; count: number; totalTss: number }
  >();

  for (const a of activities) {
    const sport = (a.sport as string) ?? "other";
    if (!sportMap.has(sport))
      sportMap.set(sport, { first: [], second: [], count: 0, totalTss: 0 });
    const entry = sportMap.get(sport)!;
    entry.count++;
    const tss = (a.tss as number | null) ?? 0;
    entry.totalTss += tss;
    if ((a.activity_date as string) < midStr) entry.first.push(tss);
    else entry.second.push(tss);
  }

  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const statsLines = [...sportMap.entries()]
    .map(([sport, s]) => {
      const firstAvg = avg(s.first);
      const secondAvg = avg(s.second);
      const trendPct =
        firstAvg > 0
          ? Math.round(((secondAvg - firstAvg) / firstAvg) * 100)
          : 0;
      return `${sport}: ${s.count} sessions, avg TSS ${Math.round(s.totalTss / s.count)}, trend ${trendPct > 0 ? "+" : ""}${trendPct}% (last 15 vs prior 15 days)`;
    })
    .join("\n");

  const prompt = `You are a sports coach. For each sport below, write exactly one sentence (20-30 words) assessing whether the athlete is progressing, maintaining, or declining. Be specific about the trend percentage. Return as a JSON array: [{"sport":"run","summary":"..."}]

${statsLines}`;

  let sportProgress: { sport: string; summary: string }[] = [];
  try {
    const raw = await chat([{ role: "user", content: prompt }], {
      temperature: 0.3,
      maxTokens: 300,
    });
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) sportProgress = JSON.parse(match[0]);
  } catch {
    // Return empty on parse failure rather than crashing
  }

  // Cache in today's daily_analysis if it exists
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

/** GET /analysis/:athleteId/block-overview — get current 4-week training block with all workouts */
analysis.get("/:athleteId/block-overview", async (c) => {
  const athleteId = c.req.param("athleteId");
  const refDate = c.req.query("date") ?? new Date().toISOString().slice(0, 10);

  // Get athlete's cycle start date
  const { data: profile } = await db
    .from("athlete_profiles")
    .select("cycle_start_date")
    .eq("athlete_id", athleteId)
    .single();

  if (!profile?.cycle_start_date) {
    return c.json({ error: "No training cycle configured" }, 404);
  }

  // Calculate current block boundaries (28-day cycles)
  const cycleStart = new Date(profile.cycle_start_date);
  const refDateObj = new Date(refDate);
  const daysSinceStart = Math.floor(
    (refDateObj.getTime() - cycleStart.getTime()) / 86_400_000,
  );
  const currentBlockStart = new Date(cycleStart);
  currentBlockStart.setDate(
    cycleStart.getDate() + Math.floor(daysSinceStart / 28) * 28,
  );
  const blockStartStr = currentBlockStart.toISOString().slice(0, 10);
  const blockEndDate = new Date(currentBlockStart);
  blockEndDate.setDate(currentBlockStart.getDate() + 27);
  const blockEndStr = blockEndDate.toISOString().slice(0, 10);

  // Get all prescribed workouts in this block
  const { data: workouts } = await db
    .from("prescribed_workouts")
    .select("*")
    .eq("athlete_id", athleteId)
    .gte("workout_date", blockStartStr)
    .lte("workout_date", blockEndStr)
    .order("workout_date");

  // Get all completed activities in this block
  const { data: activities } = await db
    .from("activities")
    .select("*")
    .eq("athlete_id", athleteId)
    .gte("activity_date", blockStartStr)
    .lte("activity_date", blockEndStr);

  // Build week-by-week structure
  const weeks = [];
  for (let weekNum = 0; weekNum < 4; weekNum++) {
    const weekStart = new Date(currentBlockStart);
    weekStart.setDate(currentBlockStart.getDate() + weekNum * 7);
    const weekStartStr = weekStart.toISOString().slice(0, 10);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);

    const weekWorkouts =
      workouts?.filter(
        (w: any) =>
          w.workout_date >= weekStartStr && w.workout_date <= weekEndStr,
      ) ?? [];
    const weekActivities =
      activities?.filter(
        (a: any) =>
          a.activity_date >= weekStartStr && a.activity_date <= weekEndStr,
      ) ?? [];

    const weekTypes = ["base", "build", "peak", "recovery"];
    const targetTss = [300, 450, 550, 250]; // Approximate targets by week

    // Build days array
    const days = [];
    for (let dayNum = 0; dayNum < 7; dayNum++) {
      const dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + dayNum);
      const dayDateStr = dayDate.toISOString().slice(0, 10);

      const workout = weekWorkouts.find(
        (w: any) => w.workout_date === dayDateStr,
      );
      const activity = weekActivities.find(
        (a: any) => a.activity_date === dayDateStr,
      );

      days.push({
        date: dayDateStr,
        dayOfWeek: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
          dayDate.getDay()
        ],
        workout: workout ?? null,
        activity: activity ?? null,
        completed: !!activity,
      });
    }

    const actualTss = weekActivities.reduce(
      (sum: number, a: any) => sum + (a.tss ?? 0),
      0,
    );

    weeks.push({
      weekNumber: weekNum + 1,
      weekType: weekTypes[weekNum],
      startDate: weekStartStr,
      endDate: weekEndStr,
      targetTss: targetTss[weekNum],
      actualTss,
      days,
    });
  }

  // Determine current week
  const currentWeek = Math.floor(
    (refDateObj.getTime() - currentBlockStart.getTime()) / (86_400_000 * 7),
  );

  return c.json({
    block: {
      startDate: blockStartStr,
      endDate: blockEndStr,
      weeks,
      currentWeek: Math.min(currentWeek + 1, 4),
      currentDay: refDate,
    },
  });
});

/** GET /analysis/:athleteId/compliance — weekly compliance for current block */
analysis.get("/:athleteId/compliance", async (c) => {
  const athleteId = c.req.param("athleteId");
  const refDate = c.req.query("date") ?? new Date().toISOString().slice(0, 10);

  // Get athlete's cycle start date
  const { data: profile } = await db
    .from("athlete_profiles")
    .select("cycle_start_date")
    .eq("athlete_id", athleteId)
    .single();

  if (!profile?.cycle_start_date) {
    return c.json({ error: "No training cycle configured" }, 404);
  }

  // Calculate current block boundaries
  const cycleStart = new Date(profile.cycle_start_date);
  const refDateObj = new Date(refDate);
  const daysSinceStart = Math.floor(
    (refDateObj.getTime() - cycleStart.getTime()) / 86_400_000,
  );
  const currentBlockStart = new Date(cycleStart);
  currentBlockStart.setDate(
    cycleStart.getDate() + Math.floor(daysSinceStart / 28) * 28,
  );
  const blockStartStr = currentBlockStart.toISOString().slice(0, 10);
  const blockEndDate = new Date(currentBlockStart);
  blockEndDate.setDate(currentBlockStart.getDate() + 27);
  const blockEndStr = blockEndDate.toISOString().slice(0, 10);

  // Get prescribed workouts for this block
  const { data: workouts } = await db
    .from("prescribed_workouts")
    .select("workout_date, sport, duration_min, intensity")
    .eq("athlete_id", athleteId)
    .gte("workout_date", blockStartStr)
    .lte("workout_date", blockEndStr)
    .order("workout_date");

  // Get activities (using loader which transforms to camelCase)
  const activities = await loadActivities(athleteId, 90, blockEndStr);

  const reports = calculateBlockCompliance(
    blockStartStr,
    workouts ?? [],
    activities,
  );

  // Calculate overall block stats
  const totalCompleted = reports.reduce(
    (sum, r) => sum + r.workoutsCompleted,
    0,
  );
  const totalPrescribed = reports.reduce(
    (sum, r) => sum + r.workoutsPrescribed,
    0,
  );
  const overallRate =
    totalPrescribed > 0
      ? Math.round((totalCompleted / totalPrescribed) * 100)
      : 100;

  const totalTargetTss = reports.reduce((sum, r) => sum + r.targetTss, 0);
  const totalActualTss = reports.reduce((sum, r) => sum + r.actualTss, 0);
  const overallTssRate =
    totalTargetTss > 0
      ? Math.round((totalActualTss / totalTargetTss) * 100)
      : 0;

  return c.json({
    blockStartDate: blockStartStr,
    blockEndDate: blockEndStr,
    weeklyReports: reports,
    overallCompliance: {
      workoutsCompleted: totalCompleted,
      workoutsPrescribed: totalPrescribed,
      complianceRate: overallRate,
      tssComplianceRate: overallTssRate,
    },
  });
});

/** GET /analysis/:athleteId/fitness-trajectory — CTL progression vs expected */
analysis.get("/:athleteId/fitness-trajectory", async (c) => {
  const athleteId = c.req.param("athleteId");
  const refDate = c.req.query("date") ?? new Date().toISOString().slice(0, 10);

  // Get athlete's cycle start date
  const { data: profile } = await db
    .from("athlete_profiles")
    .select("cycle_start_date")
    .eq("athlete_id", athleteId)
    .single();

  if (!profile?.cycle_start_date) {
    return c.json({ error: "No training cycle configured" }, 404);
  }

  // Calculate current block boundaries
  const cycleStart = new Date(profile.cycle_start_date);
  const refDateObj = new Date(refDate);
  const daysSinceStart = Math.floor(
    (refDateObj.getTime() - cycleStart.getTime()) / 86_400_000,
  );
  const currentBlockStart = new Date(cycleStart);
  currentBlockStart.setDate(
    cycleStart.getDate() + Math.floor(daysSinceStart / 28) * 28,
  );
  const blockStartStr = currentBlockStart.toISOString().slice(0, 10);

  // Get activities including pre-block to establish baseline CTL
  const activities = await loadActivities(athleteId, 120, blockStartStr);

  // Get baseline CTL (from last activity before block)
  const preBlockActivities = activities.filter(
    (a) => a.activityDate < blockStartStr,
  );
  const baselineCtl =
    preBlockActivities[preBlockActivities.length - 1]?.ctl ?? 70;

  // Get block activities
  const blockActivities = activities.filter(
    (a) => a.activityDate >= blockStartStr,
  );

  const checkpoints = analyzeFitnessTrajectory(
    blockStartStr,
    baselineCtl,
    blockActivities,
  );

  // Calculate block effectiveness
  const blockEndCtl =
    checkpoints[checkpoints.length - 1]?.actualCtl ?? baselineCtl;

  // Get prescribed workouts for compliance calculation
  const blockEndDate = new Date(currentBlockStart);
  blockEndDate.setDate(currentBlockStart.getDate() + 27);
  const blockEndStr = blockEndDate.toISOString().slice(0, 10);

  const { data: workouts } = await db
    .from("prescribed_workouts")
    .select("workout_date, sport, duration_min, intensity")
    .eq("athlete_id", athleteId)
    .gte("workout_date", blockStartStr)
    .lte("workout_date", blockEndStr);

  const reports = calculateBlockCompliance(
    blockStartStr,
    workouts ?? [],
    activities,
  );

  const totalCompleted = reports.reduce(
    (sum, r) => sum + r.workoutsCompleted,
    0,
  );
  const totalPrescribed = reports.reduce(
    (sum, r) => sum + r.workoutsPrescribed,
    0,
  );
  const overallCompliance =
    totalPrescribed > 0
      ? Math.round((totalCompleted / totalPrescribed) * 100)
      : 100;

  const overtrainingDays = checkpoints.filter(
    (c) => c.trend === "stalled",
  ).length;

  const effectiveness = calculateBlockEffectiveness(
    baselineCtl,
    blockEndCtl,
    overallCompliance,
    overtrainingDays,
  );

  return c.json({
    blockStartDate: blockStartStr,
    baselineCtl,
    checkpoints,
    effectiveness,
  });
});
