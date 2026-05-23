"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

const ERROR_MESSAGES: Record<string, string> = {
  cancelled: "Login was cancelled.",
  invalid_state: "Invalid request. Please try again.",
  token_failed: "Could not connect to Intervals.icu. Please try again.",
  unauthorized: "This account is not authorised to access this app.",
  misconfigured:
    "App is not configured. Set INTERVALS_CLIENT_ID and INTERVALS_CLIENT_SECRET.",
  no_code: "No authorisation code received. Please try again.",
};

const PASSWORD_AUTH = process.env.NEXT_PUBLIC_PASSWORD_AUTH === "true";

function LoginContent() {
  const params = useSearchParams();
  const error = params.get("error");

  const [password, setPassword] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setPwError(null);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.href = "/en/dashboard";
      } else {
        const data = await res.json();
        setPwError((data as { error?: string }).error ?? "Incorrect password.");
      }
    } catch {
      setPwError("Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="rounded-2xl border border-border bg-bg-card p-10 shadow-sm space-y-8 w-full max-w-sm text-center">
        {/* Logo / title */}
        <div className="space-y-2">
          <div className="relative w-60 h-24 overflow-hidden mx-auto">
            <Image
              src="/logo.png"
              alt="Intervals Coach"
              fill
              className="object-cover"
              priority
              placeholder="empty"
              unoptimized
            />
          </div>
          <h1 className="text-2xl font-bold text-text">Intervals Coach</h1>
          <p className="text-sm text-muted leading-relaxed">
            AI-powered coaching powered by your Intervals.icu data.
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="bg-peach/20 border border-peach rounded-xl px-4 py-3 text-sm text-orange font-medium">
            {ERROR_MESSAGES[error] ?? "Something went wrong. Please try again."}
          </div>
        )}

        {PASSWORD_AUTH ? (
          /* ── Password gate ─────────────────────────────────────────────── */
          <form onSubmit={handlePasswordSubmit} className="space-y-3 text-left">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Access password"
              required
              className="w-full rounded-xl bg-bg border border-border focus:border-teal focus:outline-none px-4 py-2.5 text-sm text-text placeholder:text-muted"
            />
            {pwError && (
              <p className="text-sm text-orange text-center">{pwError}</p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-teal text-white font-semibold py-3 px-6 text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
        ) : (
          /* ── OAuth ─────────────────────────────────────────────────────── */
          <>
            <a
              href="/api/auth/login"
              className="block w-full rounded-xl bg-teal text-white font-semibold py-3 px-6 text-sm hover:opacity-90 transition-opacity"
            >
              Connect with Intervals.icu
            </a>
            <p className="text-xs text-muted">
              You&apos;ll be redirected to Intervals.icu to authorise access. No
              password is stored by this app.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
