"use client";

import { createContext, useContext, useState } from "react";

interface ChatContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <ChatContext.Provider
      value={{
        isOpen,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
        toggle: () => setIsOpen((o) => !o),
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChatDrawer() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatDrawer must be used inside ChatProvider");
  return ctx;
}
