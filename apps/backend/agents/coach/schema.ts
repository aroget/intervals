import { z } from "zod";

const WorkoutPhaseChartSchema = z.object({
  label: z
    .string()
    .describe("Phase name: Warm Up, Main Set, Recovery, Cool Down"),
  durationMin: z.number().describe("Duration in minutes"),
  intensityPct: z
    .number()
    .min(0)
    .max(150)
    .describe(
      "Intensity as % of FTP. Recovery ~45, easy/base ~62, tempo ~82, threshold ~97, VO2max ~112, anaerobic ~130",
    ),
});

export type WorkoutPhaseChart = z.infer<typeof WorkoutPhaseChartSchema>;

export const CoachOutputSchema = z.object({
  sport: z
    .string()
    .describe("Primary discipline: run, bike, swim, or strength"),
  durationMin: z
    .number()
    .describe(
      "Total workout duration in minutes (must not exceed maxHoursToday × 60)",
    ),
  intensity: z.enum(["easy", "moderate", "hard", "rest"]),
  sessionType: z.enum(["key", "endurance", "recovery", "rest"]).describe(
    `Session classification by training purpose:
- key: High-quality sessions (intervals, tempo, race pace) — critical for adaptation, highest priority
- endurance: Aerobic base building (long runs, steady rides) — volume for fitness development
- recovery: Active recovery (easy pace, low HR) — aids recovery without fatigue accumulation
- rest: Complete rest day — no activity prescribed`,
  ),
  workoutStructure: z.string().describe(
    `Strict Intervals.icu workout code.
Rules:
1. Warm-up/Cool-down: "- [Time] [Intensity Type]"
2. Intervals: "[N]x" followed by indented "- [Time] [Intensity Type]". Ignore [N]x if there is only one main interval — use the single line format instead.
3. Single Main Set: "- [Time] [Intensity Type]"

Intensity Type Examples:
- Run: A range of LTHR for low intensity, and pace for high intensity intervals using the athlete's threshold pace from the profile (e.g., "4:50-5:10 Pace" or "60-70% LTHR").
- Bike: A range of HR zones for low intensity, and percentage of the athlete's threshold power for high intensity intervals (e.g., "200-220W" or "60-70% LTHR").
- Do not mix intensity types within the same workout. If the intervals use power, all intensity types should be in power. If using pace, all should be in pace or heart rate.

Example Output 1: Easy/Recovery Run (Strictly HR)
-10m 60-70% LTHR
-40m 65-75% LTHR
-10m 60-70% LTHR

Example Output 2: Hard/Interval Run (Strictly % Pace)
-15m 75-80% Pace

4x
-8m 95-100% Pace
-2m 70-75% Pace

-10m 75-80% Pace

Example Output 3: Single Set Hard Run (Strictly % Pace)
-10m 80% Pace
-30m 95% Pace
-10m 75% Pace

Example Output 4: Easy/Recovery Bike (Strictly HR)
-15m 55-65% HR
-60m 65-75% HR
-15m 55-65% HR

Example Output 5: Hard/Interval Bike (Strictly % FTP)
-20m 65-75% FTP

5x
-5m 105-110% FTP
-3m 55% FTP

-15m 60-70% FTP`,
  ),
  rationale: z.string().describe("Why this specific workout was chosen today"),
  adjustmentsFromPlan: z
    .array(z.string())
    .describe("Any deviations from the standard plan and why"),
  periodizationPhase: z
    .string()
    .describe('Current phase label e.g. "Week 2 Build — Aerobic Base"'),
  phases: z
    .array(WorkoutPhaseChartSchema)
    .describe(
      "Flat ordered list of all workout phases for chart rendering. Warm-up and cool-down must be included. Intervals appear as alternating Main Set / Recovery pairs. Total durationMin across all phases must equal the top-level durationMin.",
    ),
  energySystem: z
    .enum(["recovery", "base", "tempo", "threshold", "vo2max", "anaerobic"])
    .describe("Primary energy system this workout targets"),
});

export type CoachOutput = z.infer<typeof CoachOutputSchema>;
