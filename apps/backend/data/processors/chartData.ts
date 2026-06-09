/**
 * Composite processor for chart data aggregation.
 * Provides time-series data for various metrics charts.
 */

import { db } from "../../db/client.js";
import { loadActivities } from "../../db/loaders.js";

/**
 * Get recovery + readiness chart data (daily readiness scores + TSS).
 */
export async function getRecoveryReadinessChart(
  athleteId: string,
  days: number = 30,
): Promise<
  Array<{
    date: string;
    readinessScore: number | null;
    tss: number;
    hrv: number | null;
  }>
> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);

  // Get daily analyses for readiness scores
  const { data: analyses } = await db
    .from("daily_analyses")
    .select("analysis_date, readiness_score")
    .eq("athlete_id", athleteId)
    .gte("analysis_date", sinceStr)
    .order("analysis_date", { ascending: true });

  const readinessMap = new Map<string, number>();
  (analyses ?? []).forEach((a: any) => {
    readinessMap.set(a.analysis_date, a.readiness_score);
  });

  // Get wellness data for HRV
  const { data: wellness } = await db
    .from("wellness")
    .select("log_date, hrv")
    .eq("athlete_id", athleteId)
    .gte("log_date", sinceStr)
    .order("log_date", { ascending: true });

  const hrvMap = new Map<string, number>();
  (wellness ?? []).forEach((w: any) => {
    if (w.hrv != null) hrvMap.set(w.log_date, w.hrv);
  });

  // Get activities for TSS
  const activities = await loadActivities(athleteId, days);

  const tssMap = new Map<string, number>();
  activities.forEach((a) => {
    const existing = tssMap.get(a.activityDate) ?? 0;
    tssMap.set(a.activityDate, existing + (a.tss ?? 0));
  });

  // Build daily series
  const series = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const dateStr = d.toISOString().slice(0, 10);

    series.push({
      date: dateStr,
      readinessScore: readinessMap.get(dateStr) ?? null,
      tss: tssMap.get(dateStr) ?? 0,
      hrv: hrvMap.get(dateStr) ?? null,
    });
  }

  return series;
}

/**
 * Get training stress balance chart (ATL/CTL/TSB).
 */
export async function getTrainingStressBalance(
  athleteId: string,
  days: number = 90,
): Promise<
  Array<{
    date: string;
    atl: number | null;
    ctl: number | null;
    tsb: number | null;
    tss: number;
  }>
> {
  const activities = await loadActivities(athleteId, days);

  // Build daily TSS map
  const dailyTssMap = new Map<string, number>();
  activities.forEach((a) => {
    const existing = dailyTssMap.get(a.activityDate) ?? 0;
    dailyTssMap.set(a.activityDate, existing + (a.tss ?? 0));
  });

  // Get ATL/CTL from activities (stored per activity)
  const atlMap = new Map<string, number>();
  const ctlMap = new Map<string, number>();

  activities.forEach((a) => {
    if (a.atl != null) atlMap.set(a.activityDate, a.atl);
    if (a.ctl != null) ctlMap.set(a.activityDate, a.ctl);
  });

  // Build series
  const series = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const dateStr = d.toISOString().slice(0, 10);

    const atl = atlMap.get(dateStr) ?? null;
    const ctl = ctlMap.get(dateStr) ?? null;
    const tsb = atl != null && ctl != null ? ctl - atl : null;

    series.push({
      date: dateStr,
      atl,
      ctl,
      tsb,
      tss: dailyTssMap.get(dateStr) ?? 0,
    });
  }

  return series;
}

/**
 * Get training load history (weekly TSS aggregation).
 */
export async function getTrainingLoadHistory(
  athleteId: string,
  weeks: number = 16,
): Promise<
  Array<{
    weekStart: string;
    weekEnd: string;
    weekNum: number;
    totalTss: number;
    workoutCount: number;
  }>
> {
  const days = weeks * 7;
  const activities = await loadActivities(athleteId, days);

  // Group activities by week
  const weekMap = new Map<
    string,
    { totalTss: number; workoutCount: number; weekEnd: string }
  >();

  activities.forEach((a) => {
    const activityDate = new Date(a.activityDate);
    const dayOfWeek = activityDate.getDay();
    const weekStart = new Date(activityDate);
    weekStart.setDate(activityDate.getDate() - dayOfWeek);
    const weekStartStr = weekStart.toISOString().slice(0, 10);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);

    const existing = weekMap.get(weekStartStr) ?? {
      totalTss: 0,
      workoutCount: 0,
      weekEnd: weekEndStr,
    };

    weekMap.set(weekStartStr, {
      totalTss: existing.totalTss + (a.tss ?? 0),
      workoutCount: existing.workoutCount + 1,
      weekEnd: weekEndStr,
    });
  });

  // Convert to array
  const series = Array.from(weekMap.entries())
    .map(([weekStart, data], idx) => ({
      weekStart,
      weekEnd: data.weekEnd,
      weekNum: idx + 1,
      totalTss: Math.round(data.totalTss),
      workoutCount: data.workoutCount,
    }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  return series;
}

/**
 * Get block effectiveness history (last N blocks).
 */
export async function getBlockEffectivenessHistory(
  athleteId: string,
  numBlocks: number = 6,
): Promise<
  Array<{
    blockNumber: number;
    startDate: string;
    endDate: string;
    effectiveness: number;
    isCurrent: boolean;
  }>
> {
  // Get athlete profile for cycle start
  const { data: profile } = await db
    .from("athlete_profiles")
    .select("cycle_start_date")
    .eq("athlete_id", athleteId)
    .single();

  if (!profile?.cycle_start_date) {
    return [];
  }

  const cycleStart = new Date(profile.cycle_start_date);
  const today = new Date();
  const daysSinceStart = Math.floor(
    (today.getTime() - cycleStart.getTime()) / 86_400_000,
  );
  const currentBlockNumber = Math.floor(daysSinceStart / 28);

  const blocks = [];

  for (let i = Math.max(0, currentBlockNumber - numBlocks + 1); i <= currentBlockNumber; i++) {
    const blockStart = new Date(cycleStart);
    blockStart.setDate(cycleStart.getDate() + i * 28);
    const blockEnd = new Date(blockStart);
    blockEnd.setDate(blockStart.getDate() + 27);

    const blockStartStr = blockStart.toISOString().slice(0, 10);
    const blockEndStr = blockEnd.toISOString().slice(0, 10);

    // Get most recent block_effectiveness for this block
    const { data: analysis } = await db
      .from("daily_analyses")
      .select("block_effectiveness")
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

  return blocks;
}
