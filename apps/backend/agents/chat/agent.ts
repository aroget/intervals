import {
  runWithTools,
  runWithToolsStreaming,
  embed,
  chat,
} from "../llm/adapter.js";
import { buildChatSystemPrompt } from "./prompt.js";
import { getWellnessWindow } from "../tools/getWellnessWindow.js";
import { getWorkoutHistory } from "../tools/getWorkoutHistory.js";
import { getAthleteProfile } from "../tools/getAthleteProfile.js";
import { searchMemory } from "../tools/searchMemory.js";
import { getCyclePosition_tool } from "../tools/getCyclePosition.js";
import { getDailyAnalyses } from "../tools/getDailyAnalyses.js";
import { getPrescribedWorkouts } from "../tools/getPrescribedWorkouts.js";
import { swapWorkouts } from "../tools/swapWorkouts.js";
import { regenerateWorkout } from "../tools/regenerateWorkout.js";
import { replanWeek } from "../tools/replanWeek.js";
import { db } from "../../db/client.js";
import type { AgentTool, Message } from "../llm/types.js";

/** How many messages in a thread before we summarize and store it. */
const SUMMARIZE_THRESHOLD = 20;

/**
 * Fetches recent cross-session context to inject into the system prompt:
 * - Last 5 daily analyses (for recovery trend awareness)
 * - Top 3 semantically relevant memories for the current message
 */
async function buildCrossSessionContext(
  athleteId: string,
  userMessage: string,
): Promise<string> {
  const [analysesResult, memoriesResult] = await Promise.allSettled([
    db
      .from("daily_analyses")
      .select(
        "analysis_date, readiness_score, hrv_trend, block_effectiveness, agent_output",
      )
      .eq("athlete_id", athleteId)
      .order("analysis_date", { ascending: false })
      .limit(5),
    (async () => {
      const embedding = await embed(userMessage);
      return db.rpc("match_memories", {
        p_athlete_id: athleteId,
        p_embedding: embedding,
        p_limit: 3,
      });
    })(),
  ]);

  const lines: string[] = [];

  if (
    analysesResult.status === "fulfilled" &&
    analysesResult.value.data?.length
  ) {
    const latestAnalysis = analysesResult.value.data[0] as Record<
      string,
      unknown
    >;
    const blockEff = latestAnalysis.block_effectiveness as number | null;

    if (blockEff != null) {
      lines.push(
        `CURRENT 4-WEEK BLOCK EFFECTIVENESS: ${Math.round(blockEff)}/100`,
      );
      const interpretation =
        blockEff >= 75
          ? "highly effective"
          : blockEff >= 50
            ? "moderately effective"
            : "underperforming";
      lines.push(
        `  (${interpretation} — measures CTL gains + compliance - overtraining)`,
      );
      lines.push("");
    }

    lines.push("Recent recovery analyses:");
    for (const row of analysesResult.value.data as Record<string, unknown>[]) {
      const out = (row.agent_output as Record<string, unknown>) ?? {};
      lines.push(
        `  ${row.analysis_date}: readiness ${row.readiness_score}/100 (${out.readiness}) — HRV ${row.hrv_trend}`,
      );
    }
  }

  if (
    memoriesResult.status === "fulfilled" &&
    memoriesResult.value.data?.length
  ) {
    lines.push("\nRelevant past notes:");
    for (const row of memoriesResult.value.data as Record<string, unknown>[]) {
      lines.push(`  [${row.memory_type}] ${row.content}`);
    }
  }

  return lines.join("\n");
}

/**
 * Pre-fetches the current week plan and recent activities to inject directly
 * into the system prompt, saving 2 guaranteed tool-call round trips on every
 * message.
 */
