/**
 * Sport normalization mapping
 */
const SPORT_NORMALIZE: Record<string, string> = {
  ride: "bike",
  virtualride: "bike",
  ebikeride: "bike",
  run: "run",
  virtualrun: "run",
  trailrun: "run",
  swim: "swim",
  openwatersim: "swim",
  weighttraining: "strength",
  workout: "strength",
  yoga: "strength",
  walk: "run",
};

/**
 * Normalize sport type to canonical form
 */
export function normalizeSport(type: string | null | undefined): string {
  if (!type) return "other";
  return SPORT_NORMALIZE[type.toLowerCase()] ?? type.toLowerCase();
}

/**
 * Valid sport types
 */
export const SPORT_TYPES = [
  "bike",
  "run",
  "swim",
  "strength",
  "other",
] as const;
export type SportType = (typeof SPORT_TYPES)[number];
