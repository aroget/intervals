/**
 * Training cycle configuration
 */
export const TRAINING_CYCLE = {
  WEEKS_PER_CYCLE: 4,
  WEEK_TYPES: {
    1: "base" as const,
    2: "build" as const,
    3: "peak" as const,
    4: "recovery" as const,
  },
} as const;

/**
 * TSB (Training Stress Balance) zones
 */
export const TSB_ZONES = {
  OPTIMAL_MIN: -10,
  OPTIMAL_MAX: 5,
  OVERREACHING_THRESHOLD: -25,
  FRESH_THRESHOLD: 10,
} as const;

/**
 * Readiness score thresholds
 */
export const READINESS_THRESHOLDS = {
  HIGH: 80,
  MODERATE: 55,
  LOW: 0,
} as const;
