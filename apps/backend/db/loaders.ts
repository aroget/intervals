import { db } from "./client.js";
import type { Activity, AthleteProfile, WellnessLog } from "../types.js";
import { fromActivityRow, fromWellnessRow } from "../data/intervals/mapper.js";

export async function loadProfile(athleteId: string): Promise<AthleteProfile> {
  const { data, error } = await db
    .from("athlete_profiles")
    .select("*")
    .eq("athlete_id", athleteId)
    .single();
  if (error || !data)
    throw new Error(
      `No athlete profile found for ${athleteId}: ${error?.message ?? "no data"} (code: ${error?.code})`,
    );
  return {
    id: data.id,
    athleteId: data.athlete_id,
    name: data.name,
    goals: data.goals,
    trainingPhilosophy: data.training_philosophy,
    disciplines: data.disciplines ?? [],
    weeklyMaxHours: data.weekly_max_hours ?? {},
    preferredMetrics: data.preferred_metrics ?? [],
    cycleStartDate: data.cycle_start_date,
    coachingNotes: data.coaching_notes ?? null,
    preferredTheme:
      (data.preferred_theme as "light" | "dark" | "system") ?? "system",
    ftp: data.ftp ?? null,
    runningThresholdPace: data.running_threshold_pace ?? null,
    lthr: data.lthr ?? null,
  };
}

/**
 * Load wellness logs for an athlete.
 * @param asOf  Reference date (YYYY-MM-DD). Defaults to today. Used to compute `since = asOf - daysBack`.
 */
export async function loadWellness(
  athleteId: string,
  daysBack: number,
  asOf?: string,
): Promise<WellnessLog[]> {
  const since = asOf ? new Date(asOf) : new Date();
  since.setDate(since.getDate() - daysBack);
  const { data } = await db
    .from("wellness_logs")
    .select("*")
    .eq("athlete_id", athleteId)
    .gte("log_date", since.toISOString().slice(0, 10))
    .order("log_date", { ascending: true });
  return (data ?? []).map((r: any) => fromWellnessRow(r));
}

/**
 * Load activities for an athlete.
 * @param asOf  Reference date (YYYY-MM-DD). Defaults to today. Used to compute `since = asOf - daysBack`.
 */
export async function loadActivities(
  athleteId: string,
  daysBack: number,
  asOf?: string,
): Promise<Activity[]> {
  const since = asOf ? new Date(asOf) : new Date();
  since.setDate(since.getDate() - daysBack);
  const { data } = await db
    .from("activities")
    .select("*")
    .eq("athlete_id", athleteId)
    .gte("activity_date", since.toISOString().slice(0, 10))
    .order("activity_date", { ascending: true });
  return (data ?? []).map((r: any) => fromActivityRow(r));
}
