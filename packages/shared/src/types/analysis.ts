export interface RecoveryAgentOutput {
  readiness: "high" | "moderate" | "low" | "rest";
  summary: string;
  flags: string[];
  recommendation: string;
  confidence: number;
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
