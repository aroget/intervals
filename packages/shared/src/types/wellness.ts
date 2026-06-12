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
  trainingQuality: {
    score: number;
    label: "excellent" | "good" | "fair" | "poor";
    trend: "improving" | "stable" | "declining";
    components: {
      fitnessBase: { score: number; weight: number; confidence: string };
      progressiveOverload: {
        score: number;
        weight: number;
        confidence: string;
      };
      consistency: { score: number; weight: number; confidence: string };
      loadManagement: { score: number; weight: number; confidence: string };
    };
  } | null;
}
