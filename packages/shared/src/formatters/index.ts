/**
 * Format duration from seconds to human-readable string
 */
export function formatDuration(secs: number | null): string {
  if (!secs) return "—";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

/**
 * Format distance from meters to km or m
 */
export function formatDistance(m: number | null): string {
  if (!m) return "—";
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

/**
 * Format energy from joules to kcal
 * 1 kJ ≈ 1 kcal (standard cycling/running approximation at ~25% efficiency)
 */
export function formatKcal(joules: number | null): string {
  if (!joules) return "—";
  return `~${Math.round(joules / 1000)} kcal`;
}

/**
 * Format date to local string
 */
export function formatDate(
  date: string | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === "string" ? new Date(date + "T00:00:00") : date;
  return d.toLocaleDateString("en-US", options);
}
