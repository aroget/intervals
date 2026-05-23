import type { AthleteProfile, ComputedMetrics, Activity } from "../../types.js";
import type { RecoveryOutput } from "../recovery/schema.js";
import type { ComplianceReport } from "../../data/processors/workoutCompliance.js";

interface PlannedWorkout {
  date: string;
  sport: string;
  durationMin: number;
  intensity: string;
  periodizationPhase?: string;
}

export function buildCoachSystemPrompt(profile: AthleteProfile): string {
  const disciplines = profile.disciplines.join(", ");
  const isSingleSport = profile.disciplines.length === 1;

  const thresholdSection = buildThresholdSection(profile);

  return `You are an elite endurance coach. You prescribe workouts that are precisely calibrated to the athlete's current readiness, training cycle phase, and long-term goals.

ATHLETE PROFILE:
Name: ${profile.name}
Goals: ${profile.goals}
Training Philosophy: ${profile.trainingPhilosophy}
Disciplines: ${disciplines}
${thresholdSection}
CORE COACHING RULES:
1. NEVER exceed the athlete's daily time limit (maxHoursToday). This is a hard constraint.
2. Follow the training philosophy strictly — if the athlete follows polarized training (80/20), easy days must truly be easy (Zone 1-2, conversational pace, no intervals).
3. During recovery week (Week 4): reduce volume by 40-50%, no hard or moderate sessions — easy and rest only.
4. If readiness is "rest": prescribe active recovery or full rest only.
5. If readiness is "low": prescribe easy sessions only, cap at 60 min.
6. WEEKLY HARD SESSION LIMITS (count sessions already in WEEK PLAN SO FAR before deciding):
   - Base week (Week 1): max 1 hard session for the whole week
   - Build week (Week 2): max 2 hard sessions for the whole week
   - Peak week (Week 3): max 2 hard sessions for the whole week
   - Recovery week (Week 4): 0 hard sessions — easy/rest only
   If the weekly hard cap is already reached in the plan, today MUST be easy or rest.
7. NEVER prescribe hard or moderate intensity the day after a hard session. Check WEEK PLAN SO FAR for yesterday's session.
8. The default intensity for any day not explicitly requiring quality work is EASY. Most days should be easy.
9. ${isSingleSport ? "Single-sport athlete — prescribe only " + disciplines + " sessions." : `Multi-sport athlete — distribute sports across the week. Rotate through [${disciplines}] to avoid fatigue accumulation in one discipline. Never prescribe the same sport more than two days in a row. If today's "WEEK PLAN SO FAR" shows a pattern, break it with a different sport.`}
10. Output only valid JSON matching the required schema.`;
}

export function buildCoachUserPrompt(params: {
  metrics: ComputedMetrics;
  recovery: RecoveryOutput;
  recentActivities: Activity[];
  today: string;
  userRequest?: { sport?: string; durationMin?: number; notes?: string };
  upcomingWorkouts?: PlannedWorkout[];
  compliance?: ComplianceReport | null;
}): string {
  const {
    metrics,
    recovery,
    recentActivities,
    today,
    userRequest,
    upcomingWorkouts,
    compliance,
  } = params;
  const maxMinutes = metrics.todayMaxHours * 60;

  const recentSummary = recentActivities
    .slice(0, 10)
    .map(
      (a) =>
        `  ${a.activityDate} | ${a.sport} | ${Math.round((a.durationSecs ?? 0) / 60)}min | TSS: ${a.tss ?? "N/A"}`,
    )
    .join("\n");

  const hardSessionsThisWeek = upcomingWorkouts
    ? upcomingWorkouts.filter((w: any) => w.intensity === "hard").length
    : 0;
  const yesterdayWorkout =
    upcomingWorkouts && upcomingWorkouts.length > 0
      ? upcomingWorkouts[upcomingWorkouts.length - 1]
      : null;
  const yesterdayWasHard = yesterdayWorkout?.intensity === "hard";

  const weekPlanSection =
    upcomingWorkouts && upcomingWorkouts.length > 0
      ? `\nWEEK PLAN SO FAR (already prescribed — use to vary sports, count hard sessions, and enforce spacing):
${upcomingWorkouts
  .map(
    (w: any) =>
      `  ${w.date} | ${w.sport} | ${w.durationMin}min | ${w.intensity}${w.periodizationPhase ? ` | ${w.periodizationPhase}` : ""}`,
  )
  .join("\n")}
Hard sessions this week so far: ${hardSessionsThisWeek}${yesterdayWasHard ? "\n⚠️  Yesterday was HARD — today must be easy or rest." : ""}
\n`
      : "";

  const complianceSection = compliance
    ? `\nYESTERDAY'S COMPLIANCE (${compliance.date}):
  ${compliance.complianceSummary}${compliance.wasRestDay && !compliance.complianceSummary.includes("Rest day as prescribed") ? "\n  ⚠️  Athlete missed yesterday's session — factor fatigue savings into today's prescription." : ""}${compliance.rpe != null ? `\n  Athlete RPE: ${compliance.rpe}/10` : ""}${compliance.athleteComments ? `\n  Athlete note: "${compliance.athleteComments}"` : ""}
`
    : "";

  return `Prescribe today's workout based on the athlete's readiness and training context.

Today: ${today}
Day max time: ${metrics.todayMaxHours}h (${maxMinutes} min hard cap)
${
  userRequest
    ? `
ATHLETE REQUEST (must be respected):
${userRequest.sport ? `  Discipline: ${userRequest.sport} (lock this — do not change sport)` : ""}
${userRequest.durationMin ? `  Duration: exactly ${userRequest.durationMin} minutes (this IS the hard cap)` : ""}
${userRequest.notes ? `  Notes: ${userRequest.notes}` : ""}
`
    : ""
}${weekPlanSection}${complianceSection}
RECOVERY ANALYSIS (from Recovery Agent):
  Readiness level: ${recovery.readiness}
  Summary: ${recovery.summary}
  Recommendation: ${recovery.recommendation}
  Flags: ${recovery.flags.length ? recovery.flags.join(", ") : "none"}

TRAINING CYCLE:
  Week ${metrics.cycleWeekNumber}/4 — ${metrics.cycleWeekType} phase
  TSB (form): ${metrics.tsb} | ATL (fatigue): ${metrics.atl} | CTL (fitness): ${metrics.ctl}

RECENT TRAINING (last 10 sessions):
${recentSummary || "  No recent activities found"}

Return a JSON object with this exact shape:
{
  "sport": "run" | "bike" | "swim" | "strength",
  "durationMin": <number, max ${maxMinutes}>,
  "intensity": "easy" | "moderate" | "hard" | "rest",
  "workoutStructure": "<Intervals.icu text, e.g.:\\n-15m 6:00-6:30 Pace\\n\\n4x\\n-8m 4:50-5:10 Pace\\n-2m 6:30-7:30 Pace\\n\\n-10m 6:00-6:30 Pace>",
  "rationale": "...",
  "adjustmentsFromPlan": [...],
  "periodizationPhase": "...",
  "energySystem": "recovery" | "base" | "tempo" | "threshold" | "vo2max" | "anaerobic",
  "phases": [
    { "label": "Warm Up", "durationMin": 15, "intensityPct": 55 },
    { "label": "Main Set", "durationMin": 30, "intensityPct": 97 },
    { "label": "Recovery", "durationMin": 5, "intensityPct": 50 },
    { "label": "Cool Down", "durationMin": 10, "intensityPct": 55 }
  ]
}

phases rules:
- Include every phase: warm-up, each interval, each recovery, cool-down.
- Sum of all durationMin in phases MUST equal the top-level durationMin.
- intensityPct is % of FTP: recovery ~45, easy/base ~62, tempo ~82, threshold ~97, VO2max ~112, anaerobic ~130.
- For strength or swim where FTP is N/A, use perceived effort: easy ~50, moderate ~75, hard ~90.`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function secsToMMSS(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function buildThresholdSection(profile: AthleteProfile): string {
  const lines: string[] = [];

  if (profile.ftp) {
    const f = profile.ftp;
    lines.push(
      `Cycling FTP: ${f}W — use these power zones in workoutStructure:`,
      `  Z1 Recovery  < ${Math.round(f * 0.55)}W`,
      `  Z2 Endurance   ${Math.round(f * 0.56)}–${Math.round(f * 0.75)}W`,
      `  Z3 Tempo       ${Math.round(f * 0.76)}–${Math.round(f * 0.9)}W`,
      `  Z4 Threshold   ${Math.round(f * 0.91)}–${Math.round(f * 1.05)}W`,
      `  Z5 VO2max      ${Math.round(f * 1.06)}–${Math.round(f * 1.2)}W`,
    );
  } else {
    lines.push("Cycling FTP: not set (use RPE / HR descriptors instead)");
  }

  if (profile.runningThresholdPace) {
    const t = profile.runningThresholdPace;
    lines.push(
      `Running threshold pace: ${secsToMMSS(t)}/km — use these pace zones in workoutStructure:`,
      `  Easy Z1      ${secsToMMSS(t + 90)}–${secsToMMSS(t + 120)}/km`,
      `  Easy Z2      ${secsToMMSS(t + 60)}–${secsToMMSS(t + 90)}/km`,
      `  Moderate Z3  ${secsToMMSS(t + 20)}–${secsToMMSS(t + 60)}/km`,
      `  Threshold Z4 ${secsToMMSS(t - 5)}–${secsToMMSS(t + 10)}/km`,
      `  VO2max Z5    ${secsToMMSS(t - 25)}–${secsToMMSS(t - 10)}/km`,
    );
  } else {
    lines.push(
      "Running threshold pace: not set (use RPE / HR descriptors instead)",
    );
  }

  if (profile.lthr) {
    const h = profile.lthr;
    lines.push(
      `Lactate Threshold HR: ${h} bpm — use these HR zones when power/pace not applicable:`,
      `  Z1 Recovery   < ${Math.round(h * 0.81)} bpm`,
      `  Z2 Endurance    ${Math.round(h * 0.81)}–${Math.round(h * 0.89)} bpm`,
      `  Z3 Tempo        ${Math.round(h * 0.9)}–${Math.round(h * 0.93)} bpm`,
      `  Z4 Threshold    ${Math.round(h * 0.94)}–${Math.round(h * 0.99)} bpm`,
      `  Z5 VO2max       ≥ ${Math.round(h * 1.0)} bpm`,
    );
  } else {
    lines.push("LTHR: not set");
  }

  return lines.length
    ? `\nPERFORMANCE THRESHOLDS:\n${lines.map((l) => `  ${l}`).join("\n")}\n`
    : "";
}
