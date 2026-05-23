import { embed } from "../agents/llm/adapter.js";
import { db } from "../db/client.js";

/**
 * Embeds text and stores it in agent_memories for future semantic retrieval.
 */
export async function storeMemory(params: {
  athleteId: string;
  type: "workout" | "analysis" | "chat_summary" | "note";
  content: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const embedding = await embed(params.content);
  const { error } = await db.from("agent_memories").insert({
    athlete_id: params.athleteId,
    memory_type: params.type,
    content: params.content,
    embedding,
    metadata: params.metadata ?? {},
  });
  if (error) throw new Error(`Failed to store memory: ${error.message}`);
}
