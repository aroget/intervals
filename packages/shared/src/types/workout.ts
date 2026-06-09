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

export interface CoachAgentOutput {
  sport: string;
  durationMin: number;
  intensity: "easy" | "moderate" | "hard" | "rest";
  structure: WorkoutStructure;
  rationale: string;
  adjustmentsFromPlan: string[];
  periodizationPhase: string;
}
