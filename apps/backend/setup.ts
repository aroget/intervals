/**
 * First-run setup: creates or updates the athlete profile in Supabase.
 * Edit the PROFILE constant below, then run: pnpm setup
 */
import "dotenv/config";
import { db } from "./db/client.js";

const ATHLETE_ID = process.env.INTERVALS_ATHLETE_ID!;

// ── Edit your profile here ────────────────────────────────────────────────────
const PROFILE = {
  name: "Andres",
  goals: "Complete an Ironman 70.3 in September",
  training_philosophy: "Polarized, 80/20 rule. Easy days easy, hard days hard.",
  disciplines: ["swim", "bike", "run"] as string[],
  weekly_max_hours: {
    monday: 1,
    tuesday: 2,
    wednesday: 1.5,
    thursday: 2,
    friday: 1,
    saturday: 3,
    sunday: 4,
  },
  // Start of the current 4-week training cycle (week 1 = base).
  // Update this every time you begin a new cycle.
  cycle_start_date: new Date().toISOString().slice(0, 10),
};
// ─────────────────────────────────────────────────────────────────────────────

const { error } = await db
  .from("athlete_profiles")
  .upsert(
    { athlete_id: ATHLETE_ID, ...PROFILE },
    { onConflict: "athlete_id", ignoreDuplicates: false },
  );

if (error) {
  console.error("Setup failed:", error.message);
  process.exit(1);
}

console.log(
  `Profile saved for ${ATHLETE_ID} (cycle starts ${PROFILE.cycle_start_date})`,
);
console.log("Next steps: pnpm sync → pnpm analyze");
