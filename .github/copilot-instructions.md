# Intervals Agent Ecosystem — Project Guidelines

## Architecture

Multi-agent fitness coaching system built on Intervals.icu data with daily adaptation via GitHub Actions cron.

**Agent flow**: `Intervals.icu sync → Processors (no LLM) → Recovery Agent → Coach Agent → Semantic memory`

**Automation schedule**:

- **Daily 6am UTC**: Data sync (`pnpm sync`) — pulls latest from Intervals.icu
- **Daily 6:30am UTC**: Daily analysis (`pnpm analyze`) — prescribes today's workout with fresh recovery data

This architecture provides **daily adaptation**: today's workout always reflects current recovery status. No future prescriptions are generated - the system focuses on adapting to the athlete's actual state each morning.

Key directories:

- `apps/backend/agents/llm/` — model-agnostic adapter (all LLM calls go through here)
- `apps/backend/agents/recovery/` — Recovery Analysis Agent
- `apps/backend/agents/coach/` — Workout Coach Agent
- `apps/backend/agents/chat/` — Conversational Coach Agent
- `apps/backend/agents/tools/` — shared DB-querying tools for agents
- `apps/backend/agents/daily.ts` — daily orchestrator (entry: `pnpm analyze`)
- `apps/backend/data/processors/` — deterministic metric computation (no LLM)
- `apps/backend/data/sync/pipeline.ts` — Intervals.icu → Supabase sync (entry: `pnpm sync`)
- `apps/backend/data/intervals/mapper.ts` — centralized data transformation (Intervals.icu ↔ DB)
- `apps/backend/db/schema.sql` — Supabase schema including pgvector for semantic memory
- `apps/backend/api/` — Hono REST API
- `apps/frontend/` — Next.js 16 App Router UI

## Critical Rules

### LLMs never do arithmetic

All numeric computations (HRV trend, ATL/CTL/TSB, readiness score, cycle position, max hours today) happen in `apps/backend/data/processors/` using pure TypeScript. Agents receive pre-computed facts. Never move calculations into prompts.

### Model-agnostic: all LLM calls go through the adapter

`apps/backend/agents/llm/adapter.ts` is the only file that imports from `openai`. All agents use `chat()`, `structured()`, `runWithTools()`, or `embed()` from this module. Never import OpenAI directly in agent files.

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

The chat agent never has data dumped into its context. It uses named tools (`getWellnessWindow`, `getWorkoutHistory`, `getDailyAnalyses`, `getPrescribedWorkouts`, `searchMemory`, etc.) that query Supabase. All tools are defined in `apps/backend/agents/tools/` with a JSON Schema for parameters.

The chat agent is **fitness-only** — it politely redirects off-topic questions. It maintains conversation history within a thread (last 40 messages from DB) and cross-session continuity via:

1. **Programmatic context injection**: the last 5 recovery analyses + top 3 semantically relevant memories are injected into the system prompt on every turn.
2. **Thread summarization**: when a thread reaches 20 messages, it is summarized by the LLM and stored in `agent_memories` so future sessions can find it via `searchMemory`.

### Idempotent daily pipeline

`runDailyAnalysis()` checks if today's record already exists before running. Do not remove this guard.

### 4-week training cycle

Week 1 = base, Week 2 = build, Week 3 = peak, Week 4 = recovery. Logic is in `apps/backend/data/processors/cycleTracker.ts`. Week 4 is always a recovery week — coach agent must reduce volume 40-50% and avoid hard sessions.

## Data Integrity & Type Safety

### Single source of truth for data mapping

**`apps/backend/data/intervals/mapper.ts`** is the ONLY place where Intervals.icu API data is transformed to/from database rows.

**Functions:**

- `normalizeSport(type)` — canonical sport name normalization (ride→bike, virtualrun→run, etc.)
- `toActivityRow(activity, athleteId)` — Intervals.icu API → DB row (snake_case)
- `fromActivityRow(row)` — DB row (snake_case) → Activity type (camelCase)
- `toWellnessRow(entry, athleteId)` — Intervals.icu wellness → DB row
- `fromWellnessRow(apps/frontend/` — a Next.js 16 App Router project with Tailwind CSS.

- `apps/frontend/app/page.tsx` — landing page
- `apps/frontend/app/dashboard/page.tsx` — training dashboard with 4-week block + compliance metrics
- `apps/frontend/app/chat/page.tsx` — real-time chat UI with the coach agent
- `apps/frontend/components/BlockOverview.tsx` — 4-week calendar with workouts/activities/deviations
- `apps/frontend/components/ComplianceMetrics.tsx` — effectiveness score, compliance tracking, fitness trajectory
- `apps/hen adding new fields, update BOTH `toRow`and`fromRow` functions
- Don't hardcode field values to `null` — map them from the DB row
  apps/backend/db/schema.sql`.

