import { NextRequest, NextResponse } from "next/server";
import { signSession, SESSION_COOKIE } from "@/lib/session";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const sitePassword = process.env.SITE_PASSWORD;
  console.log(
    "Attempting password login with SITE_PASSWORD:",
    Boolean(sitePassword),
  );
  if (!sitePassword) {
    return NextResponse.json(
      { error: "Password auth is not enabled." },
      { status: 404 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { password?: string };
  if (!body.password || body.password !== sitePassword) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const athleteId = process.env.ALLOWED_ATHLETE_ID ?? "";
  const token = await signSession({ athleteId, athleteName: "Password auth" });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
  return res;
}
