import { NextResponse } from "next/server";

const AUTHORIZE_URL = "https://intervals.icu/oauth/authorize";
const SCOPES = "ACTIVITY:READ,WELLNESS:READ,SETTINGS:READ";

export async function GET(): Promise<NextResponse> {
  const clientId = process.env.INTERVALS_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "INTERVALS_CLIENT_ID is not configured" },
      { status: 500 },
    );
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:7003";
  const redirectUri = `${baseUrl}/api/auth/callback`;

  // CSRF protection: random state stored in a short-lived cookie
  const state = crypto.randomUUID();

  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("state", state);

  const res = NextResponse.redirect(url.toString());
  res.cookies.set("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 300, // 5 minutes
  });
  return res;
}
