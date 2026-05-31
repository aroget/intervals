/**
 * Model-agnostic LLM adapter.
 *
 * Configured entirely via environment variables — no provider is hardcoded.
 * Works with any OpenAI-compatible API endpoint.
 *
 * Environment variables:
 *   LLM_BASE_URL  - API base URL (default: OpenAI). Examples:
 *                     http://localhost:11434/v1   (Ollama)
 *                     http://localhost:1234/v1    (LM Studio)
 *                     https://openrouter.ai/api/v1
 *                     https://api.together.xyz/v1
 *   LLM_API_KEY   - API key (required for hosted providers)
 *   LLM_MODEL     - Model name (default: gpt-4o-mini)
 *   LLM_EMBED_MODEL - Embedding model (default: text-embedding-3-small)
 */

import OpenAI from "openai";
import type { z } from "zod";
import type {
  AgentTool,
  ChatOptions,
  Message,
  StructuredOptions,
} from "./types.js";

const MAX_RETRIES = 3;
const MAX_TOOL_ROUNDS = 10;

function createClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.LLM_API_KEY ?? "no-key",
    baseURL: process.env.LLM_BASE_URL, // undefined falls back to OpenAI default
  });
}

function getModel(): string {
  return process.env.LLM_MODEL ?? "gpt-4o-mini";
}

function getEmbedModel(): string {
  return process.env.LLM_EMBED_MODEL ?? "text-embedding-3-small";
}

/**
 * Single-turn chat. Returns the assistant text response.
 */
export async function chat(
  messages: Message[],
  options: ChatOptions = {},
): Promise<string> {
  const client = createClient();
  const response = await client.chat.completions.create({
    model: getModel(),
    messages,
    temperature: options.temperature ?? 0.3,
    max_tokens: options.maxTokens,
  });
  return response.choices[0]?.message?.content ?? "";
}

/**
 * Chat with structured output. Validates the response against a Zod schema.
 * Retries up to MAX_RETRIES times, feeding validation errors back to the model.
 */
export async function structured<T>(
  messages: Message[],
  schema: z.ZodType<T>,
  options: StructuredOptions = {},
): Promise<T> {
  const jsonInstruction =
    "\n\nIMPORTANT: Respond with a single valid JSON object only. No markdown fences, no explanations, no text outside the JSON.";

  const history: Message[] = messages.map((m, i) =>
    i === 0 && m.role === "system"
      ? { ...m, content: (m.content as string) + jsonInstruction }
      : m,
  );

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const raw = await chat(history, { ...options, temperature: 0.1 });

    try {
      const parsed = JSON.parse(raw.trim());
      return schema.parse(parsed);
    } catch (err) {
      if (attempt === MAX_RETRIES) {
        throw new Error(
          `Structured output failed after ${MAX_RETRIES} attempts. Last error: ${String(err)}\nLast response: ${raw}`,
        );
      }
      history.push(
        { role: "assistant", content: raw },
        {
          role: "user",
          content: `Your response failed validation: ${String(err)}. Fix the JSON and respond again with only the corrected JSON object.`,
        },
      );
    }
  }

  throw new Error("Unreachable");
}

/**
 * Agentic loop: runs the model repeatedly, executing tool calls until the
 * model produces a final text response (finish_reason === 'stop').
 */
export async function runWithTools(
  messages: Message[],
  tools: AgentTool[],
  options: ChatOptions = {},
): Promise<string> {
  const client = createClient();

  const openaiTools = tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parametersJsonSchema,
    },
  }));

  const history: Message[] = [...messages];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let response;
    try {
      response = await client.chat.completions.create({
        model: getModel(),
        messages: history,
        tools: openaiTools,
        tool_choice: "auto",
        parallel_tool_calls: true,
        temperature: options.temperature ?? 0.3,
        stream: false,
        ...(options.maxTokens !== undefined
          ? { max_tokens: options.maxTokens }
          : {}),
      });
    } catch (err) {
      throw err;
    }

    const choice = response.choices[0];
    const assistantMsg = choice.message;

    if (choice.finish_reason === "stop" || !assistantMsg.tool_calls?.length) {
      return assistantMsg.content ?? "";
    }

    // Append assistant message with tool_calls
    history.push(assistantMsg as Message);

    // Execute all tool calls in parallel — the model may request several at once
    // when parallel_tool_calls is enabled.
    const fnCalls = assistantMsg.tool_calls.filter(
      (
        tc,
      ): tc is typeof tc & {
        type: "function";
        function: { name: string; arguments: string };
      } => tc.type === "function",
    );
    const toolResults = await Promise.all(
      fnCalls.map(async (toolCall) => {
        const tool = tools.find((t) => t.name === toolCall.function.name);
        let content: string;
        if (!tool) {
          content = JSON.stringify({
            error: `Unknown tool: ${toolCall.function.name}`,
          });
        } else {
          try {
            const args = JSON.parse(toolCall.function.arguments) as Record<
              string,
              unknown
            >;
            const result = await tool.execute(args as never);
            content = JSON.stringify(result);
          } catch (err) {
            content = JSON.stringify({ error: String(err) });
          }
        }
        return { tool_call_id: toolCall.id, content };
      }),
    );

    for (const result of toolResults) {
      history.push({ role: "tool", ...result });
    }
  }

  // If we hit max rounds, return whatever the last assistant message said
  const last = [...history].reverse().find((m) => m.role === "assistant");
  return (last as { content?: string })?.content ?? "";
}

