/**
 * Sport metadata including icons and display names
 */
export const SPORTS = {
  bike: {
    normalized: "bike",
    icon: "🚴",
    name: "Bike",
    aliases: ["ride", "virtualride", "ebikeride"],
  },
  run: {
    normalized: "run",
    icon: "🏃",
    name: "Run",
    aliases: ["run", "virtualrun", "trailrun", "walk"],
  },
  swim: {
    normalized: "swim",
    icon: "🏊",
    name: "Swim",
    aliases: ["swim", "openwatersim"],
  },
  strength: {
    normalized: "strength",
    icon: "🏋️",
    name: "Strength",
    aliases: ["weighttraining", "workout", "yoga"],
  },
  other: {
    normalized: "other",
    icon: "💪",
    name: "Other",
    aliases: [],
  },
} as const;

/**
 * Get sport icon by normalized sport type
 */
export function getSportIcon(sport: string): string {
  const normalized = sport.toLowerCase();
  for (const s of Object.values(SPORTS)) {
    if (s.normalized === normalized || s.aliases.includes(normalized)) {
      return s.icon;
    }
  }
  return SPORTS.other.icon;
}

/**
 * Legacy SPORT_ICONS mapping for backward compatibility
 */
export const SPORT_ICONS: Record<string, string> = {
  run: SPORTS.run.icon,
  bike: SPORTS.bike.icon,
  swim: SPORTS.swim.icon,
  strength: SPORTS.strength.icon,
};
