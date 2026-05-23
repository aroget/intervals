import { db } from "../../db/client.js";
import { embed } from "../llm/adapter.js";
import type { AgentTool } from "../llm/types.js";

interface MemoryResult {
  id: string;
  memoryType: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
  createdAt: string;
}

export const searchMemory: AgentTool<
  { athleteId: string; query: string; limit?: number },
  MemoryResult[]
> = {
  name: "searchMemory",
  description:
    'Semantic search over the athlete\'s historical data: past workout summaries, wellness notes, agent analyses, and chat summaries. Use this to answer questions like "what was my last long run?" or "how has my HRV trended this month?"',
  parametersJsonSchema: {
    type: "object",
    properties: {
      athleteId: { type: "string" },
      query: { type: "string", description: "Natural language query" },
      limit: {
        type: "number",
        description: "Max results to return (default 5)",
      },
    },
    required: ["athleteId", "query"],
  },
  async execute({ athleteId, query, limit = 5 }) {
    const embedding = await embed(query);

    const { data, error } = await db.rpc("match_memories", {
      p_athlete_id: athleteId,
      p_embedding: embedding,
      p_limit: Math.min(limit, 20),
    });

    if (error) throw new Error(`Memory search failed: ${error.message}`);

    return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: row.id as string,
      memoryType: row.memory_type as string,
      content: row.content as string,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      similarity: row.similarity as number,
      createdAt: row.created_at as string,
    }));
  },
};
