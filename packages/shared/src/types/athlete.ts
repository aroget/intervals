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
