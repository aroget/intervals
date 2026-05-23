export function convertIntervalsPaceToMinKm(
  metersPerSecond: number | null | undefined,
): string {
  // Guard clause for missing or invalid data
  if (!metersPerSecond || metersPerSecond <= 0) {
    return "0:00";
  }

  // 1. Calculate total seconds needed to cover exactly 1000 meters
  const totalSecondsPerKm = 1000 / metersPerSecond;

  // 2. Isolate whole minutes using floor division
  const minutes = Math.floor(totalSecondsPerKm / 60);

  // 3. Get the remaining seconds and round them to the nearest whole integer
  const seconds = Math.round(totalSecondsPerKm % 60);

  // Handle edge case: if rounding seconds pushes it to 60, roll it over to the next minute
  if (seconds === 60) {
    return `${minutes + 1}:00`;
  }

  // padStart ensures 5 seconds becomes "05", not "5"
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