async function buildScheduleContext(athleteId: string): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date();
  in7.setDate(in7.getDate() + 7);
  const in7Str = in7.toISOString().slice(0, 10);

  const since14 = new Date();
  since14.setDate(since14.getDate() - 14);
  const since14Str = since14.toISOString().slice(0, 10);

  const [prescribedRes, activitiesRes] = await Promise.allSettled([
    db
      .from("prescribed_workouts")
      .select("workout_date, sport, duration_min, intensity")
      .eq("athlete_id", athleteId)
      .gte("workout_date", today)
      .lte("workout_date", in7Str)
      .order("workout_date", { ascending: true }),
    db
      .from("activities")
      .select(
        "activity_date, sport, name, duration_secs, tss, rpe, athlete_comments",
      )
      .eq("athlete_id", athleteId)
      .gte("activity_date", since14Str)
      .order("activity_date", { ascending: false })
      .limit(14),
  ]);

  const lines: string[] = [];

  if (
    prescribedRes.status === "fulfilled" &&
    prescribedRes.value.data?.length
  ) {
    lines.push("PRESCRIBED WORKOUTS (next 7 days):");
    for (const w of prescribedRes.value.data as Record<string, unknown>[]) {
      lines.push(
        `  ${w.workout_date}: ${w.duration_min}min ${w.sport} (${w.intensity})`,
      );
    }
  }

  if (
    activitiesRes.status === "fulfilled" &&
    activitiesRes.value.data?.length
  ) {
    lines.push("\nRECENT ACTIVITIES (last 14 days):");
    for (const a of activitiesRes.value.data as Record<string, unknown>[]) {
      const dur = a.duration_secs
        ? `${Math.round((a.duration_secs as number) / 60)}min`
        : "";
      const tss = a.tss ? ` TSS ${a.tss}` : "";
      const rpe = a.rpe ? ` RPE ${a.rpe}` : "";
      lines.push(
        `  ${a.activity_date}: ${a.sport}${a.name ? ` "${a.name}"` : ""} ${dur}${tss}${rpe}`,
      );
    }
  }

  return lines.join("\n");
}

/**
 * Summarizes a thread that has grown long and stores it in agent_memories
 * so future sessions can find it via semantic search.
 */
async function summarizeThreadIfNeeded(
  threadId: string,
  athleteId: string,
  messageCount: number,
): Promise<void> {
  if (messageCount < SUMMARIZE_THRESHOLD) return;

  // Only summarize if we haven't already stored a summary for this thread
  const { data: existing } = await db
    .from("agent_memories")
    .select("id")
    .eq("athlete_id", athleteId)
    .eq("metadata->>'thread_id'", threadId)
    .limit(1)
    .maybeSingle();

  if (existing) return;

  const { data: messages } = await db
    .from("chat_messages")
    .select("role, content")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (!messages?.length) return;

  const transcript = (messages as { role: string; content: string }[])
    .map((m) => `${m.role === "user" ? "Athlete" : "Coach"}: ${m.content}`)
    .join("\n");

  const summary = await chat(
    [
      {
        role: "system",
        content:
          "You summarize coaching conversations. Extract key facts: what the athlete reported, what the coach advised, any decisions made, notable trends discussed. Be concise (3-6 sentences). Output plain text only.",
      },
      {
        role: "user",
        content: `Summarize this coaching conversation:\n\n${transcript}`,
      },
    ],
    { temperature: 0.2 },
  );

  const embedding = await embed(summary);
  await db.from("agent_memories").insert({
    athlete_id: athleteId,
    memory_type: "chat_summary",
    content: summary,
    embedding,
    metadata: { thread_id: threadId, message_count: messageCount },
  });
}

/**
 * Chat Agent — conversational coach with tool access.
 * - Maintains per-thread message history
 * - Injects cross-session context (recent analyses + relevant past memories)
 * - Auto-summarizes long threads into semantic memory
 */
export async function runChatAgent(params: {
  athleteId: string;
  athleteName: string;
  athleteGoals: string;
  threadId: string;
  userMessage: string;
}): Promise<string> {
  const { athleteId, athleteName, athleteGoals, threadId, userMessage } =
    params;

  // Load current thread history + cross-session context + schedule context in parallel
  const [{ data: history }, crossSessionContext, scheduleContext] =
    await Promise.all([
      db
        .from("chat_messages")
        .select("role, content")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true })
        .limit(40),
      buildCrossSessionContext(athleteId, userMessage),
      buildScheduleContext(athleteId),
    ]);

  const messages: Message[] = [
    {
      role: "system",
      content: buildChatSystemPrompt(
        athleteName,
        athleteGoals,
        crossSessionContext,
        scheduleContext,
      ),
    },
    ...(
      (history ?? []) as { role: "user" | "assistant"; content: string }[]
    ).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: userMessage },
  ];

  const tools = [
    bindAthleteId(getWellnessWindow, athleteId),
    bindAthleteId(getWorkoutHistory, athleteId),
    bindAthleteId(getAthleteProfile, athleteId),
    bindAthleteId(searchMemory, athleteId),
    bindAthleteId(getCyclePosition_tool, athleteId),
    bindAthleteId(getDailyAnalyses, athleteId),
    bindAthleteId(getPrescribedWorkouts, athleteId),
    bindAthleteId(swapWorkouts, athleteId),
    bindAthleteId(regenerateWorkout, athleteId),
    bindAthleteId(replanWeek, athleteId),
  ] as AgentTool[];

  const reply = await runWithTools(messages, tools, { temperature: 0.6 });

  // Persist both turns
  await db.from("chat_messages").insert([
    { thread_id: threadId, role: "user", content: userMessage },
    { thread_id: threadId, role: "assistant", content: reply },
  ]);

  await db
    .from("chat_threads")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", threadId);

  // Summarize thread if it's grown long (fire-and-forget)
  const messageCount = (history?.length ?? 0) + 2;
  summarizeThreadIfNeeded(threadId, athleteId, messageCount).catch(
    console.error,
  );

  return reply;
}

