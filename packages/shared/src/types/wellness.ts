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
