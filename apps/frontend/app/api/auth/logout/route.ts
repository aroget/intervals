import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

export async function GET(): Promise<NextResponse> {
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:7003";
  const res = NextResponse.redirect(`${baseUrl}/en/login`);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
