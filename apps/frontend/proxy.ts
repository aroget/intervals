import { NextRequest, NextResponse } from "next/server";
import { verifySession, signSession, SESSION_COOKIE } from "@/lib/session";

// Paths that don't require authentication
const PUBLIC_PREFIXES = ["/api/auth/", "/_next/", "/favicon.ico"];
const PUBLIC_EXACT = new Set(["/en/login", "/en", "/en/"]);

const LOGIN_PATH = "/en/login";
const LOCALES = ["en"];
const DEFAULT_LOCALE = "en";

export async function proxy(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // ── Locale redirect ─────────────────────────────────────────────────────────
  // If the path doesn't start with a known locale prefix (and isn't a static
  // file or API route), redirect to the default locale variant.
  const hasLocalePrefix = LOCALES.some(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`),
  );
  const isStaticOrApi =
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p)) ||
    pathname === "/favicon.ico";

  if (!hasLocalePrefix && !isStaticOrApi) {
    return NextResponse.redirect(
      new URL(`/${DEFAULT_LOCALE}${pathname}`, req.url),
    );
  }

  // Allow static files, API auth routes, login page, and landing page
  if (
    PUBLIC_EXACT.has(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return NextResponse.next();
  }

  // ── Dev bypass ──────────────────────────────────────────────────────────────
  // Set AUTH_BYPASS=true in .env.local to skip OAuth during development.
  // NEVER enable this in production.
  if (process.env.AUTH_BYPASS === "true") {
    const existing = req.cookies.get(SESSION_COOKIE)?.value;
    const session = existing ? await verifySession(existing) : null;
    if (!session) {
      // Auto-issue a session for the configured athlete
      const athleteId = process.env.ALLOWED_ATHLETE_ID ?? "i101309";
      const token = await signSession({ athleteId, athleteName: "Dev bypass" });
      const res = NextResponse.next();
      res.cookies.set(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
      });
      return res;
    }
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;

  if (!token) {
    return NextResponse.redirect(new URL(LOGIN_PATH, req.url));
  }

  const session = await verifySession(token);
  if (!session) {
    const res = NextResponse.redirect(new URL(LOGIN_PATH, req.url));
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static  (Next.js static files)
     * - _next/image   (Next.js image optimization)
     * - favicon.ico   (browser icon)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\..*).*)",
  ],
};
