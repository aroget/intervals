"use client";

import { useState } from "react";
import { API_URL, ATHLETE_ID, fetcher } from "@/lib/api";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import useSWR from "swr";
import { useSidebar } from "@/components/SidebarContext";
import { useChatDrawer } from "@/components/ChatContext";


type SyncState = "idle" | "syncing" | "done" | "error";

export function Sidebar() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const { isOpen, close } = useSidebar();
  const { toggle: toggleChat } = useChatDrawer();
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const { data: authData } = useSWR<{ authenticated: boolean }>(
    "/api/auth/me",
    fetcher,
    { revalidateOnFocus: false },
  );
  const isAuthenticated = authData?.authenticated ?? false;

  // Never show sidebar on the public landing page
  if (pathname === `/${locale}` || pathname === `/${locale}/`) return null;
  if (!isAuthenticated) return null;

  async function triggerSync() {
    if (syncState === "syncing") return;
    setSyncState("syncing");
    try {
      const res = await fetch(`${API_URL}/sync`, { method: "POST" });
      setSyncState(res.ok ? "done" : "error");
    } catch {
      setSyncState("error");
    } finally {
      setTimeout(() => setSyncState("idle"), 3000);
    }
  }

  const links = [
    { href: `/${locale}/dashboard`, label: t("dashboard") },
    { href: `/${locale}/analytics`, label: t("analytics") },
    { href: `/${locale}/workout/new`, label: t("newWorkout") },
    { href: `/${locale}/settings`, label: t("settings") },
  ];

  const navContent = (
    <nav className="flex flex-col gap-0.5 p-3 pt-4">
      {links.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={close}
            className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
              active
                ? "bg-[var(--bg-assistant)] text-teal"
                : "text-muted hover:text-text hover:bg-bg"
            }`}
          >
            {label}
          </Link>
        );
      })}

      <div className="my-2 border-t border-border" />

      <button
        onClick={() => {
          triggerSync();
        }}
        disabled={syncState === "syncing"}
        className={`px-3 py-2 rounded-lg text-sm font-semibold text-left transition-colors disabled:opacity-50 ${
          syncState === "done"
            ? "text-teal"
            : syncState === "error"
              ? "text-orange"
              : "text-muted hover:text-text hover:bg-bg"
        }`}
      >
        {syncState === "syncing"
          ? t("syncing")
          : syncState === "done"
            ? t("synced")
            : syncState === "error"
              ? t("syncError")
              : t("sync")}
      </button>

      <button
        onClick={() => {
          toggleChat();
          close();
        }}
        className="px-3 py-2 rounded-lg text-sm font-semibold text-left text-muted hover:text-text hover:bg-bg transition-colors"
      >
        {t("chat")}
      </button>
    </nav>
  );

  return (
    <>
      {/* Desktop — always visible */}
      <aside className="hidden lg:block w-48 shrink-0 border-r border-border bg-bg-card sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
        {navContent}
      </aside>

      {/* Mobile — slide-in overlay */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
            onClick={close}
          />
          <aside className="fixed top-14 left-0 bottom-0 z-40 w-48 bg-bg-card border-r border-border overflow-y-auto lg:hidden">
            {navContent}
          </aside>
        </>
      )}
    </>
  );
}
