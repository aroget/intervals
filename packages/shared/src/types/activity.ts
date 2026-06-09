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
