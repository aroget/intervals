"use client";

import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useChatDrawer } from "@/components/ChatContext";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:7000";
const ATHLETE_ID = process.env.NEXT_PUBLIC_ATHLETE_ID ?? "";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED = [
  "What did I do last week?",
  "How is my HRV trending?",
  "What's my workout today and why?",
];

export function ChatDrawer() {
  const { isOpen, close } = useChatDrawer();

  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusTexts, setStatusTexts] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Focus input when drawer opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Auto-resize textarea as content grows
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);

  async function getOrCreateThread(): Promise<string> {
    if (threadId) return threadId;
    const res = await fetch(`${API}/chat/threads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ athleteId: ATHLETE_ID }),
    });
    if (!res.ok) throw new Error(`Could not start thread (${res.status})`);
    const data = await res.json();
    setThreadId(data.threadId);
    return data.threadId;
  }

  async function send() {
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    // Add an empty assistant message that we'll fill in as chunks arrive
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
    setStatusTexts([]);

    try {
      const tid = await getOrCreateThread();
      const res = await fetch(`${API}/chat/threads/${tid}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as {
              type: string;
              text?: string;
              message?: string;
            };
            if (event.type === "chunk" && event.text) {
              setStatusTexts([]);
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: updated[updated.length - 1].content + event.text!,
                };
                return updated;
              });
            } else if (event.type === "status" && event.text) {
              setStatusTexts((prev) => [...prev, event.text!]);
            } else if (event.type === "error") {
              throw new Error(event.message ?? "Agent error");
            }
          } catch {
            // ignore malformed SSE lines
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setError(msg);
      // Remove both the user message and the empty assistant message
      setMessages((prev) => prev.slice(0, -2));
      setInput(userMessage);
    } finally {
      setLoading(false);
      setStatusTexts([]);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={close}
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-label="Coach chat"
        className={`fixed top-14 right-0 bottom-0 z-50 w-full sm:w-[820px] flex flex-col bg-bg border-l border-border shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <p className="text-base font-semibold text-teal">
                Ask your coach anything
              </p>
              <div className="flex flex-col gap-2 text-sm w-full">
                {SUGGESTED.map((q) => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="rounded-xl border border-border hover:bg-mint/40 px-4 py-2.5 text-text font-medium transition-colors text-left"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {m.role === "user" ? (
                <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-orange px-4 py-3 text-sm font-semibold text-white leading-relaxed">
                  {m.content}
                </div>
              ) : (
                <div className="max-w-[90%] rounded-2xl rounded-bl-sm bg-bg-assistant border border-border px-4 py-3 text-sm text-text overflow-x-auto">
                  {m.content ? (
                    <div className="prose-chat">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {m.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    // Empty bubble — waiting for first chunk, status renders above
                    <span className="inline-flex gap-2 items-center">
                      <span className="w-2 h-2 rounded-full bg-teal animate-bounce [animation-delay:0ms]" />
                      <span className="w-2 h-2 rounded-full bg-teal animate-bounce [animation-delay:150ms]" />
                      <span className="w-2 h-2 rounded-full bg-teal animate-bounce [animation-delay:300ms]" />
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}

          {statusTexts.length > 0 && (
            <div className="flex justify-start">
              <div className="flex flex-col gap-0.5 pl-1">
                {statusTexts.map((s, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 text-[11px] font-mono text-muted/70"
                  >
                    <span className="text-teal/60">›</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 px-4 py-3 border-t border-border bg-bg-card">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex gap-2 items-end"
          >
            <button
              type="button"
              onClick={close}
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-border text-muted hover:text-text hover:bg-border/40 transition-colors shrink-0"
              aria-label="Close chat"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M1 1l12 12M13 1L1 13"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Ask your coach…"
              disabled={loading}
              className="flex-1 rounded-xl bg-bg border border-border focus:border-teal focus:outline-none px-4 py-2.5 text-sm text-text placeholder:text-muted font-medium disabled:opacity-50 resize-none overflow-hidden leading-snug max-h-48"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="rounded-xl bg-orange hover:bg-peach disabled:opacity-40 px-5 py-2 text-sm font-semibold text-white transition-colors"
            >
              Send
            </button>
          </form>
          {error && (
            <p className="mt-2 text-xs text-peach font-medium">{error}</p>
          )}
        </div>
      </div>
    </>
  );
}
