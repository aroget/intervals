# Intervals Agent Ecosystem — Project Guidelines

## Architecture

Multi-agent fitness coaching system built on Intervals.icu data. Two core agents run daily via GitHub Actions cron, plus a conversational chat agent accessible via REST API.

**Agent flow**: `Intervals.icu sync → Processors (no LLM) → Recovery Agent → Coach Agent → Semantic memory`

Key directories:

- `src/agents/llm/` — model-agnostic adapter (all LLM calls go through here)
- `src/agents/recovery/` — Recovery Analysis Agent
- `src/agents/coach/` — Workout Coach Agent
- `src/agents/chat/` — Conversational Coach Agent
- `src/agents/tools/` — shared DB-querying tools for agents
- `src/agents/daily.ts` — daily orchestrator (entry: `pnpm analyze`)
- `src/data/processors/` — deterministic metric computation (no LLM)
- `src/data/sync/pipeline.ts` — Intervals.icu → Supabase sync (entry: `pnpm sync`)
- `src/db/schema.sql` — Supabase schema including pgvector for semantic memory
- `src/api/` — Hono REST API

## Critical Rules

### LLMs never do arithmetic

All numeric computations (HRV trend, ATL/CTL/TSB, readiness score, cycle position, max hours today) happen in `src/data/processors/` using pure TypeScript. Agents receive pre-computed facts. Never move calculations into prompts.

### Model-agnostic: all LLM calls go through the adapter

`src/agents/llm/adapter.ts` is the only file that imports from `openai`. All agents use `chat()`, `structured()`, `runWithTools()`, or `embed()` from this module. Never import OpenAI directly in agent files.

Provider is set entirely via env vars:

```
LLM_BASE_URL=   # empty = OpenAI, or any OpenAI-compatible base URL
LLM_API_KEY=
LLM_MODEL=
LLM_EMBED_MODEL=
```

### Structured agent outputs are Zod-validated

Every agent that returns structured data uses `structured<T>(messages, ZodSchema)`. Schema lives in `schema.ts` alongside its agent. The adapter retries up to 3 times on parse failure, feeding the error back to the model.

### Tool-calling pattern for the chat agent

The chat agent never has data dumped into its context. It uses named tools (`getWellnessWindow`, `getWorkoutHistory`, `getDailyAnalyses`, `getPrescribedWorkouts`, `searchMemory`, etc.) that query Supabase. All tools are defined in `src/agents/tools/` with a JSON Schema for parameters.

The chat agent is **fitness-only** — it politely redirects off-topic questions. It maintains conversation history within a thread (last 40 messages from DB) and cross-session continuity via:

1. **Programmatic context injection**: the last 5 recovery analyses + top 3 semantically relevant memories are injected into the system prompt on every turn.
2. **Thread summarization**: when a thread reaches 20 messages, it is summarized by the LLM and stored in `agent_memories` so future sessions can find it via `searchMemory`.

### Idempotent daily pipeline

`runDailyAnalysis()` checks if today's record already exists before running. Do not remove this guard.

### 4-week training cycle

Week 1 = base, Week 2 = build, Week 3 = peak, Week 4 = recovery. Logic is in `src/data/processors/cycleTracker.ts`. Week 4 is always a recovery week — coach agent must reduce volume 40-50% and avoid hard sessions.

## Build and Run

```bash
pnpm install
pnpm dev          # start API server with hot reload (port 7000)
pnpm dev:ui       # start Next.js frontend with hot reload (port 7001)
pnpm sync         # manual Intervals.icu data sync
pnpm analyze      # run daily Recovery + Coach agents
pnpm build        # compile API to dist/
```

Frontend lives in `frontend/` — a Next.js 16 App Router project with Tailwind CSS.

- `frontend/app/page.tsx` — landing page
- `frontend/app/dashboard/page.tsx` — today's recovery + prescribed workout
- `frontend/app/chat/page.tsx` — real-time chat UI with the coach agent
- `frontend/.env.local` — `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_ATHLETE_ID`

## Database

Supabase (Postgres + pgvector). Schema: `src/db/schema.sql`.

Run the SQL in the Supabase SQL editor to initialise. Requires the `vector` extension enabled (Dashboard → Database → Extensions).

Semantic memory is stored in `agent_memories` with a 1536-dimension vector column. If switching to an embedding model with different dimensions, update the `vector(N)` in `schema.sql` and `LLM_EMBED_MODEL` in `.env`.

## Adding a New Provider

1. Set `LLM_BASE_URL` to the provider's OpenAI-compatible endpoint
2. Set `LLM_API_KEY` and `LLM_MODEL`
3. No code changes required

If the provider is NOT OpenAI-compatible, implement a new adapter in `src/agents/llm/` that exports the same `chat`, `structured`, `runWithTools`, `embed` functions.

## Conventions

- All DB column names are `snake_case`; TypeScript types are `camelCase` — map at the DB boundary
- Agent output types are exported from `schema.ts` as both the Zod schema and the inferred TS type
- All files use ESM (`import/export`), `.js` extension on relative imports (required for Node ESM)
- `dotenv/config` is imported at entry points only (`src/index.ts`, `daily.ts`, `pipeline.ts`)
