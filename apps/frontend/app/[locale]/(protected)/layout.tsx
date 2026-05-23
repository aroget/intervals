import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

export default async function ProtectedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  // AUTH_BYPASS=true skips auth in local development only. Never set in production.
  if (process.env.AUTH_BYPASS === "true") {
    return <>{children}</>;
  }

  const { locale } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  if (!session) {
    redirect(`/${locale}/login`);
  }

  return <>{children}</>;
}
