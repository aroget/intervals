"use client";

import { useState } from "react";
import { API_URL, ATHLETE_ID, fetcher } from "@/lib/api";
import { useTranslations } from "next-intl";


type Sport = "run" | "bike" | "swim" | "strength";

interface GeneratedWorkout {
  sport: string;
  durationMin: number;
  intensity: "easy" | "moderate" | "hard" | "rest";
  workoutStructure: string;
  rationale: string;
  adjustmentsFromPlan: string[];
  periodizationPhase: string;
}

interface RecoverySummary {
  readiness: string;
  summary: string;
  recommendation: string;
  flags: string[];
}

const SPORT_META: Record<Sport, { icon: string }> = {
  run: { icon: "🏃" },
  bike: { icon: "🚴" },
  swim: { icon: "🏊" },
  strength: { icon: "🏋️" },
};

const INTENSITY_COLORS: Record<string, string> = {
  easy: "text-teal",
  moderate: "text-orange",
  hard: "text-[var(--orange-bright)]",
  rest: "text-muted",
};

export default function WorkoutForm({ disciplines }: { disciplines: Sport[] }) {
  const t = useTranslations("workoutForm");
  const [sport, setSport] = useState<Sport>(disciplines[0] ?? "run");
  const [durationMin, setDurationMin] = useState(60);
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pushed, setPushed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [generated, setGenerated] = useState<GeneratedWorkout | null>(null);
  const [recovery, setRecovery] = useState<RecoverySummary | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    setGenerated(null);
    setRecovery(null);
    setPushed(false);

    try {
      const res = await fetch(`${API_URL}/workout/${ATHLETE_ID}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sport, durationMin, notes: notes || undefined }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json();
        throw new Error(msg ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setGenerated(data.workout);
      setRecovery(data.recovery);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function push() {
    if (!generated) return;
    setPushing(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/workout/${ATHLETE_ID}/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workout: generated }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json();
        throw new Error(msg ?? `HTTP ${res.status}`);
      }
      setPushed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPushing(false);
    }
  }

  const cols =
    disciplines.length <= 2
      ? "grid-cols-2"
      : disciplines.length === 3
        ? "grid-cols-3"
        : "grid-cols-4";

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
      {/* Form card */}
      <div className="bg-bg-card border border-border rounded-xl p-6 space-y-6">
        {/* Sport selector */}
        <div className="space-y-2">
          <label className="text-muted text-xs font-semibold uppercase tracking-widest">
            {t("discipline")}
          </label>
          <div className={`grid gap-2 ${cols}`}>
            {disciplines.map((s) => {
              const meta = SPORT_META[s] ?? { icon: "🏅" };
              return (
                <button
                  key={s}
                  onClick={() => setSport(s)}
                  className={`flex flex-col items-center gap-1 py-3 rounded-lg border text-sm font-medium transition-colors capitalize ${
                    sport === s
                      ? "border-teal bg-[var(--bg-assistant)] text-teal"
                      : "border-border text-muted hover:border-teal hover:text-text"
                  }`}
                >
                  <span className="text-xl">{meta.icon}</span>
                  {s}
                </button>
              );
            })}
          </div>
        </div>

        {/* Duration */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-muted text-xs font-semibold uppercase tracking-widest">
              {t("duration")}
            </label>
            <span className="text-teal font-bold text-lg">
              {durationMin} min
            </span>
          </div>
          <input
            type="range"
            min={15}
            max={240}
            step={5}
            value={durationMin}
            onChange={(e) => setDurationMin(Number(e.target.value))}
            className="w-full accent-[var(--teal)]"
          />
          <div className="flex justify-between text-muted text-xs">
            <span>{t("durationRange.min")}</span>
            <span>{t("durationRange.max")}</span>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <label className="text-muted text-xs font-semibold uppercase tracking-widest">
            {t("notes")}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("notesPlaceholder")}
            rows={2}
            className="w-full bg-bg border border-border rounded-lg px-4 py-3 text-text placeholder:text-muted text-sm resize-none focus:outline-none focus:border-teal transition-colors"
          />
        </div>

        <button
          onClick={generate}
          disabled={loading}
          className="w-full py-3 rounded-lg bg-teal text-white font-semibold text-sm tracking-wide uppercase hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading ? t("generating") : t("generate")}
        </button>
      </div>

      {/* Loading dots */}
      {loading && (
        <div className="flex justify-center gap-2 py-4">
          <span className="w-3 h-3 rounded-full bg-teal animate-bounce [animation-delay:-0.3s]" />
          <span className="w-3 h-3 rounded-full bg-teal animate-bounce [animation-delay:-0.15s]" />
          <span className="w-3 h-3 rounded-full bg-teal animate-bounce" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="border border-red-500/40 bg-red-500/10 rounded-xl px-5 py-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Recovery context */}
      {recovery && (
        <div className="bg-bg-card border border-border rounded-xl px-5 py-4 space-y-1">
          <p className="text-muted text-xs font-semibold uppercase tracking-widest">
            {t("recoveryContext")}
          </p>
          <p className="text-sm text-text">{recovery.summary}</p>
          {recovery.flags.length > 0 && (
            <p className="text-xs text-orange">
              {t("flags")}: {recovery.flags.join(", ")}
            </p>
          )}
        </div>
      )}

      {/* Generated workout */}
      {generated && (
        <div className="bg-bg-card border border-border rounded-xl p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-muted text-xs font-semibold uppercase tracking-widest">
                {generated.periodizationPhase}
              </p>
              <h2 className="text-teal font-bold text-xl mt-1 capitalize">
                {generated.sport} — {generated.durationMin} min
              </h2>
              <p
                className={`text-sm font-semibold uppercase mt-0.5 ${INTENSITY_COLORS[generated.intensity] ?? "text-text"}`}
              >
                {generated.intensity}
              </p>
            </div>
          </div>

          <pre className="font-mono text-sm text-text bg-bg border border-border rounded-lg px-4 py-4 whitespace-pre-wrap leading-relaxed">
            {generated.workoutStructure}
          </pre>

          <div className="border-t border-border pt-4">
            <p className="text-muted text-xs font-semibold uppercase tracking-widest mb-1">
              {t("coachRationale")}
            </p>
            <p className="text-text text-sm leading-relaxed">
              {generated.rationale}
            </p>
          </div>

          {generated.adjustmentsFromPlan.length > 0 && (
            <div>
              <p className="text-muted text-xs font-semibold uppercase tracking-widest mb-1">
                {t("planAdjustments")}
              </p>
              <ul className="list-disc list-inside space-y-0.5">
                {generated.adjustmentsFromPlan.map((adj, i) => (
                  <li key={i} className="text-text text-sm">
                    {adj}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="border-t border-border pt-4">
            {pushed ? (
              <div className="text-center py-2">
                <p className="text-teal font-semibold">{t("pushed")}</p>
              </div>
            ) : (
              <button
                onClick={push}
                disabled={pushing}
                className="w-full py-3 rounded-lg border border-teal text-teal font-semibold text-sm tracking-wide uppercase hover:bg-[var(--bg-assistant)] disabled:opacity-50 transition-colors"
              >
                {pushing ? t("pushing") : t("push")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
