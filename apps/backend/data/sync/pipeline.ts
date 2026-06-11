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
  // Check for --full flag in command line args
  const isFullSync = process.argv.includes("--full");
  const daysBack = isFullSync ? 90 : 1;
  
  if (isFullSync) {
    console.log("[sync] 🔄 FULL SYNC MODE: syncing last 90 days");
  }

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
    syncWellness(isFullSync ? 90 : 60),
    syncActivities(daysBack),
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

// Only run if this file is executed directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  runSync().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
