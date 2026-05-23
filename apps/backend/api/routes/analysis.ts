import { Hono } from "hono";
import { db } from "../../db/client.js";
import {
  runDailyAnalysis,
  loadAthleteProfile,
  replanWeekWorkouts,
} from "../../agents/daily.js";
import { chat } from "../../agents/llm/adapter.js";

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

  // Run in background so the response returns immediately
  (async () => {
    // Load profile once — avoids repeated DB round-trips that exhaust connections
    let cachedProfile;
    try {
      cachedProfile = await loadAthleteProfile(athleteId);
    } catch (err) {
      console.error("[generate-week] Failed to load athlete profile:", err);
      return;
    }

    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const date = d.toISOString().slice(0, 10);

      // Build context from workouts already generated this loop
      const start = new Date().toISOString().slice(0, 10);
      const { data: planned } = await db
        .from("prescribed_workouts")
        .select("workout_date, sport, duration_min, intensity, agent_output")
        .eq("athlete_id", athleteId)
        .gte("workout_date", start)
        .lt("workout_date", date)
        .order("workout_date", { ascending: true });

      const upcomingWorkouts = (planned ?? []).map((w: any) => ({
        date: w.workout_date as string,
        sport: w.sport as string,
        durationMin: w.duration_min as number,
        intensity: w.intensity as string,
        periodizationPhase: (w.agent_output as { periodizationPhase?: string })
          ?.periodizationPhase,
      }));

      try {
        await runDailyAnalysis(
          athleteId,
          date,
          upcomingWorkouts,
          cachedProfile,
        );
      } catch (err) {
        console.error(`[generate-week] ${date}:`, err);
      }
    }
  })();

  return c.json({ started: true });
});

export default analysis;

// ─── New routes appended below ───────────────────────────────────────────────

/** GET /analysis/:athleteId/recent-activities — last 5 completed activities */
analysis.get("/:athleteId/recent-activities", async (c) => {
  const athleteId = c.req.param("athleteId");

  const { data, error } = await db
    .from("activities")
    .select(
      "id, activity_date, sport, pace_load, hr_load, power_load, efficiency_factor, name, duration_secs, distance_m, tss, intensity_factor, atl, ctl, joules, avg_hr, max_hr, avg_power, normalized_power, elevation_m, rpe, athlete_comments",
    )
    .eq("athlete_id", athleteId)
    .order("activity_date", { ascending: false })
    .limit(5);

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ activities: data ?? [] });
});

/** GET /analysis/:athleteId/activity-analysis/:activityId — cached AI post-workout analysis */
analysis.get("/:athleteId/activity-analysis/:activityId", async (c) => {
  const { activityId } = c.req.param();

  const { data: activity, error } = await db
    .from("activities")
    .select(
      "id, activity_date, sport, pace_load, hr_load, power_load, efficiency_factor, name, duration_secs, distance_m, tss, intensity_factor, avg_hr, avg_power, normalized_power, elevation_m, rpe, athlete_comments, post_workout_analysis",
    )
    .eq("id", activityId)
    .single();

  if (error || !activity) return c.json({ error: "Not found" }, 404);

  // Return cached result if available
  if (activity.post_workout_analysis) {
    return c.json({ analysis: activity.post_workout_analysis });
  }

  // Generate analysis
  const durMin = activity.duration_secs
    ? Math.round((activity.duration_secs as number) / 60)
    : null;
  const distKm = activity.distance_m
    ? ((activity.distance_m as number) / 1000).toFixed(1)
    : null;

  const prompt = `You are a sports coach. Write a concise 2-3 sentence post-workout analysis for this session. Focus on effort quality, any notable data patterns (high efficiency factor = aerobic drift, RPE vs objective load), and one key takeaway.

Activity: ${activity.sport} — ${activity.name ?? "untitled"}
Date: ${activity.activity_date}
Duration: ${durMin != null ? `${durMin} min` : "—"}${distKm ? ` | Distance: ${distKm} km` : ""}
TSS: ${activity.tss ?? "—"} | IF: ${activity.intensity_factor ?? "—"}
Avg HR: ${activity.avg_hr ?? "—"} bpm | Avg Power: ${activity.avg_power ?? "—"} W | NP: ${activity.normalized_power ?? "—"} W
Efficiency Factor: ${activity.efficiency_factor ?? "—"}
Elevation: ${activity.elevation_m != null ? `${activity.elevation_m} m` : "—"}
RPE: ${activity.rpe != null ? `${activity.rpe}/10` : "—"}
Pace Load: ${activity.pace_load ?? "—"} | HR Load: ${activity.hr_load ?? "—"} | Power Load: ${activity.power_load ?? "—"} 
Athlete notes: ${activity.athlete_comments ?? "none"}

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
