"use client";

import dynamic from "next/dynamic";

const ChatDrawer = dynamic(
  () => import("@/components/ChatDrawer").then((m) => m.ChatDrawer),
  { ssr: false },
);

export function ClientChatDrawer() {
  return <ChatDrawer />;
}
