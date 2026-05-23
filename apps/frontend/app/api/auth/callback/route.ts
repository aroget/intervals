import { NextRequest, NextResponse } from "next/server";
import { signSession, SESSION_COOKIE } from "@/lib/session";

const TOKEN_URL = "https://intervals.icu/api/oauth/token";
const ALLOWED_ATHLETE_ID = process.env.ALLOWED_ATHLETE_ID ?? "i101309";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:7003";
  const loginUrl = `${baseUrl}/en/login`;
  const dashboardUrl = `${baseUrl}/en/dashboard`;

  // User declined
  if (error === "access_denied") {
    return NextResponse.redirect(`${loginUrl}?error=cancelled`);
  }

  // Validate state (CSRF)
  const storedState = req.cookies.get("oauth_state")?.value;
  if (!state || state !== storedState) {
    return NextResponse.redirect(`${loginUrl}?error=invalid_state`);
  }

  if (!code) {
    return NextResponse.redirect(`${loginUrl}?error=no_code`);
  }

  const clientId = process.env.INTERVALS_CLIENT_ID;
  const clientSecret = process.env.INTERVALS_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${loginUrl}?error=misconfigured`);
  }

  // Exchange code for token
  let athleteId: string;
  let athleteName: string;
  try {
    const redirectUri = `${baseUrl}/api/auth/callback`;
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    });

    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!tokenRes.ok) {
      console.error("[auth/callback] Token exchange failed:", tokenRes.status);
      return NextResponse.redirect(`${loginUrl}?error=token_failed`);
    }

    const data = (await tokenRes.json()) as {
      access_token: string;
      athlete: { id: string; name: string };
    };

    athleteId = data.athlete.id;
    athleteName = data.athlete.name;
  } catch (err) {
    console.error("[auth/callback] Token exchange error:", err);
    return NextResponse.redirect(`${loginUrl}?error=token_failed`);
  }

  // Enforce allowlist — only the configured athlete may log in
  if (athleteId !== ALLOWED_ATHLETE_ID) {
    console.warn(
      `[auth/callback] Rejected login attempt from athlete ${athleteId}`,
    );
    return NextResponse.redirect(`${loginUrl}?error=unauthorized`);
  }

  // Issue session cookie
  const token = await signSession({ athleteId, athleteName });

  const res = NextResponse.redirect(dashboardUrl);
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
  // Clear the oauth_state cookie
  res.cookies.delete("oauth_state");

  console.log(`[auth/callback] Logged in: ${athleteName} (${athleteId})`);
  return res;
}
