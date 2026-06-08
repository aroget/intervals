"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useTheme } from "next-themes";

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
type Tab = "account" | "goals" | "training";

const DAYS: Day[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const ALL_SPORTS: { value: Sport; icon: string }[] = [
  { value: "run", icon: "🏃" },
  { value: "bike", icon: "🚴" },
  { value: "swim", icon: "🏊" },
  { value: "strength", icon: "🏋️" },
];

const PHILOSOPHY_VALUES = ["polarized", "pyramidal", "linear"] as const;

export interface ProfileData {
  athleteId: string;
  name: string;
  goals: string;
  trainingPhilosophy: string;
  disciplines: Sport[];
  weeklyMaxHours: Record<Day, number>;
  cycleStartDate: string;
  coachingNotes: string; // Custom instructions for the AI coach
  preferredTheme: "light" | "dark" | "system"; // Theme preference
  createdAt: string | null;
  ftp: number | null;
  runningThresholdPace: number | null; // seconds per km
  lthr: number | null; // Lactate Threshold Heart Rate in bpm
}

// ── Pace helpers ──────────────────────────────────────────────────────────────

function secsToMMSS(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function mmssToSecs(value: string): number | null {
  const m = value.match(/^(\d+):([0-5]\d)$/);
  if (!m) return null;
  return parseInt(m[1]) * 60 + parseInt(m[2]);
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
      <h2 className="text-muted text-xs font-semibold uppercase tracking-widest">
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <span className="text-muted text-sm">{label}</span>
      <span className="text-text text-sm font-mono">{value}</span>
    </div>
  );
}

function SaveBar({
  saving,
  saved,
  error,
  onSave,
  t,
}: {
  saving: boolean;
  saved: boolean;
  error: string | null;
  onSave: () => void;
  t: ReturnType<typeof useTranslations<"settings">>;
}) {
  return (
    <div className="flex items-center gap-4">
      <button
        onClick={onSave}
        disabled={saving}
        className="px-6 py-2.5 rounded-lg bg-teal text-white font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {saving ? t("saving") : t("save")}
      </button>
      {saved && (
        <span className="text-teal text-sm font-medium">{t("saved")}</span>
      )}
      {error && <span className="text-red-400 text-sm">{error}</span>}
    </div>
  );
}

export default function SettingsForm({ profile }: { profile: ProfileData }) {
  const t = useTranslations("settings");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const { setTheme } = useTheme();

  const activeTab = (searchParams.get("tab") as Tab) ?? "account";

  function setTab(tab: Tab) {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      router.replace(`/${locale}/settings?${params.toString()}`, {
        scroll: false,
      });
    });
  }

  const [form, setForm] = useState<ProfileData>(profile);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Local string state for the pace input so intermediate keystrokes don't clear the field
  const [paceInput, setPaceInput] = useState(
    profile.runningThresholdPace != null
      ? secsToMMSS(profile.runningThresholdPace)
      : "",
  );

  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function set<K extends keyof ProfileData>(key: K, value: ProfileData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  function toggleSport(sport: Sport) {
    const next = form.disciplines.includes(sport)
      ? form.disciplines.filter((s) => s !== sport)
      : [...form.disciplines, sport];
    if (next.length === 0) return;
    set("disciplines", next);
  }

  function setDayHours(day: Day, hours: number) {
    set("weeklyMaxHours", { ...form.weeklyMaxHours, [day]: hours });
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
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
          coachingNotes: form.coachingNotes || undefined,
          preferredTheme: form.preferredTheme,
          ftp: form.ftp,
          runningThresholdPace: form.runningThresholdPace,
          lthr: form.lthr,
        }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json();
        throw new Error(msg ?? `HTTP ${res.status}`);
      }
      setSaved(true);
      // Note: Plan is NOT automatically regenerated to preserve user's existing schedule.
      // Plans only regenerate on the daily cron (6:30am UTC) or manual replan actions.
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`${API}/athlete/${form.athleteId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const { error: msg } = await res.json();
        throw new Error(msg ?? `HTTP ${res.status}`);
      }
      router.replace(`/${locale}/dashboard`);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err));
      setDeleting(false);
    }
  }

  const philosophyDesc = PHILOSOPHY_VALUES.includes(
    form.trainingPhilosophy as (typeof PHILOSOPHY_VALUES)[number],
  )
    ? t(
        `philosophies.${form.trainingPhilosophy}Desc` as Parameters<
          typeof t
        >[0],
      )
    : null;

  const memberSince = profile.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

  const TABS: { id: Tab; label: string }[] = [
    { id: "account", label: t("tabs.account") },
    { id: "goals", label: t("tabs.goals") },
    { id: "training", label: t("tabs.training") },
  ];

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 className="text-text font-bold text-2xl">{t("title")}</h1>
        <p className="text-muted text-sm mt-1">{t("subtitle")}</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-bg-card border border-border rounded-xl">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === id
                ? "bg-teal text-white shadow-sm"
                : "text-muted hover:text-text"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Account ── */}
      {activeTab === "account" && (
        <div className="space-y-6">
          <Section title={t("sections.accountInfo")}>
            <InfoRow label={t("fields.athleteId")} value={profile.athleteId} />
            <InfoRow label={t("fields.memberSince")} value={memberSince} />
            <div className="pt-1">
              <Field label={t("fields.name")}>
                <input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  className={inputCls}
                  placeholder={t("fields.namePlaceholder")}
                />
              </Field>
            </div>
          </Section>

          <Section title="Appearance">
            <p className="text-muted text-sm mb-3">
              Choose your preferred color theme. This setting will sync across
              all your devices.
            </p>
            <Field label="Theme">
              <div className="flex gap-2">
                {[
                  { value: "light", label: "☀️ Light", icon: "☀️" },
                  { value: "dark", label: "🌙 Dark", icon: "🌙" },
                  { value: "system", label: "💻 System", icon: "💻" },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => {
                      set(
                        "preferredTheme",
                        value as "light" | "dark" | "system",
                      );
                      setTheme(value);
                    }}
                    className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all border ${
                      form.preferredTheme === value
                        ? "bg-teal text-white border-teal shadow-sm"
                        : "bg-bg border-border text-muted hover:text-text hover:border-teal/40"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Field>
          </Section>

          <SaveBar
            saving={saving}
            saved={saved}
            error={saveError}
            onSave={save}
            t={t}
          />

          <Section title={t("sections.dangerZone")}>
            <p className="text-muted text-sm">{t("deleteAccount.hint")}</p>
            <div className="space-y-2">
              <label className="text-muted text-xs font-semibold uppercase tracking-widest">
                {t("deleteAccount.confirm")}
              </label>
              <input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={t("deleteAccount.confirmPlaceholder")}
                className={`${inputCls} border-red-500/40 focus:border-red-500`}
              />
            </div>
            <button
              onClick={deleteAccount}
              disabled={deleteConfirm !== "DELETE" || deleting}
              className="px-5 py-2.5 rounded-lg bg-red-500/10 border border-red-500/40 text-red-400 font-semibold text-sm hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {deleting
                ? t("deleteAccount.deleting")
                : t("deleteAccount.button")}
            </button>
            {deleteError && (
              <p className="text-red-400 text-sm">{deleteError}</p>
            )}
          </Section>
        </div>
      )}

      {/* ── Goals ── */}
      {activeTab === "goals" && (
        <div className="space-y-6">
          <Section title={t("sections.profile")}>
            <p className="text-muted text-sm">{t("fields.goalsHint")}</p>
            <Field label={t("fields.goals")}>
              <textarea
                value={form.goals}
                onChange={(e) => set("goals", e.target.value)}
                rows={6}
                className={`${inputCls} resize-none`}
                placeholder={t("fields.goalsPlaceholder")}
              />
            </Field>

            <Field label="Custom Coaching Instructions">
              <textarea
                value={form.coachingNotes || ""}
                onChange={(e) => set("coachingNotes", e.target.value)}
                rows={4}
                className={`${inputCls} resize-none`}
                placeholder="Optional: Add any preferences, constraints, or context you want your coach to always consider (e.g., 'I prefer morning runs', 'avoid back-to-back hard days', 'I have a race in 6 weeks')"
              />
              <p className="text-muted text-xs mt-1.5">
                These notes will be included in all coaching decisions
              </p>
            </Field>
          </Section>

          <SaveBar
            saving={saving}
            saved={saved}
            error={saveError}
            onSave={save}
            t={t}
          />
        </div>
      )}

      {/* ── Training ── */}
      {activeTab === "training" && (
        <div className="space-y-6">
          <Section title={t("sections.profile")}>
            <Field label={t("fields.philosophy")}>
              <select
                value={form.trainingPhilosophy}
                onChange={(e) => set("trainingPhilosophy", e.target.value)}
                className={inputCls}
              >
                <option value="" disabled>
                  {t("fields.philosophyPlaceholder")}
                </option>
                {PHILOSOPHY_VALUES.map((p) => (
                  <option key={p} value={p}>
                    {t(`philosophies.${p}` as Parameters<typeof t>[0])}
                  </option>
                ))}
              </select>
              {philosophyDesc && (
                <p className="text-muted text-xs mt-1.5">{philosophyDesc}</p>
              )}
            </Field>
          </Section>

          <Section title={t("sections.disciplines")}>
            <div className="grid grid-cols-4 gap-2">
              {ALL_SPORTS.map((s) => {
                const active = form.disciplines.includes(s.value);
                return (
                  <button
                    key={s.value}
                    onClick={() => toggleSport(s.value)}
                    className={`flex flex-col items-center gap-1 py-3 rounded-lg border text-sm font-medium transition-colors capitalize ${
                      active
                        ? "border-teal bg-[var(--bg-assistant)] text-teal"
                        : "border-border text-muted hover:border-teal hover:text-text"
                    }`}
                  >
                    <span className="text-xl">{s.icon}</span>
                    {s.value}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title={t("sections.weeklyHours")}>
            <p className="text-muted text-xs">
              {t("sections.weeklyHoursHint")}
            </p>
            <div className="space-y-3 pt-1">
              {DAYS.map((day) => {
                const hours = form.weeklyMaxHours[day] ?? 1;
                return (
                  <div key={day} className="flex items-center gap-4">
                    <span className="text-muted text-sm w-10 shrink-0">
                      {t(`days.${day}` as Parameters<typeof t>[0])}
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
                      {hours === 0 ? t("rest") : `${hours} h`}
                    </span>
                  </div>
                );
              })}
            </div>
          </Section>

          <Section title={t("sections.cycle")}>
            <Field label={t("fields.cycleStartDate")}>
              <input
                type="date"
                value={form.cycleStartDate}
                onChange={(e) => set("cycleStartDate", e.target.value)}
                className={inputCls}
              />
            </Field>
            <p className="text-muted text-xs">{t("fields.cycleHint")}</p>
          </Section>

          <Section title={t("sections.thresholds")}>
            <p className="text-muted text-xs">{t("sections.thresholdsHint")}</p>
            <Field label={t("fields.ftp")}>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={50}
                  max={600}
                  value={form.ftp ?? ""}
                  onChange={(e) =>
                    set(
                      "ftp",
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                  placeholder={t("fields.ftpPlaceholder")}
                  className={`${inputCls} w-32`}
                />
                <span className="text-muted text-sm">watts</span>
              </div>
            </Field>
            <Field label={t("fields.lthr")}>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={100}
                  max={220}
                  value={form.lthr ?? ""}
                  onChange={(e) =>
                    set(
                      "lthr",
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                  placeholder={t("fields.lthrPlaceholder")}
                  className={`${inputCls} w-32`}
                />
                <span className="text-muted text-sm">bpm</span>
              </div>
            </Field>
            <Field label={t("fields.runThreshold")}>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={paceInput}
                  onChange={(e) => {
                    setPaceInput(e.target.value);
                    setSaved(false);
                  }}
                  onBlur={(e) => {
                    const secs = mmssToSecs(e.target.value);
                    if (secs !== null) {
                      set("runningThresholdPace", secs);
                      setPaceInput(secsToMMSS(secs));
                    } else if (e.target.value === "") {
                      set("runningThresholdPace", null);
                    }
                  }}
                  placeholder="4:15"
                  className={`${inputCls} w-32 font-mono`}
                />
                <span className="text-muted text-sm">/km</span>
              </div>
            </Field>
          </Section>

          <SaveBar
            saving={saving}
            saved={saved}
            error={saveError}
            onSave={save}
            t={t}
          />
        </div>
      )}
    </div>
  );
}
