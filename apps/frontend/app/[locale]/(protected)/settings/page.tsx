import SettingsForm, { type ProfileData } from "./SettingsForm";
import { API_URL, ATHLETE_ID, fetcher } from "@/lib/api";


type Day =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

const DEFAULT_HOURS: Record<Day, number> = {
  monday: 1,
  tuesday: 1,
  wednesday: 1,
  thursday: 1,
  friday: 1,
  saturday: 1.5,
  sunday: 2,
};

async function getProfile(): Promise<ProfileData> {
  try {
    const res = await fetch(`${API_URL}/athlete/${ATHLETE_ID}`, {
      next: { revalidate: 0 }, // always fresh — user is about to edit it
    });
    if (!res.ok) throw new Error("not found");
    const { profile: p } = await res.json();
    return {
      athleteId: p.athlete_id ?? ATHLETE_ID,
      name: p.name ?? "",
      goals: p.goals ?? "",
      trainingPhilosophy: p.training_philosophy ?? "",
      disciplines: p.disciplines ?? ["run", "bike"],
      weeklyMaxHours: { ...DEFAULT_HOURS, ...(p.weekly_max_hours ?? {}) },
      cycleStartDate: p.cycle_start_date ?? "",
      coachingNotes: p.coaching_notes ?? "",
      preferredTheme: p.preferred_theme ?? "system",
      createdAt: p.created_at ?? null,
      ftp: p.ftp ?? null,
      runningThresholdPace: p.running_threshold_pace ?? null,
      lthr: p.lthr ?? null,
    };
  } catch {
    // Return a blank profile so the form still renders
    return {
      athleteId: ATHLETE_ID,
      name: "",
      goals: "",
      trainingPhilosophy: "",
      disciplines: ["run", "bike"],
      weeklyMaxHours: DEFAULT_HOURS,
      cycleStartDate: "",
      coachingNotes: "",
      preferredTheme: "system",
      createdAt: null,
      ftp: null,
      runningThresholdPace: null,
      lthr: null,
    };
  }
}

export default async function SettingsPage() {
  const profile = await getProfile();
  return (
    <main className="min-h-screen bg-bg text-text">
      <SettingsForm profile={profile} />
    </main>
  );
}
