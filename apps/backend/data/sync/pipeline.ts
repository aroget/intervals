/**
 * Sync pipeline: fetches data from Intervals.icu and upserts into Supabase.
 * Called by the GitHub Actions cron or `pnpm sync` manually.
 */
import "dotenv/config";
import { db } from "../../db/client.js";
import {
  fetchWellness,
  fetchActivities,
  fetchAthlete,
  extractThresholds,
} from "../intervals/client.js";
import { toActivityRow, toWellnessRow } from "../intervals/mapper.js";

function toIso(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

const ATHLETE_ID = process.env.INTERVALS_ATHLETE_ID!;

export async function syncWellness(daysBack = 60): Promise<void> {
  const oldest = toIso(daysBack);
  const newest = toIso(0);
  console.log(`[sync] wellness ${oldest} → ${newest}`);

  const entries = await fetchWellness(oldest, newest);

  const rows = entries.map((e) => toWellnessRow(e, ATHLETE_ID));

  if (!rows.length) return;

  const { error } = await db.from("wellness_logs").upsert(rows, {
    onConflict: "athlete_id,log_date",
    ignoreDuplicates: false,
  });

  if (error) throw new Error(`wellness upsert failed: ${error.message}`);
  console.log(`[sync] upserted ${rows.length} wellness entries`);
}

export async function syncActivities(daysBack = 1): Promise<void> {
  const oldest = toIso(daysBack);
  const newest = toIso(0);
  console.log(`[sync] activities ${oldest} → ${newest}`);

  const entries = await fetchActivities(oldest, newest);

  const rows = entries.map((a) => toActivityRow(a, ATHLETE_ID));

  if (!rows.length) return;

  const { error } = await db.from("activities").upsert(rows, {
    onConflict: "intervals_id",
    ignoreDuplicates: false,
  });

  if (error) throw new Error(`activities upsert failed: ${error.message}`);
  console.log(`[sync] upserted ${rows.length} activities`);
}

export async function runSync(): Promise<void> {
  // Verify a complete athlete profile exists before syncing.
  const { data: profile, error: profileError } = await db
    .from("athlete_profiles")
    .select("athlete_id, name")
    .eq("athlete_id", ATHLETE_ID)
    .single();

  if (profileError || !profile) {
    throw new Error(
      `No athlete profile found for ${ATHLETE_ID}.\n` +
        `Run \`pnpm setup\` first to create your profile.`,
    );
  }

  await Promise.all([
    syncWellness(),
    syncActivities(),
    syncAthleteThresholds(),
  ]);
  await markCompletedWorkouts(); // Mark prescribed workouts as completed based on synced activities
  console.log("[sync] complete");
}

/** Sync FTP and running threshold pace from Intervals.icu into the athlete profile */
async function syncAthleteThresholds(): Promise<void> {
  try {
    const athlete = await fetchAthlete();
    const { ftp, runningThresholdPace } = extractThresholds(athlete);

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (ftp !== null) updates.ftp = ftp;
    if (runningThresholdPace !== null)
      updates.running_threshold_pace = runningThresholdPace;

    if (Object.keys(updates).length > 1) {
      await db
        .from("athlete_profiles")
        .update(updates)
        .eq("athlete_id", ATHLETE_ID);
      console.log(
        `[sync] thresholds — FTP: ${ftp ?? "n/a"}W, run threshold: ${runningThresholdPace ?? "n/a"}m/km`,
      );
    } else {
      console.log("[sync] thresholds — none found in Intervals profile");
    }
  } catch (err) {
    // Non-fatal: if Intervals doesn't expose these fields, continue
    console.warn("[sync] thresholds sync skipped:", err);
  }
}

/**
 * Mark prescribed workouts as completed if an activity exists for that date.
 * Runs after syncActivities() to reconcile completed sessions with the plan.
 */
async function markCompletedWorkouts(): Promise<void> {
  try {
    // Get all activity dates for this athlete (last 60 days to cover sync window)
    const since = toIso(60);
    const { data: activities } = await db
      .from("activities")
      .select("activity_date, sport")
      .eq("athlete_id", ATHLETE_ID)
      .gte("activity_date", since);

    if (!activities || activities.length === 0) return;

    // Build a set of dates (and optionally date+sport pairs) that have activities
    const activityDates = new Set(
      activities.map((a: any) => a.activity_date as string),
    );

    // Mark any prescribed workouts for these dates as completed
    const { data: prescribedWorkouts } = await db
      .from("prescribed_workouts")
      .select("id, workout_date, completed")
      .eq("athlete_id", ATHLETE_ID)
      .gte("workout_date", since)
      .eq("completed", false); // Only update incomplete workouts

    if (!prescribedWorkouts || prescribedWorkouts.length === 0) return;

    const toComplete = prescribedWorkouts.filter((w: any) =>
      activityDates.has(w.workout_date as string),
    );

    if (toComplete.length > 0) {
      const ids = toComplete.map((w: any) => w.id);
      await db
        .from("prescribed_workouts")
        .update({ completed: true })
        .in("id", ids);
      console.log(`[sync] marked ${toComplete.length} workouts as completed`);
    }
  } catch (err) {
    // Non-fatal: log but don't crash sync
    console.warn("[sync] markCompletedWorkouts failed:", err);
  }
}

// Allow direct execution: pnpm sync
runSync().catch((err) => {
  console.error(err);
  process.exit(1);
});
