/**
 * Intervals.icu API client.
 * Docs: https://forum.intervals.icu/t/api/609
 *
 * Required env vars:
 *   INTERVALS_ATHLETE_ID   - athlete id (e.g. "i12345")
 *   INTERVALS_API_KEY      - API key from Settings → API Access
 */

import { convertIntervalsPaceToMinKm } from "../../utils/converter.js";

const BASE_URL = "https://intervals.icu/api/v1";

function getCredentials() {
  const athleteId = process.env.INTERVALS_ATHLETE_ID;
  const apiKey = process.env.INTERVALS_API_KEY;
  if (!athleteId || !apiKey) {
    throw new Error("INTERVALS_ATHLETE_ID and INTERVALS_API_KEY must be set");
  }
  return { athleteId, apiKey };
}

function authHeader(apiKey: string): string {
  return "Basic " + Buffer.from(`API_KEY:${apiKey}`).toString("base64");
}

async function request<T>(path: string): Promise<T> {
  const { apiKey } = getCredentials();
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: authHeader(apiKey),
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Intervals.icu API error ${response.status}: ${await response.text()}`,
    );
  }

  return response.json() as Promise<T>;
}

async function postRequest<T>(path: string, body: unknown): Promise<T> {
  const { apiKey } = getCredentials();
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: authHeader(apiKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(
      `Intervals.icu API error ${response.status}: ${await response.text()}`,
    );
  }

  return response.json() as Promise<T>;
}

const SPORT_TYPE_MAP: Record<string, string> = {
  run: "Run",
  bike: "Ride",
  swim: "Swim",
  strength: "WeightTraining",
};

export interface IntervalsEvent {
  id: string;
  start_date_local: string;
  name: string;
  type: string;
  description?: string;
}

/**
 * Create a planned workout event on the Intervals.icu calendar.
 * Defaults to the next morning at 07:00 if no date is specified.
 */
export async function createWorkoutEvent(params: {
  name: string;
  sport: string;
  durationMin: number;
  description: string;
  date?: string; // YYYY-MM-DD
}): Promise<IntervalsEvent> {
  const { athleteId } = getCredentials();
  const date = params.date ?? new Date().toISOString().slice(0, 10);

  const type = SPORT_TYPE_MAP[params.sport] ?? "Workout";
  const startLocal = `${date}T07:00:00`;
  const endLocal = new Date(
    new Date(`${date}T07:00:00`).getTime() + params.durationMin * 60 * 1000,
  )
    .toISOString()
    .replace("Z", "");

  return postRequest<IntervalsEvent>(`/athlete/${athleteId}/events`, {
    category: "WORKOUT",
    start_date_local: startLocal,
    end_date_local: endLocal,
    type,
    name: params.name,
    description: params.description,
    moving_time: params.durationMin * 60,
  });
}

export interface IntervalsWellness {
  id: string; // date string YYYY-MM-DD
  ctl: number | null;
  atl: number | null;
  rampRate: number | null;
  ctlLoad: number | null;
  atlLoad: number | null;
  sportInfo: unknown;
  updated: string;
  hrv: number | null;
  hrvScore: number | null;
  restingHR: number | null;
  hrvSDNN: number | null;
  menstrualPhase: string | null;
  menstrualPhasePredicted: string | null;
  weight: number | null;
  fatigue: number | null;
  mood: number | null;
  sleepTime: number | null; // seconds
  sleepScore: number | null;
  bio: string | null;
  soreness: number | null;
  injury: boolean | null;
  standing: number | null;
  steps: number | null;
  spO2: number | null;
  systolic: number | null;
  diastolic: number | null;
  respiration: number | null;
}

export interface IntervalsActivity {
  id: string;
  start_date_local: string;
  name: string;
  type: string;
  moving_time: number;
  distance: number;
  total_elevation_gain: number;
  average_temp: number | null;
  average_heartrate: number | null;
  max_heartrate: number | null;
  average_watts: number | null;
  normalized_power: number | null;
  icu_training_load: number | null;
  icu_intensity: number | null;
  icu_atl: number | null;
  icu_ctl: number | null;
  icu_joules: number | null; // total energy (kJ)
  icu_average_watts: number | null; // Intervals' own average power (excludes zeros)
  gap: number | null; // Grade Adjusted Pace (m/s)
  decoupling: number | null; // aerobic decoupling (%)
  icu_rpe: number | null; // RPE 1–10 (Intervals.icu "feel" field)
  athlete_comment: string | null; // athlete's post-session notes
  pace_load: number | null; // custom metric: pace * duration
  hr_load: number | null; // custom metric: avg_hr * duration
  power_load: number | null; // custom metric: avg_power * duration
  icu_efficiency_factor: number | null; // custom metric: power_load / pace_load
}

/** Fetch wellness entries for a date range (inclusive) */
export async function fetchWellness(
  oldest: string,
  newest: string,
): Promise<IntervalsWellness[]> {
  const { athleteId } = getCredentials();
  return request<IntervalsWellness[]>(
    `/athlete/${athleteId}/wellness?oldest=${oldest}&newest=${newest}`,
  );
}

/** Fetch activities for a date range */
export async function fetchActivities(
  oldest: string,
  newest: string,
): Promise<IntervalsActivity[]> {
  const { athleteId } = getCredentials();
  return request<IntervalsActivity[]>(
    `/athlete/${athleteId}/activities?oldest=${oldest}&newest=${newest}&cols=id,start_date_local,name,type,moving_time,distance,total_elevation_gain,average_heartrate,max_heartrate,average_watts,normalized_power,icu_training_load,icu_intensity,icu_atl,icu_ctl,icu_joules,icu_average_watts,gap,decoupling,icu_rpe,pace_load,hr_load,power_load,icu_efficiency_factor,average_temp`,
  );
}

/** Fetch a single athlete record */
export async function fetchAthlete(): Promise<Record<string, unknown>> {
  const { athleteId } = getCredentials();
  return request<Record<string, unknown>>(`/athlete/${athleteId}`);
}

/** Extract training thresholds and physical stats from an Intervals.icu athlete record */
export function extractThresholds(athlete: Record<string, any>): {
  ftp: number | null;
  runningThresholdPace: string | null;
  lthr: number | null;
  maxHrCycling: number | null;
  maxHrRunning: number | null;
  weightKg: number | null;
} {
  const cycling = athlete.sportSettings?.find(
    ({ types }: { types: string[] }) => types.includes("Ride"),
  );
  const running = athlete.sportSettings?.find(
    ({ types }: { types: string[] }) => types.includes("Run"),
  );

  const ftp = cycling?.ftp ?? null;
  const runningThresholdPace = running?.threshold_pace
    ? convertIntervalsPaceToMinKm(running?.threshold_pace)
    : null;

  // LTHR: prefer cycling value, fall back to running (same physiological threshold)
  const lthr = cycling?.lthr ?? running?.lthr ?? null;
  const maxHrCycling = cycling?.max_hr ?? null;
  const maxHrRunning = running?.max_hr ?? null;
  // weight in kg from athlete root (Intervals.icu stores in kg)
  const weightKg = typeof athlete.weight === "number" ? athlete.weight : null;

  return {
    ftp,
    runningThresholdPace,
    lthr,
    maxHrCycling,
    maxHrRunning,
    weightKg,
  };
}