/**
 * Streaming variant — identical to runChatAgent but streams the final
 * generation token-by-token via `onChunk`. Returns the full reply string.
 * Use this from the API route to pipe SSE to the client.
 */
export async function runChatAgentStreaming(
  params: {
    athleteId: string;
    athleteName: string;
    athleteGoals: string;
    threadId: string;
    userMessage: string;
  },
  onChunk: (text: string) => void,
  onStatus: (text: string) => void = () => {},
): Promise<string> {
  const { athleteId, athleteName, athleteGoals, threadId, userMessage } =
    params;

  const [{ data: history }, crossSessionContext, scheduleContext] =
    await Promise.all([
      db
        .from("chat_messages")
        .select("role, content")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true })
        .limit(40),
      buildCrossSessionContext(athleteId, userMessage),
      buildScheduleContext(athleteId),
    ]);

  const messages: Message[] = [
    {
      role: "system",
      content: buildChatSystemPrompt(
        athleteName,
        athleteGoals,
        crossSessionContext,
        scheduleContext,
      ),
    },
    ...(
      (history ?? []) as { role: "user" | "assistant"; content: string }[]
    ).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: userMessage },
  ];

  const tools = [
    bindAthleteId(getWellnessWindow, athleteId),
    bindAthleteId(getWorkoutHistory, athleteId),
    bindAthleteId(getAthleteProfile, athleteId),
    bindAthleteId(searchMemory, athleteId),
    bindAthleteId(getCyclePosition_tool, athleteId),
    bindAthleteId(getDailyAnalyses, athleteId),
    bindAthleteId(getPrescribedWorkouts, athleteId),
    bindAthleteId(swapWorkouts, athleteId),
    bindAthleteId(regenerateWorkout, athleteId),
    bindAthleteId(replanWeek, athleteId),
  ] as AgentTool[];

  const reply = await runWithToolsStreaming(
    messages,
    tools,
    onChunk,
    onStatus,
    {
      temperature: 0.6,
    },
  );

  await db.from("chat_messages").insert([
    { thread_id: threadId, role: "user", content: userMessage },
    { thread_id: threadId, role: "assistant", content: reply },
  ]);

  await db
    .from("chat_threads")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", threadId);

  const messageCount = (history?.length ?? 0) + 2;
  summarizeThreadIfNeeded(threadId, athleteId, messageCount).catch(
    console.error,
  );

  return reply;
}

function bindAthleteId<T extends Record<string, unknown>, R>(
  tool: {
    name: string;
    description: string;
    parametersJsonSchema: Record<string, unknown>;
    execute: (p: T) => Promise<R>;
  },
  athleteId: string,
) {
  // Strip athleteId from the schema — it's pre-filled and the LLM shouldn't see it
  const { properties, required, ...rest } = tool.parametersJsonSchema as {
    properties?: Record<string, unknown>;
    required?: string[];
    [k: string]: unknown;
  };
  const { athleteId: _removed, ...publicProperties } = properties ?? {};
  const publicRequired = (required ?? []).filter((k) => k !== "athleteId");

  return {
    ...tool,
    parametersJsonSchema: {
      ...rest,
      properties: publicProperties,
      ...(publicRequired.length ? { required: publicRequired } : {}),
    },
    execute: (params: Omit<T, "athleteId">) =>
      tool.execute({ ...params, athleteId } as unknown as T),
  };
}
