/**
 * Intensity levels and color mappings
 */
export const INTENSITY_LEVELS = {
  rest: {
    level: "rest",
    name: "Rest",
    color: "text-muted",
    borderColor: "border-border",
  },
  easy: {
    level: "easy",
    name: "Easy",
    color: "text-teal",
    borderColor: "border-border",
  },
  moderate: {
    level: "moderate",
    name: "Moderate",
    color: "text-orange",
    borderColor: "border-peach",
  },
  hard: {
    level: "hard",
    name: "Hard",
    color: "text-orangeBright",
    borderColor: "border-orange",
  },
} as const;

/**
 * Readiness color mappings
 */
export const READINESS_COLORS: Record<string, string> = {
  high: "text-teal",
  moderate: "text-orange",
  low: "text-peach",
  rest: "text-orange",
};

/**
 * Intensity border mappings (legacy)
 */
export const INTENSITY_BORDERS: Record<string, string> = {
  easy: "border-border",
  moderate: "border-peach",
  hard: "border-orange",
  rest: "border-border",
};
