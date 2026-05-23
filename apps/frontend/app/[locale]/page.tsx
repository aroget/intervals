import Image from "next/image";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Authenticated users go straight to dashboard
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    const session = await verifySession(token);
    if (session) redirect(`/${locale}/dashboard`);
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center py-24 gap-10">
        <div className="flex flex-col items-center gap-6 max-w-2xl">
          <div className="relative w-[120px] h-[120px] rounded-full overflow-hidden">
            <Image
              src="/logo.png"
              alt="Intervals Coach"
              fill
              className="object-cover"
              priority
              placeholder="empty"
            />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-text leading-tight tracking-tight">
            Your AI fitness coach,
            <br />
            <span className="text-teal">powered by your data.</span>
          </h1>
          <p className="text-lg text-muted max-w-lg leading-relaxed">
            Daily recovery analysis, adaptive workout prescriptions, and a
            conversational coach — all built on your Intervals.icu training
            data.
          </p>
          <a
            href="/api/auth/login"
            className="mt-2 inline-block px-8 py-3.5 rounded-xl bg-teal text-white font-bold text-base hover:opacity-90 transition-opacity shadow-sm"
          >
            Connect with Intervals.icu →
          </a>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-3 max-w-xl">
          {[
            "Daily readiness score",
            "Workout prescription",
            "HRV & TSB tracking",
            "4-week periodization",
            "Chat with your coach",
          ].map((f) => (
            <span
              key={f}
              className="px-4 py-1.5 rounded-full text-sm font-medium bg-bg-card border border-border text-muted"
            >
              {f}
            </span>
          ))}
        </div>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted">
        No password stored. OAuth access via Intervals.icu only.
      </footer>
    </div>
  );
}
