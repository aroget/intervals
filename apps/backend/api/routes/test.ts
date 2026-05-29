/**
 * Test route for benchmarking LLM response speed without tools or context.
 */
import { Hono } from "hono";
import { chat } from "../../agents/llm/adapter.js";

const test = new Hono();

/** POST /test/llm — quick LLM speed test without tools or context */
test.post("/llm", async (c) => {
  const { message } = await c.req.json();

  if (!message || typeof message !== "string") {
    return c.json({ error: "message (string) required" }, 400);
  }

  const startTime = Date.now();

  try {
    const response = await chat([
      {
        role: "system",
        content: "You are a helpful assistant. Respond concisely.",
      },
      {
        role: "user",
        content: message,
      },
    ]);

    const endTime = Date.now();
    const duration = endTime - startTime;

    return c.json({
      response: response,
      timing: {
        duration_ms: duration,
        duration_s: (duration / 1000).toFixed(2),
      },
      model: process.env.LLM_MODEL || "unknown",
    });
  } catch (err) {
    const endTime = Date.now();
    const duration = endTime - startTime;

    console.error("[test/llm] Error:", err);
    return c.json(
      {
        error: err instanceof Error ? err.message : "LLM request failed",
        timing: {
          duration_ms: duration,
          failed_after_s: (duration / 1000).toFixed(2),
        },
      },
      500,
    );
  }
});

export default test;
