import type { ComputedMetrics } from "../../types.js";

export function buildRecoverySystemPrompt(): string {
  return `You are a sports science recovery analyst. Your role is to interpret pre-computed fitness metrics and provide a clear, evidence-based recovery assessment.

CRITICAL RULES:
- You will be given pre-computed metrics. Trust these numbers exactly — do not recalculate or second-guess them.
- Never make up data. If a metric is null or missing, note it as unavailable and reduce your confidence accordingly.
- Be concise and direct. Athletes need actionable information, not lengthy explanations.
- Output only valid JSON matching the required schema.`;
}

interface YesterdayActivityParam {
  sport: string | null;
  durationSecs: number | null;
  tss: number | null;
  intensityFactor: number | null;
  avgHr: number | null;
}

export function buildRecoveryUserPrompt(
  metrics: ComputedMetrics,
  today: string,
  yesterdayActivity?: YesterdayActivityParam | null,
  coachingNotes?: string | null,
): string {
  const yesterdaySection = yesterdayActivity
    ? `Yesterday's session: ${yesterdayActivity.sport ?? "unknown"} · ${Math.round((yesterdayActivity.durationSecs ?? 0) / 60)} min · TSS ${yesterdayActivity.tss ?? "N/A"} · IF ${yesterdayActivity.intensityFactor?.toFixed(2) ?? "N/A"} · Avg HR ${yesterdayActivity.avgHr ?? "N/A"} bpm`
    : "Yesterday's session: Rest day (no activity recorded)";

  const notesSection = coachingNotes
    ? `\n\nATHLETE COACHING NOTES (always consider these):\n${coachingNotes}`
    : "";

  return `Analyze today's recovery status and return a JSON assessment.

Today: ${today}

PRE-COMPUTED METRICS (authoritative — do not recalculate):
- Readiness Score: ${metrics.readinessScore}/100
- HRV Trend (7-day): ${metrics.hrvTrend}
- HRV 7-day average: ${metrics.hrvSevenDayAvg ?? "unavailable"} ms
- Resting HR 7-day average: ${metrics.rhrSevenDayAvg ?? "unavailable"} bpm
- Sleep Score 7-day average: ${metrics.sleepScoreSevenDayAvg ?? "unavailable"}/100
- Acute Training Load (ATL): ${metrics.atl > 0 ? metrics.atl : "unavailable (run sync first)"} (fatigue indicator)
- Chronic Training Load (CTL): ${metrics.ctl > 0 ? metrics.ctl : "unavailable (run sync first)"} (fitness indicator)
- Training Stress Balance (TSB): ${metrics.atl > 0 && metrics.ctl > 0 ? metrics.tsb : "unavailable (run sync first)"} (form: positive=fresh, negative=fatigued)
- Training Cycle: Week ${metrics.cycleWeekNumber}/4 — ${metrics.cycleWeekType} phase
- Block Effectiveness: ${metrics.blockEffectiveness != null ? `${metrics.blockEffectiveness}/100` : "N/A (insufficient data)"} — measures how well current 4-week training block is translating to fitness gains (50% CTL progress + 50% compliance - overtraining penalties)

Readiness interpretation guide:
  80–100 → high    (athlete can handle hard sessions)
  55–79  → moderate (normal training, avoid peak efforts)
  30–54  → low      (reduce intensity or volume)
  0–29   → rest     (rest or very light activity only)

Current readiness: ${metrics.readinessScore} → ${getReadinessCategory(metrics.readinessScore)}
${yesterdaySection}${notesSection}

Return a JSON object with this exact shape:
{
  "readiness": "high" | "moderate" | "low" | "rest",
  "summary": "2-3 sentences focused on WHAT YOUR BIOMETRICS ARE TELLING US — interpret HRV trend, resting heart rate, sleep quality, and current fatigue/freshness (TSB). This answers: 'What is my body's systemic data saying about my state today?'",
  "yesterdayImpact": "1-2 sentences on how yesterday's session (or rest) has affected today's HRV, fatigue and muscle readiness",
  "trainingImplication": "1-2 sentences on what this readiness state means for today's training and the current block position. Bridge the biometric state to workout prescription. This answers: 'What should we do about it right now?'",
  "flags": ["specific concern 1", ...],
  "recommendation": "one sentence for the coach",
  "confidence": 0.0–1.0
}`;
}

function getReadinessCategory(score: number): string {
  if (score >= 80) return "high";
  if (score >= 55) return "moderate";
  if (score >= 30) return "low";
  return "rest";
}
