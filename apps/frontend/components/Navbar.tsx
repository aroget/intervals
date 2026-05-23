"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useSidebar } from "@/components/SidebarContext";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r: any) => r.json());

export function Navbar() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const { toggle: toggleSidebar } = useSidebar();

  const { data: authData } = useSWR<{ authenticated: boolean }>(
    "/api/auth/me",
    fetcher,
    { revalidateOnFocus: false },
  );
  const isAuthenticated = authData?.authenticated ?? false;

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-bg-card/90 backdrop-blur">
      <div className="px-4 flex items-center justify-between h-14 gap-2">
        <div className="flex items-center gap-2">
          {/* Hamburger — mobile, toggles sidebar */}
          {isAuthenticated && (
            <button
              onClick={toggleSidebar}
              className="lg:hidden w-8 h-8 flex flex-col justify-center gap-[5px] rounded-lg border border-border p-1.5 shrink-0"
              aria-label={t("toggleMenu")}
            >
              <span className="block h-0.5 bg-text rounded" />
              <span className="block h-0.5 bg-text rounded" />
              <span className="block h-0.5 bg-text rounded" />
            </button>
          )}
          <Link
            href={`/${locale}`}
            className="flex items-center gap-2 shrink-0"
          >
            <span className="font-bold text-teal tracking-tight text-base hidden sm:block">
              {t("brand")}
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {isAuthenticated ? (
            <a
              href="/api/auth/logout"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted hover:text-text border border-border hover:border-text/30 transition-colors"
            >
              {t("logout")}
            </a>
          ) : (
            <a
              href="/api/auth/login"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal text-white hover:opacity-90 transition-opacity"
            >
              {t("login")}
            </a>
          )}
        </div>
      </div>
    </nav>
  );
}
