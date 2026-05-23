"use client";

import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:7000";

type Sport = "run" | "bike" | "swim" | "strength";
type Day =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

const DAYS: Day[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];
const DAY_LABELS: Record<Day, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

const ALL_SPORTS: { value: Sport; label: string; icon: string }[] = [
  { value: "run", label: "Run", icon: "🏃" },
  { value: "bike", label: "Bike", icon: "🚴" },
  { value: "swim", label: "Swim", icon: "🏊" },
  { value: "strength", label: "Strength", icon: "🏋️" },
];

const PHILOSOPHIES: { value: string; label: string; description: string }[] = [
  {
    value: "polarized",
    label: "Polarized",
    description: "~80% easy, ~20% high-intensity — no moderate zone",
  },
  {
    value: "pyramidal",
    label: "Pyramidal",
    description: "Mostly easy, some moderate, a little hard",
  },
  {
    value: "linear",
    label: "Linear",
    description: "Traditional progressive overload with gradual increases",
  },
];

export interface ProfileData {
  athleteId: string;
  name: string;
  goals: string;
  trainingPhilosophy: string;
  disciplines: Sport[];
  weeklyMaxHours: Record<Day, number>;
  cycleStartDate: string;
}

export default function SettingsForm({ profile }: { profile: ProfileData }) {
  const [form, setForm] = useState<ProfileData>(profile);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof ProfileData>(key: K, value: ProfileData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  function toggleSport(sport: Sport) {
    const current = form.disciplines;
    const next = current.includes(sport)
      ? current.filter((s) => s !== sport)
      : [...current, sport];
    if (next.length === 0) return; // must keep at least one
    set("disciplines", next);
  }

  function setDayHours(day: Day, hours: number) {
    set("weeklyMaxHours", { ...form.weeklyMaxHours, [day]: hours });
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`${API}/athlete`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          athleteId: form.athleteId,
          name: form.name,
          goals: form.goals,
          trainingPhilosophy: form.trainingPhilosophy,
          disciplines: form.disciplines,
          weeklyMaxHours: form.weeklyMaxHours,
          cycleStartDate: form.cycleStartDate || undefined,
        }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json();
        throw new Error(msg ?? `HTTP ${res.status}`);
      }
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 className="text-text font-bold text-2xl">Settings</h1>
        <p className="text-muted text-sm mt-1">
          Your athlete profile and training preferences.
        </p>
      </div>

      {/* Identity */}
      <Section title="Profile">
        <Field label="Name">
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            className={inputCls}
            placeholder="Your name"
          />
        </Field>
        <Field label="Goals">
          <textarea
            value={form.goals}
            onChange={(e) => set("goals", e.target.value)}
            rows={3}
            className={`${inputCls} resize-none`}
            placeholder="e.g. Complete a sprint triathlon, improve 5K time..."
          />
        </Field>
        <Field label="Training Philosophy">
          <select
            value={form.trainingPhilosophy}
            onChange={(e) => set("trainingPhilosophy", e.target.value)}
            className={inputCls}
          >
            <option value="" disabled>
              Select a philosophy…
            </option>
            {PHILOSOPHIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          {form.trainingPhilosophy && (
            <p className="text-muted text-xs mt-1">
              {
                PHILOSOPHIES.find((p) => p.value === form.trainingPhilosophy)
                  ?.description
              }
            </p>
          )}
        </Field>
      </Section>

      {/* Disciplines */}
      <Section title="Disciplines">
        <div className="grid grid-cols-4 gap-2">
          {ALL_SPORTS.map((s) => {
            const active = form.disciplines.includes(s.value);
            return (
              <button
                key={s.value}
                onClick={() => toggleSport(s.value)}
                className={`flex flex-col items-center gap-1 py-3 rounded-lg border text-sm font-medium transition-colors ${
                  active
                    ? "border-teal bg-[var(--bg-assistant)] text-teal"
                    : "border-border text-muted hover:border-teal hover:text-text"
                }`}
              >
                <span className="text-xl">{s.icon}</span>
                {s.label}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Weekly max hours */}
      <Section title="Max Training Hours per Day">
        <p className="text-muted text-xs mb-3">
          The coach will not prescribe more than this per day.
        </p>
        <div className="space-y-3">
          {DAYS.map((day) => {
            const hours = form.weeklyMaxHours[day] ?? 1;
            return (
              <div key={day} className="flex items-center gap-4">
                <span className="text-muted text-sm w-10 shrink-0">
                  {DAY_LABELS[day]}
                </span>
                <input
                  type="range"
                  min={0}
                  max={4}
                  step={0.25}
                  value={hours}
                  onChange={(e) => setDayHours(day, Number(e.target.value))}
                  className="flex-1 accent-[var(--teal)]"
                />
                <span className="text-teal font-semibold text-sm w-14 text-right shrink-0">
                  {hours === 0 ? "Rest" : `${hours} h`}
                </span>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Cycle */}
      <Section title="Training Cycle">
        <Field label="Cycle Start Date">
          <input
            type="date"
            value={form.cycleStartDate}
            onChange={(e) => set("cycleStartDate", e.target.value)}
            className={inputCls}
          />
        </Field>
        <p className="text-muted text-xs mt-1">
          Week 1 = base, Week 2 = build, Week 3 = peak, Week 4 = recovery. The
          cycle repeats every 28 days from this date.
        </p>
      </Section>

      {/* Save */}
      <div className="flex items-center gap-4">
        <button
          onClick={save}
          disabled={saving}
          className="px-6 py-2.5 rounded-lg bg-teal text-white font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
        {saved && (
          <span className="text-teal text-sm font-medium">Saved ✓</span>
        )}
        {error && <span className="text-red-400 text-sm">{error}</span>}
      </div>
    </div>
  );
}

const inputCls =
  "w-full bg-bg border border-border rounded-lg px-4 py-2.5 text-text placeholder:text-muted text-sm focus:outline-none focus:border-teal transition-colors";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-6 space-y-4">
      <h2 className="text-text font-semibold text-sm uppercase tracking-widest text-muted">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-muted text-xs font-semibold uppercase tracking-widest">
        {label}
      </label>
      {children}
    </div>
  );
}
