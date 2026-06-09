# Intervals Agent Ecosystem — Project Guidelines

## Monorepo Architecture

**Package Manager**: pnpm v10.20.0 with workspace protocol

**Workspace Structure**:

```
apps/
  ├── backend/      → Hono API server + agent orchestration
  └── frontend/     → Next.js 16 App Router UI
packages/
  ├── shared/       → Core types, formatters, validators
  ├── brand/        → Design system & brand guidelines
  ├── constants/    → Business logic constants (sports, intensity, cycles)
  ├── ui/           → Reusable React components
  └── db/           → Database utilities (future)
```

### Tech Stack with Versions

**Frontend** (`apps/frontend/`):

- **Next.js**: 16.2.6 (App Router, React Server Components)
- **React**: 19.2.4 with React DOM 19.2.4
- **TypeScript**: 5.x (strict mode)
- **Tailwind CSS**: v4 (with @tailwindcss/postcss)
- **Data Fetching**: SWR 2.4.1 (`refreshInterval: 0`, `revalidateOnFocus: false`)
- **Charts**: Recharts 3.8.1
- **i18n**: next-intl 4.12.0
- **Theming**: next-themes 0.4.6

**Backend** (`apps/backend/`):

- **Runtime**: Node.js with tsx watch mode
- **Framework**: Hono v4.12.21 (lightweight web framework)
- **Database**: Supabase (@supabase/supabase-js 2.106.0)
- **LLM**: OpenAI SDK 6.38.0 (model-agnostic adapter)
- **Validation**: Zod 4.4.3
- **WebSocket**: ws 8.21.0
- **Type Safety**: TypeScript 5.x ESM (`"type": "module"`)

**Shared Packages**:

- `@intervals/shared` → Zod schemas, type definitions, formatters, validators
- `@intervals/brand` → Brand guidelines, colors (light/dark), design tokens
- `@intervals/constants` → SPORTS metadata, INTENSITY_LEVELS, training cycles
- `@intervals/ui` → Badge, Button, Card, Selector, Spinner components (React 19)

## Architecture Patterns

Multi-agent fitness coaching system built on Intervals.icu data with daily adaptation via GitHub Actions cron.

**Agent flow**: `Intervals.icu sync → Processors (no LLM) → Recovery Agent → Coach Agent → Semantic memory`

**Automation schedule**:

- **Daily 6am UTC**: Data sync (`pnpm sync`) — pulls latest from Intervals.icu
- **Daily 6:30am UTC**: Daily analysis (`pnpm analyze`) — prescribes today's workout with fresh recovery data

This architecture provides **daily adaptation**: today's workout always reflects current recovery status. No future prescriptions are generated - the system focuses on adapting to the athlete's actual state each morning.

### Key Directories

**Backend**:

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
- `apps/backend/db/loaders.ts` — centralized data loaders (use these, not raw queries)
- `apps/backend/utils/dates.ts` — date utilities (`getTodayDate()`, `getDaysAgo()`)
- `apps/backend/utils/http.ts` — HTTP helpers (`getAthleteId()`, `getQueryInt()`)
- `apps/backend/api/` — Hono REST API routes

**Frontend**:

- `apps/frontend/app/` — Next.js 16 App Router pages
- `apps/frontend/app/[locale]/(protected)/` — Authenticated routes (dashboard, analytics, etc.)
- `apps/frontend/components/` — React components (each file = 1 component, <500 lines)
- `apps/frontend/lib/` — Frontend utilities (api.ts, formatters.ts, constants.ts)

## Critical Coding Rules

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

## API Design Patterns

### Composite Processors Pattern

**Problem**: API routes were duplicating logic across 20+ endpoints (1488 lines in analysis.ts alone)

**Solution**: Create composite processors that orchestrate loaders + other processors

**Example**: `blockAnalysis.ts` provides all block-related data through one function with options:

```typescript
const result = await getBlockAnalysis(athleteId, refDate, {
  includeWorkouts: true, // Week-by-week structure with daily workouts
  includeCompliance: true, // Compliance reports
  includeFitness: true, // CTL checkpoints
  includeEffectiveness: true, // Block score + component metrics
  includeZones: true, // Intensity zone distribution
});
```

**Benefits**:

- Block boundaries calculated once
- Activities loaded once, reused across calculations
- Eliminates 600+ lines of duplication
- Routes become thin orchestrators (5-10 lines)

### Thin Route Pattern

Routes should be simple orchestrators that:

1. Extract parameters from request
2. Call composite processor or existing processor
3. Transform result for API contract
4. Return JSON

**Example**:

```typescript
// ❌ BAD: 80 lines of logic in route
analysis.get("/:athleteId/compliance", async (c) => {
  const athleteId = c.req.param("athleteId");

  // Get profile, calculate block boundaries, load workouts,
  // load activities, run calculations, aggregate results...
  // (80 lines of duplicated logic)

  return c.json(results);
});

// ✅ GOOD: 7 lines, logic in processor
analysis.get("/:athleteId/compliance", async (c) => {
  const athleteId = c.req.param("athleteId");
  const refDate = c.req.query("date") ?? getTodayDate();

  const result = await getBlockAnalysis(athleteId, refDate, {
    includeCompliance: true,
  });

  return c.json({
    blockStartDate: result.blockStartDate,
    weeklyReports: result.compliance?.weeklyReports ?? [],
    overallCompliance: result.compliance?.overallCompliance ?? {},
  });
});
```

