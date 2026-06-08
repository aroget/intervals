import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { runChatAgentStreaming } from "../../agents/chat/agent.js";
import { db } from "../../db/client.js";

const chat = new Hono();

const StartThreadSchema = z.object({ athleteId: z.string() });
const MessageSchema = z.object({ message: z.string().min(1).max(4000) });

/** POST /chat/threads — create a new conversation thread */
chat.post("/threads", async (c) => {
  const body = StartThreadSchema.parse(await c.req.json());

  const { data, error } = await db
    .from("chat_threads")
    .insert({ athlete_id: body.athleteId })
    .select("id")
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ threadId: data.id });
});

/** POST /chat/threads/:threadId/messages — send a message (streams SSE) */
chat.post("/threads/:threadId/messages", async (c) => {
  const threadId = c.req.param("threadId");
  const body = MessageSchema.parse(await c.req.json());

  // Fetch thread + athlete profile
  const { data: thread, error: threadErr } = await db
    .from("chat_threads")
    .select("athlete_id")
    .eq("id", threadId)
    .single();

  if (threadErr || !thread) return c.json({ error: "Thread not found" }, 404);

  const { data: profile } = await db
    .from("athlete_profiles")
    .select("name, goals, coaching_notes")
    .eq("athlete_id", thread.athlete_id as string)
    .single();

  return streamSSE(c, async (stream) => {
    try {
      await runChatAgentStreaming(
        {
          athleteId: thread.athlete_id as string,
          athleteName: (profile?.name as string) ?? "Athlete",
          athleteGoals: (profile?.goals as string) ?? "",
          coachingNotes: (profile?.coaching_notes as string | null) ?? null,
          threadId,
          userMessage: body.message,
        },
        async (chunk) => {
          await stream.writeSSE({
            data: JSON.stringify({ type: "chunk", text: chunk }),
          });
        },
        async (text) => {
          await stream.writeSSE({
            data: JSON.stringify({ type: "status", text }),
          });
        },
      );
      await stream.writeSSE({ data: JSON.stringify({ type: "done" }) });
    } catch (err) {
      await stream.writeSSE({
        data: JSON.stringify({ type: "error", message: String(err) }),
      });
    }
  });
});

/** GET /chat/threads/:threadId/messages — get thread history */
chat.get("/threads/:threadId/messages", async (c) => {
  const threadId = c.req.param("threadId");
  const { data, error } = await db
    .from("chat_messages")
    .select("id, role, content, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ messages: data });
});

export default chat;
