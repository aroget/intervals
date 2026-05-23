import WorkoutForm from "./WorkoutForm";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:7000";
const ATHLETE_ID = process.env.NEXT_PUBLIC_ATHLETE_ID ?? "";

type Sport = "run" | "bike" | "swim" | "strength";

const FALLBACK_DISCIPLINES: Sport[] = ["run", "bike"];

async function getDisciplines(): Promise<Sport[]> {
  try {
    const res = await fetch(`${API}/athlete/${ATHLETE_ID}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return FALLBACK_DISCIPLINES;
    const { profile } = await res.json();
    const disciplines: Sport[] = profile?.disciplines ?? [];
    return disciplines.length > 0 ? disciplines : FALLBACK_DISCIPLINES;
  } catch {
    return FALLBACK_DISCIPLINES;
  }
}

export default async function NewWorkoutPage() {
  const disciplines = await getDisciplines();
  return (
    <main className="min-h-screen bg-bg text-text">
      <WorkoutForm disciplines={disciplines} />
    </main>
  );
}