### Flexible Endpoints with Query Parameters

Instead of creating separate endpoints for variations, use query parameters:

```typescript
// ✅ GOOD: One flexible endpoint
GET /analysis/:athleteId/block?include=workouts,compliance,fitness

// ❌ BAD: Multiple endpoints doing similar things
GET /analysis/:athleteId/block-overview
GET /analysis/:athleteId/compliance
GET /analysis/:athleteId/fitness-trajectory
```

**Implementation**:

```typescript
analysis.get("/:athleteId/block", async (c) => {
  const athleteId = c.req.param("athleteId");
  const include = c.req.query("include")?.split(",") ?? [];

  return c.json(
    await getBlockAnalysis(athleteId, getTodayDate(), {
      includeWorkouts: include.includes("workouts"),
      includeCompliance: include.includes("compliance"),
      includeFitness: include.includes("fitness"),
    }),
  );
});
```

### Where Logic Lives

- **Processors** (`data/processors/`) - pure business logic, no HTTP concerns
- **Loaders** (`db/loaders.ts`) - centralized data fetching with transformation
- **Routes** (`api/routes/`) - thin orchestrators, parameter extraction, response formatting
- **Agents** - use processors + loaders, never duplicate processor logic

## Data Integrity & Type Safety

### Single source of truth for data mapping

**`apps/backend/data/intervals/mapper.ts`** is the ONLY place where Intervals.icu API data is transformed to/from database rows.

**Functions**:

- `normalizeSport(type)` — canonical sport name normalization (ride→bike, virtualrun→run, etc.)
- `toActivityRow(activity, athleteId)` — Intervals.icu API → DB row (snake_case)
- `fromActivityRow(row)` — DB row (snake_case) → Activity type (camelCase)
- `toWellnessRow(entry, athleteId)` — Intervals.icu wellness → DB row
- `fromWellnessRow(row)` — DB row → Wellness type

**Rule**: When adding new fields, update BOTH `toRow` and `fromRow` functions. Don't hardcode field values to `null` — map them from the DB row.

### Use centralized loaders, not raw queries

**Preferred**: Import from `apps/backend/db/loaders.ts`:

- `loadProfile(athleteId)` — athlete profile with cycle info
- `loadWellness(athleteId, days)` — wellness logs (camelCase)
- `loadActivities(athleteId, days, beforeDate?)` — activities (camelCase)

**Why**: Loaders handle snake_case → camelCase transformation automatically via mapper.ts.

**Exception**: API routes that return data directly to frontend MAY query DB directly if returning raw snake_case data to UI. Document this decision in code comments.

### Static imports, not dynamic

Use static imports at the top of files. Dynamic imports (`await import(...)`) should only be used for:

- Lazy-loading heavy dependencies
- Avoiding circular dependencies
- Code splitting in frontend

**WRONG**:

```typescript
// Inside function body
const { calculateReadiness } = await import("../data/processors/readiness.js");
```

**CORRECT**:

```typescript
// Top of file
import { calculateReadiness } from "../data/processors/readiness.js";
```

### Use centralized utilities

**Backend**:

- Date operations → `apps/backend/utils/dates.ts` (`getTodayDate()`, `getDaysAgo()`)
- HTTP helpers → `apps/backend/utils/http.ts` (`getAthleteId()`, `getQueryInt()`)
- Never write `new Date().toISOString().slice(0, 10)` — use `getTodayDate()`
- Never write `c.req.param("athleteId")` — use `getAthleteId(c)`

**Frontend**:

- API config → `apps/frontend/lib/api.ts` (`API_URL`, `ATHLETE_ID`, `fetcher`)
- Formatters → `apps/frontend/lib/formatters.ts` (re-exports from `@intervals/shared`)
- Constants → `apps/frontend/lib/constants.ts` (re-exports from `@intervals/constants`)

## Frontend Component Architecture

### Component File Rules

1. **One component per file** — never define multiple exported components in same file
2. **Max 500 lines** — split larger components into smaller, focused ones
3. **"use client" directive** — all interactive components must have `"use client"` at top
4. **Explicit imports** — import all dependencies, never rely on globals
5. **TypeScript interfaces** — define props with clear interfaces
6. **Remove unused code** — clean up unused interfaces, imports, and functions

### Component Composition Pattern

**Example**: ComplianceMetrics (refactored from 788 → 191 lines)

```typescript
// Main orchestrator component
export default function ComplianceMetrics({ athleteId }: Props) {
  // State management
  // Data fetching
  return (
    <>
      <WorkoutDetailModal ... />
      <div>
        <BlockHeader ... />
        <WeekNavigator ... />
        <div className="grid">
          <WeekMetrics ... />
          <DailySchedule ... />
        </div>
      </div>
    </>
  );
}
```