/**
 * Streaming variant of runWithTools.
 * Tool-calling rounds run non-streaming (fast); the final text generation
 * streams tokens via the `onChunk` callback so the client sees output
 * progressively instead of waiting for the full response.
/**
 * Streaming variant of runWithTools.
 *
 * - Tool-calling rounds run non-streaming (detecting tool calls from a stream
 *   is complex; the round-trips are short anyway).
 * - The FINAL text response is emitted token-by-token via `onChunk` so the
 *   client starts seeing output as soon as tool calls are done.
 * - `onStatus` fires before each batch of tool calls with a human-readable
 *   label ("Checking your workouts…") — use this to show thinking progress.
 *
 * Returns the complete assembled reply string.
 */

const TOOL_LABELS: Record<string, string> = {
  getWellnessWindow: "Checking your wellness data…",
  getWorkoutHistory: "Looking at your workout history…",
  getDailyAnalyses: "Reviewing your recovery analyses…",
  getPrescribedWorkouts: "Checking your workout schedule…",
  getCyclePosition: "Checking your training cycle…",
  getAthleteProfile: "Loading your athlete profile…",
  searchMemory: "Searching training memory…",
  swapWorkouts: "Swapping workouts…",
  regenerateWorkout: "Regenerating workout…",
  replanWeek: "Replanning the week…",
};

export async function runWithToolsStreaming(
  messages: Message[],
  tools: AgentTool[],
  onChunk: (text: string) => void,
  onStatus: (text: string) => void = () => {},
  options: ChatOptions = {},
): Promise<string> {
  const client = createClient();

  const openaiTools = tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parametersJsonSchema,
    },
  }));

  const history: Message[] = [...messages];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.chat.completions.create({
      model: getModel(),
      messages: history,
      tools: openaiTools,
      tool_choice: "auto",
      parallel_tool_calls: true,
      temperature: options.temperature ?? 0.3,
      stream: false,
    });

    const choice = response.choices[0];
    const assistantMsg = choice.message;

    // If no tool calls, we should have the final text response - stream it
    if (!assistantMsg.tool_calls?.length) {
      const text = assistantMsg.content ?? "";
      if (text) {
        onChunk(text);
        return text;
      }

      break;
    }

    // Tool-calling round — emit status then execute in parallel
    history.push(assistantMsg as Message);

    const fnCalls = assistantMsg.tool_calls.filter(
      (
        tc,
      ): tc is typeof tc & {
        type: "function";
        function: { name: string; arguments: string };
      } => tc.type === "function",
    );

    // Show a human-readable status for each tool about to run (one event per unique label)
    const labels = [
      ...new Set(
        fnCalls.map(
          (tc) =>
            TOOL_LABELS[tc.function.name] ?? `Running ${tc.function.name}…`,
        ),
      ),
    ];
    for (const label of labels) onStatus(label);

    const toolResults = await Promise.all(
      fnCalls.map(async (toolCall) => {
        const tool = tools.find((t) => t.name === toolCall.function.name);
        let content: string;
        if (!tool) {
          content = JSON.stringify({
            error: `Unknown tool: ${toolCall.function.name}`,
          });
        } else {
          try {
            const args = JSON.parse(toolCall.function.arguments) as Record<
              string,
              unknown
            >;
            const result = await tool.execute(args as never);
            content = JSON.stringify(result);
          } catch (err) {
            content = JSON.stringify({ error: String(err) });
          }
        }
        return { tool_call_id: toolCall.id, content };
      }),
    );

    for (const result of toolResults) {
      history.push({ role: "tool", ...result });
    }

    console.log(
      `[runWithToolsStreaming] Added ${toolResults.length} tool results to history, new length: ${history.length}`,
    );

    // After adding tool results, we MUST continue the loop to get the model's response
    // to those results. Do not break here - let the loop continue naturally.
  }

  // If we exit the loop (hit MAX_TOOL_ROUNDS), make a final streaming call
  // to get a text response based on all the tool results.
  // IMPORTANT: Don't pass tools at all - this forces the model to generate text.
  console.log(
    `[runWithToolsStreaming] Exited loop, making final streaming call. History length: ${history.length}`,
  );

  try {
    const stream = await client.chat.completions.create({
      model: getModel(),
      messages: history,
      // No tools parameter at all - forces text generation
      temperature: options.temperature ?? 0.3,
      stream: true,
    });

    let fullText = "";
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (delta) {
        fullText += delta;
        onChunk(delta);
      }
    }

    console.log(
      `[runWithToolsStreaming] Final streaming complete, generated ${fullText.length} characters`,
    );

    if (!fullText) {
      console.error(
        "[runWithToolsStreaming] No text generated in final call. History length:",
        history.length,
      );
      return "I apologize, but I wasn't able to generate a response. Please try again.";
    }

    return fullText;
  } catch (err) {
    console.error(
      "[runWithToolsStreaming] Error in final streaming call:",
      err,
    );
    throw err;
  }
}

/**
 * Embed text into a vector for semantic memory storage/retrieval.
 */
export async function embed(text: string): Promise<number[]> {
  const client = createClient();
  const response = await client.embeddings.create({
    model: getEmbedModel(),
    input: text,
  });
  return response.data[0].embedding;
}
