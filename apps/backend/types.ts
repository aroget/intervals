export interface AthleteProfile {
  id: string;
  athleteId: string;
  name: string;
  goals: string;
  trainingPhilosophy: string;
  disciplines: ("swim" | "bike" | "run" | "strength")[];
  weeklyMaxHours: Record<string, number>; // { monday: 1, tuesday: 2, ... }
  preferredMetrics: string[];
  cycleStartDate: string | null;
  coachingNotes: string | null; // Custom instructions for AI coach
  preferredTheme: "light" | "dark" | "system"; // Theme preference
  ftp: number | null; // Cycling FTP in watts
  runningThresholdPace: number | null; // Running threshold pace in seconds per km
  lthr: number | null; // Lactate Threshold Heart Rate in bpm
}

export interface WellnessLog {
  id: string;
  athleteId: string;
  logDate: string;
  hrv: number | null;
  hrvScore: number | null;
  rhr: number | null;
  sleepScore: number | null;
  sleepHours: number | null;
  sleepQuality: string | null;
}

export interface Activity {
  id: string;
  athleteId: string;
  intervalsId: string | null;
  activityDate: string;
  sport: string | null;
  name: string | null;
  durationSecs: number | null;
  distanceM: number | null;
  tss: number | null;
  intensityFactor: number | null;
  atl: number | null; // Acute Training Load from Intervals.icu
  ctl: number | null; // Chronic Training Load from Intervals.icu
  avgHr: number | null;
  maxHr: number | null;
  avgPower: number | null;
  normalizedPower: number | null;
  joules: number | null; // total energy (kJ)
  gap: number | null; // Grade Adjusted Pace (m/s)
  decoupling: number | null; // aerobic decoupling (%)
  elevationM: number | null;
  notes: string | null;
  average_temp: number | null;
  athleteComments: string | null; // athlete's post-session notes
  rpe: number | null; // 1–10 athlete-reported RPE (Intervals.icu "feel")
  sessionType: string | null; // key | endurance | recovery | rest (inferred from prescription or TSS)
  paceLoad: number | null; // custom metric: pace * duration
  hrLoad: number | null; // custom metric: avg_hr * duration
  powerLoad: number | null; // custom metric: avg_power * duration
  efficiencyFactor: number | null; // custom metric: power_load / pace_load
}

export interface DailyAnalysis {
  id: string;
  athleteId: string;
  analysisDate: string;
  readinessScore: number;
  hrvTrend: string | null;
  agentOutput: RecoveryAgentOutput;
  modelUsed: string | null;
}

export interface PrescribedWorkout {
  id: string;
  athleteId: string;
  workoutDate: string;
  sport: string | null;
  durationMin: number | null;
  intensity: string | null;
  sessionType: string | null; // key | endurance | recovery | rest
  hadDeviationFlag: boolean; // Was there a readiness warning?
  deviationSeverity: string | null; // moderate | major
  structure: WorkoutStructure | null;
  rationale: string | null;
  agentOutput: CoachAgentOutput;
  modelUsed: string | null;
  completed: boolean;
}

export interface WorkoutPhase {
  name: string;
  durationMin: number;
  description: string;
  targetZone?: string;
  targetPower?: string;
  targetPace?: string;
}

export interface WorkoutStructure {
  phases: WorkoutPhase[];
  totalDurationMin: number;
  warmupMin: number;
  cooldownMin: number;
}

export interface RecoveryAgentOutput {
  readiness: "high" | "moderate" | "low" | "rest";
  summary: string;
  flags: string[];
  recommendation: string;
  confidence: number;
}

export interface CoachAgentOutput {
  sport: string;
  durationMin: number;
  intensity: "easy" | "moderate" | "hard" | "rest";
  structure: WorkoutStructure;
  rationale: string;
  adjustmentsFromPlan: string[];
  periodizationPhase: string;
}

export interface ComputedMetrics {
  readinessScore: number; // 0–100, deterministic
  hrvTrend: "rising" | "stable" | "declining" | "insufficient_data";
  hrvSevenDayAvg: number | null;
  rhrSevenDayAvg: number | null;
  sleepScoreSevenDayAvg: number | null;
  atl: number; // Acute Training Load (7-day)
  ctl: number; // Chronic Training Load (42-day)
  tsb: number; // Training Stress Balance (CTL - ATL)
  cycleWeekNumber: 1 | 2 | 3 | 4;
  cycleWeekType: "build" | "peak" | "recovery" | "base";
  todayMaxHours: number;
  blockEffectiveness: number | null; // 0–100, current 4-week training block effectiveness
}
