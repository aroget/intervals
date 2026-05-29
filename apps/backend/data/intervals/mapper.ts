/**
 * Centralized mappers for transforming Intervals.icu API data to/from database rows.
 * Single source of truth for all field transformations.
 */
import type { IntervalsActivity, IntervalsWellness } from "./client.js";
import type { Activity, WellnessLog } from "../../types.js";

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

export function normalizeSport(type: string | null | undefined): string {
  if (!type) return "other";
  return SPORT_NORMALIZE[type.toLowerCase()] ?? type.toLowerCase();
}

/** Map Intervals.icu activity API response → database row (snake_case) */
export function toActivityRow(a: IntervalsActivity, athleteId: string) {
  return {
    athlete_id: athleteId,
    intervals_id: a.id,
    activity_date: a.start_date_local.slice(0, 10),
    sport: normalizeSport(a.type),
    name: a.name,
    duration_secs: a.moving_time,
    distance_m: a.distance,
    tss: a.icu_training_load,
    intensity_factor: a.icu_intensity,
    atl: a.icu_atl,
    ctl: a.icu_ctl,
    joules: a.icu_joules,
    avg_hr: a.average_heartrate,
    max_hr: a.max_heartrate,
    avg_power: a.icu_average_watts ?? a.average_watts,
    gap: a.gap,
    decoupling: a.decoupling,
    elevation_m: a.total_elevation_gain,
    average_temp: a.average_temp,
    pace_load: a.pace_load,
    hr_load: a.hr_load,
    power_load: a.power_load,
    efficiency_factor: a.icu_efficiency_factor,
    rpe: a.icu_rpe,
    raw_data: a,
  };
}

/** Map database row (snake_case) → Activity type (camelCase) */
export function fromActivityRow(r: any): Activity {
  return {
    id: r.id,
    athleteId: r.athlete_id,
    intervalsId: r.intervals_id,
    activityDate: r.activity_date,
    sport: r.sport,
    name: r.name,
    durationSecs: r.duration_secs,
    distanceM: r.distance_m,
    tss: r.tss,
    intensityFactor: r.intensity_factor,
    atl: r.atl ?? null,
    ctl: r.ctl ?? null,
    avgHr: r.avg_hr,
    maxHr: r.max_hr,
    avgPower: r.avg_power,
    normalizedPower: r.normalized_power,
    joules: r.joules ?? null,
    gap: r.gap ?? null,
    decoupling: r.decoupling ?? null,
    elevationM: r.elevation_m,
    notes: r.notes,
    average_temp: r.average_temp ?? null,
    rpe: r.rpe ?? null,
    athleteComments: r.athlete_comments ?? null,
    sessionType: r.session_type ?? null,
    paceLoad: r.pace_load ?? null,
    hrLoad: r.hr_load ?? null,
    powerLoad: r.power_load ?? null,
    efficiencyFactor: r.efficiency_factor ?? null,
  };
}

/** Map Intervals.icu wellness API response → database row (snake_case) */
export function toWellnessRow(e: IntervalsWellness, athleteId: string) {
  return {
    athlete_id: athleteId,
    log_date: e.id,
    hrv: e.hrv,
    hrv_score: e.hrvScore,
    rhr: e.restingHR,
    sleep_score: e.sleepScore,
    sleep_hours: e.sleepTime
      ? Math.round((e.sleepTime / 3600) * 10) / 10
      : null,
    raw_source: "intervals.icu",
    raw_data: e,
  };
}

/** Map database row (snake_case) → WellnessLog type (camelCase) */
export function fromWellnessRow(r: any): WellnessLog {
  return {
    id: r.id,
    athleteId: r.athlete_id,
    logDate: r.log_date,
    hrv: r.hrv,
    hrvScore: r.hrv_score,
    rhr: r.rhr,
    sleepScore: r.sleep_score,
    sleepHours: r.sleep_hours,
    sleepQuality: r.sleep_quality,
  };
}
