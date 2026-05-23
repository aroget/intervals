const DAYS_OF_WEEK = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export interface CyclePosition {
  weekNumber: 1 | 2 | 3 | 4;
  weekType: "build" | "peak" | "recovery" | "base";
  dayOfCycle: number; // 1–28
  daysRemainingInWeek: number;
  isRecoveryWeek: boolean;
}

/**
 * Determines where "today" falls within a 4-week training block.
 * Week 1–3 = load weeks (build/peak). Week 4 = recovery.
 *
 * @param cycleStartDate - ISO date string of the block's first day
 * @param today          - ISO date string of the target day (default: today)
 */
export function getCyclePosition(
  cycleStartDate: string,
  today: string = new Date().toISOString().slice(0, 10),
): CyclePosition {
  const start = new Date(cycleStartDate);
  const target = new Date(today);
  const dayOfCycle =
    Math.floor((target.getTime() - start.getTime()) / 86_400_000) + 1;
  // Wrap into current 28-day block
  const positionInBlock = ((dayOfCycle - 1) % 28) + 1;
  const weekNumber = Math.ceil(positionInBlock / 7) as 1 | 2 | 3 | 4;

  const weekTypeMap: Record<
    1 | 2 | 3 | 4,
    "build" | "peak" | "recovery" | "base"
  > = {
    1: "base",
    2: "build",
    3: "peak",
    4: "recovery",
  };

  const isRecoveryWeek = weekNumber === 4;
  const daysRemainingInWeek = 7 - ((positionInBlock - 1) % 7);

  return {
    weekNumber,
    weekType: weekTypeMap[weekNumber],
    dayOfCycle: positionInBlock,
    daysRemainingInWeek,
    isRecoveryWeek,
  };
}

/**
 * Returns the lowercase day-of-week name for an ISO date string.
 */
export function getDayOfWeek(isoDate: string): string {
  return DAYS_OF_WEEK[new Date(isoDate).getDay()];
}
