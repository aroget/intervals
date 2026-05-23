import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { getMessages } from "next-intl/server";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ChatProvider } from "@/components/ChatContext";
import { ClientChatDrawer } from "@/components/ClientChatDrawer";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { SidebarProvider } from "@/components/SidebarContext";
import { routing } from "@/i18n/routing";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ThemeProvider>
        <ChatProvider>
          <SidebarProvider>
            <div className="flex flex-col min-h-screen">
              <Navbar />
              <div className="flex flex-1">
                <Sidebar />
                <div className="flex-1 min-w-0">
                  <ClientChatDrawer />
                  {children}
                </div>
              </div>
            </div>
          </SidebarProvider>
        </ChatProvider>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