Run the SQL in the Supabase SQL editor to initialise. Requires the `vector` extension enabled (Dashboard → Database → Extensions).

Semantic memory is stored in `agent_memories` with a 1536-dimension vector column. If switching to an embedding model with different dimensions, update the `vector(N)` in `schema.sql` and `LLM_EMBED_MODEL` in `.env`.

## Adding a New Provider

1. Set `LLM_BASE_URL` to the provider's OpenAI-compatible endpoint
2. Set `LLM_API_KEY` and `LLM_MODEL`
3. No code changes required

If the provider is NOT OpenAI-compatible, implement a new adapter in `apps/backend
**Example violation (WRONG):**

```typescript
if (metrics.rhrDeviation > 5) { ... }  // rhrDeviation not in ComputedMetrics type
```

**Correct approach:**

```typescript
// Either: remove the check, OR
// 1. Add rhrDeviation to ComputedMetrics in types.ts
// 2. Calculate it in readiness.ts: rhrDeviation = rhr - rhrSevenDayAvg
// 3. THEN use it in deviationChecker.ts
```

### Static imports, not dynamic

Use static imports at the top of files. Dynamic imports (`await import(...)`) should only be used for:

- Lazy-loading heavy dependencies
- Avoiding circular dependencies
- Code splitting in frontend

**WRONG:**

```typescript
// Inside function body
const { getTrainingCapacity } =
  await import("../data/processors/workoutAdapter.js");
```

**CORRECT:**

```typescript
// Top of file
import { getTrainingCapacity } from "../data/processors/workoutAdapter.js";
```

### Database queries should use loaders

**Preferred:** Use functions from `apps/backend/db/loaders.ts`:

- `loadProfile(athleteId)` — athlete profile with cycle info
- `loadWellness(athleteId, days)` — wellness logs (camelCase)
- `loadActivities(athleteId, days, beforeDate?)` — activities (camelCase)

**Why:** Loaders handle snake_case → camelCase transformation automatically via mapper.ts.

**Exception:** API routes that return data directly to frontend MAY query DB directly if they're returning raw snake_case data to the UI. Document this decision in code comments.

## Code Quality Checklist

Before marking any feature complete:

1. **Run TypeScript compiler** — `pnpm build` in `apps/backend/`
2. **Check for errors** — No compile errors, no type mismatches
3. **Verify no duplicate logic** — Search for similar functions before creating new ones
4. **Use centralized utilities** — Check if mapper.ts, loaders.ts, or processors already provide what you need
5. **Test the feature** — Run `pnpm analyze` or `pnpm dev` and verify behavior
6. **Update types** — If adding new computed metrics, add them to `ComputedMetrics` in types.ts

### When adding new features

1. **Identify the layer:**
   - **Processor** (pure logic, no DB, no LLM) → `data/processors/`
   - **Agent** (uses LLM) → `agents/`
   - **API endpoint** → `api/routes/`
   - **Data transformation** → `data/intervals/mapper.ts`

2. **Check existing patterns:**
   - Look at similar features first
   - Use same patterns (e.g., all processors return plain objects, agents use Zod schemas)

3. **Don't break the plan-driven architecture:**
   - Recovery analysis suggests adaptations, never auto-applies
   - Deviation checker only flags MAJOR issues (20+ readiness points below expected)
   - Week 2-3 fatigue is NORMAL and expected
   - Only recovery week should feel easy

### 4-week training cycle

Week 1 = base, Week 2 = build, Week 3 = peak, Week 4 = recovery. Logic is in `apps/backend/data/processors/cycleTracker.ts`. Week 4 is always a recovery week — coach agent must reduce volume 40-50% and avoid hard sessions.

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

## Conventions using mapper.ts

- Agent output types are exported from `schema.ts` as both the Zod schema and the inferred TS type
- All files use ESM (`import/export`), `.js` extension on relative imports (required for Node ESM)
- `dotenv/config` is imported at entry points only (`apps/backend/index.ts`, `daily.ts`, `pipeline.ts`)
- Use static imports at file top, not dynamic imports inside functions (unless for lazy loading)
- Always run `pnpm build` in apps/backend/ before considering a feature completetype
- All files use ESM (`import/export`), `.js` extension on relative imports (required for Node ESM)
- `dotenv/config` is imported at entry points only (`src/index.ts`, `daily.ts`, `pipeline.ts`)
