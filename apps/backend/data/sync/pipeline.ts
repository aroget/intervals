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

  const rows = entries.map((e) => ({
    athlete_id: ATHLETE_ID,
    log_date: e.id,
    hrv: e.hrv,
    hrv_score: e.hrvScore,
    rhr: e.restingHR,
    sleep_score: e.sleepScore,
    sleep_hours: e.sleepTime
      ? Math.round((e.sleepTime / 3600) * 10) / 10
      : null,
    raw_source: "intervals.icu",
    raw_data: e,
  }));

  if (!rows.length) return;

  const { error } = await db.from("wellness_logs").upsert(rows, {
    onConflict: "athlete_id,log_date",
    ignoreDuplicates: false,
  });

  if (error) throw new Error(`wellness upsert failed: ${error.message}`);
  console.log(`[sync] upserted ${rows.length} wellness entries`);
}

const SPORT_NORMALIZE: Record<string, string> = {
  ride: "bike",
  virtualride: "bike",
  ebikeride: "bike",
  run: "run",
  virtualrun: "run",
  trailrun: "run",
  swim: "swim",
  openwatersim: "swim",
  weighttraining: "strength",
  workout: "strength",
  yoga: "strength",
  walk: "run",
};

function normalizeSport(type: string | null | undefined): string {
  if (!type) return "other";
  return SPORT_NORMALIZE[type.toLowerCase()] ?? type.toLowerCase();
}

export async function syncActivities(daysBack = 1): Promise<void> {
  const oldest = toIso(daysBack);
  const newest = toIso(0);
  console.log(`[sync] activities ${oldest} → ${newest}`);

  const entries = await fetchActivities(oldest, newest);

  const rows = entries.map((a) => ({
    athlete_id: ATHLETE_ID,
    intervals_id: a.id,
    activity_date: a.start_date_local.slice(0, 10),
    sport: normalizeSport(a.type),
    name: a.name,
    duration_secs: a.moving_time,
    distance_m: a.distance,
    tss: a.icu_training_load,
    intensity_factor: a.icu_intensity,
    atl: a.icu_atl,
    ctl: a.icu_ctl,
    joules: a.icu_joules,
    avg_hr: a.average_heartrate,
    max_hr: a.max_heartrate,
    avg_power: a.icu_average_watts ?? a.average_watts,
    gap: a.gap,
    decoupling: a.decoupling,
    elevation_m: a.total_elevation_gain,
    rpe: a.icu_rpe,
    raw_data: a,
    pace_load: a.pace_load,
    hr_load: a.hr_load,
    power_load: a.power_load,
    efficiency_factor: a.icu_efficiency_factor,
  }));

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

// Allow direct execution: pnpm sync
runSync().catch((err) => {
  console.error(err);
  process.exit(1);
});