Each child component is in its own file:

- `WorkoutDetailModal.tsx` (206 lines)
- `BlockHeader.tsx` (58 lines)
- `WeekNavigator.tsx` (108 lines)
- `WeekMetrics.tsx` (123 lines)
- `DailySchedule.tsx` (143 lines)

### Shared Components to Reuse

Import from `@intervals/ui`:

- `Badge` — generic badge component
- `FormStatusBadge` — TSB-based training form status
- `WorkoutBadge` — workout intensity badge
- `Button` — with loading states and variants
- `Card`, `CardHeader`, `CardSection` — consistent card layouts
- `TimeframeSelector`, `HorizontalSelector` — filter controls
- `Spinner`, `LoadingState`, `Skeleton` — loading states

**Example**:

```typescript
import { Card, CardHeader } from "@intervals/ui/card";
import { Badge } from "@intervals/ui/badge";
import { LoadingState } from "@intervals/ui/spinner";

<Card>
  <CardHeader title="Workout Plan" description="This week's sessions" />
  {loading ? <LoadingState /> : <WorkoutList />}
</Card>
```

## Brand Guidelines & Design System

### Import from Brand Package

**Colors & Theme**:

```typescript
import { getChartColors } from "@intervals/brand/colors";
import { brand } from "@intervals/brand";

const colors = getChartColors(); // Respects light/dark mode
// colors.teal, colors.mint, colors.orange, colors.peach, colors.bg, etc.
```

**Brand Identity** (from `@intervals/brand/guidelines`):

- **Persona**: Evidence-based coach, precise but never cold
- **Voice**: Direct, confident, data-grounded
- **Tone**: Professional but approachable, motivating without hype
- **Colors**: Teal (primary), Mint, Orange, Peach accents

### Design Tokens

**Colors** (Tailwind classes):

- `text-teal` — primary brand color, positive states
- `text-orange` — moderate intensity, caution
- `text-orange-bright` — high intensity, peak efforts
- `text-peach` — recovery, low intensity
- `text-mint` — accent, secondary actions
- `bg-bg` — main background
- `bg-bg-card` — card backgrounds
- `bg-bg-assistant` — assistant/secondary backgrounds
- `text-text` — primary text
- `text-muted` — secondary text
- `border-border` — consistent borders

**Typography**:

- Headers: `font-bold tracking-[0.15em] uppercase`
- Body: `text-sm leading-relaxed`
- Metrics: `tabular-nums` for numbers

**Spacing**:

- Cards: `rounded-2xl px-4 sm:px-6 py-4 sm:py-5`
- Sections: `space-y-6` between major blocks
- Grid gaps: `gap-4` or `gap-6`

### Chart Styling

Use Recharts with brand colors:

```typescript
import { getChartColors } from "@intervals/brand/colors";

const colors = getChartColors();

<LineChart>
  <Line dataKey="ctl" stroke={colors.teal} />
  <Line dataKey="atl" stroke={colors.orange} />
  <Area fill={colors.teal} fillOpacity={0.1} />
</LineChart>
```

## Database Schema

### Core Tables

- `athletes` — athlete profiles (name, intervals_icu_id, cycle_start_date)
- `wellness` — daily HRV, RHR, sleep data (snake_case columns)
- `activities` — completed workouts from Intervals.icu (snake_case)
- `prescribed_workouts` — AI-generated workout plans
- `daily_analyses` — recovery analysis + readiness scores
- `agent_memories` — semantic memory with pgvector embeddings
- `chat_messages` — conversational history

### Column Naming

- **Database**: snake_case (`activity_date`, `avg_hr`, `duration_secs`)
- **TypeScript**: camelCase after transformation (`activityDate`, `avgHr`, `durationSecs`)
- **Transformation**: Always goes through `mapper.ts` loaders

### Vector Search

Semantic memory uses pgvector with 1536-dimension embeddings (OpenAI text-embedding-3-small):

```sql
CREATE TABLE agent_memories (
  id UUID PRIMARY KEY,
  athlete_id UUID REFERENCES athletes(id),
  memory_type TEXT,
  content TEXT,
  embedding vector(1536),
  created_at TIMESTAMPTZ
);

CREATE INDEX ON agent_memories USING ivfflat (embedding vector_cosine_ops);
```

## Code Quality Checklist

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
const { calculateReadiness } = await import("../data/processors/readiness.js");
```

**CORRECT:**

```typescript
// Top of file
import { calculateReadiness } from "../data/processors/readiness.js";
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

## Conventions using mapper.ts

- Agent output types are exported from `schema.ts` as both the Zod schema and the inferred TS type
- All files use ESM (`import/export`), `.js` extension on relative imports (required for Node ESM)
- `dotenv/config` is imported at entry points only (`apps/backend/index.ts`, `daily.ts`, `pipeline.ts`)
- Use static imports at file top, not dynamic imports inside functions (unless for lazy loading)
- Always run `pnpm build` in apps/backend/ before considering a feature complete
