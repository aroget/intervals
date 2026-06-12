-- Run in Supabase SQL editor to initialise the schema.
-- Enable pgvector extension first (Supabase dashboard → Database → Extensions → vector).

-- ────────────────────────────────────────────────────────────────
-- Athlete profile
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS athlete_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id    TEXT UNIQUE NOT NULL,            -- e.g. Intervals.icu athlete id
  name          TEXT NOT NULL,
  goals         TEXT,
  training_philosophy TEXT,
  disciplines   TEXT[] DEFAULT '{}',             -- swim, bike, run, strength
  weekly_max_hours JSONB DEFAULT '{}',           -- { "monday": 1, "tuesday": 2, ... }
  preferred_metrics TEXT[] DEFAULT '{}',
  cycle_start_date DATE,
  coaching_notes TEXT,                           -- Custom instructions for AI coach
  preferred_theme TEXT DEFAULT 'system',         -- Theme preference: 'light', 'dark', or 'system'
  ftp           INTEGER,                         -- Cycling FTP in watts
  running_threshold_pace INTEGER,               -- Running threshold pace in seconds per km
  lthr          INTEGER,                         -- Lactate Threshold Heart Rate in bpm
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Migration (run if table already exists):
-- ALTER TABLE athlete_profiles ADD COLUMN IF NOT EXISTS coaching_notes TEXT;
-- ALTER TABLE athlete_profiles ADD COLUMN IF NOT EXISTS preferred_theme TEXT DEFAULT 'system';
-- ALTER TABLE athlete_profiles ADD COLUMN IF NOT EXISTS ftp INTEGER;
-- ALTER TABLE athlete_profiles ADD COLUMN IF NOT EXISTS running_threshold_pace INTEGER;
-- ALTER TABLE athlete_profiles ADD COLUMN IF NOT EXISTS lthr INTEGER;

-- ────────────────────────────────────────────────────────────────
-- Wellness logs (synced from Intervals.icu)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wellness_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id    TEXT NOT NULL REFERENCES athlete_profiles(athlete_id) ON DELETE CASCADE,
  log_date      DATE NOT NULL,
  hrv           NUMERIC,          -- RMSSD in ms
  hrv_score     NUMERIC,          -- 0–10 readiness score from HRV4Training / Garmin
  rhr           NUMERIC,          -- Resting heart rate (bpm)
  sleep_score   NUMERIC,          -- Normalised 0–100
  sleep_hours   NUMERIC,
  sleep_quality TEXT,             -- poor / fair / good / excellent
  raw_source    TEXT,             -- garmin / hrv4training / oura / manual
  raw_data      JSONB,            -- full raw payload for reprocessing
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(athlete_id, log_date)
);

-- ────────────────────────────────────────────────────────────────
-- Activities (synced from Intervals.icu)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id      TEXT NOT NULL REFERENCES athlete_profiles(athlete_id) ON DELETE CASCADE,
  intervals_id    TEXT UNIQUE,               -- Intervals.icu activity id
  activity_date   DATE NOT NULL,
  sport           TEXT,                      -- ride, run, swim, strength
  name            TEXT,
  duration_secs   INTEGER,
  distance_m      NUMERIC,
  tss             NUMERIC,                   -- Training Stress Score (icu_training_load)
  intensity_factor NUMERIC,                   -- Intensity Factor (icu_intensity)
  atl             NUMERIC,                   -- Acute Training Load from Intervals.icu
  ctl             NUMERIC,                   -- Chronic Training Load from Intervals.icu
  joules          NUMERIC,                   -- total energy (kJ)
  avg_hr          NUMERIC,
  max_hr          NUMERIC,
  avg_power       NUMERIC,
  normalized_power NUMERIC,
  gap             NUMERIC,                   -- Grade Adjusted Pace (m/s)
  decoupling      NUMERIC,                   -- aerobic decoupling (%)
  elevation_m     NUMERIC,
  notes           TEXT,
  rpe             NUMERIC,                   -- Athlete RPE 1–10 (feel field)
  athlete_comments TEXT,                     -- Post-session notes
  session_type    TEXT,                      -- key | endurance | recovery | rest (inferred from prescription or TSS)
  post_workout_analysis TEXT,                -- AI-generated post-workout analysis (cached)
  raw_data        JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Migration (run if table already exists):
-- ALTER TABLE activities ADD COLUMN IF NOT EXISTS session_type TEXT;


-- ────────────────────────────────────────────────────────────────
-- Training cycles (4-week blocks)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS training_cycles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id  TEXT NOT NULL REFERENCES athlete_profiles(athlete_id) ON DELETE CASCADE,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,              -- start_date + 27 days
  week_1_type TEXT DEFAULT 'build',      -- build | peak | recovery | base
  week_2_type TEXT DEFAULT 'build',
  week_3_type TEXT DEFAULT 'peak',
  week_4_type TEXT DEFAULT 'recovery',
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────
-- Daily analyses (Recovery Agent output)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_analyses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id      TEXT NOT NULL REFERENCES athlete_profiles(athlete_id) ON DELETE CASCADE,
  analysis_date   DATE NOT NULL,
  readiness_score NUMERIC NOT NULL,      -- computed 0–100 (deterministic)
  hrv_trend       TEXT,                  -- rising | stable | declining
  training_quality JSONB,                -- TrainingQualityResult: score + 4 components
  agent_output    JSONB NOT NULL,        -- full Recovery Agent structured output
  model_used      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(athlete_id, analysis_date)
);

-- Migration (run if table already exists):
-- ALTER TABLE daily_analyses ADD COLUMN IF NOT EXISTS training_quality JSONB;
-- ALTER TABLE daily_analyses DROP COLUMN IF EXISTS block_effectiveness;
-- ALTER TABLE daily_analyses DROP COLUMN IF EXISTS block_effectiveness_detail;

-- ────────────────────────────────────────────────────────────────
-- Prescribed workouts (Coach Agent output)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prescribed_workouts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id    TEXT NOT NULL REFERENCES athlete_profiles(athlete_id) ON DELETE CASCADE,
  workout_date  DATE NOT NULL,
  sport         TEXT,
  duration_min  INTEGER,
  intensity     TEXT,                    -- easy | moderate | hard | rest
  session_type  TEXT,                    -- key | endurance | recovery | rest
  had_deviation_flag BOOLEAN DEFAULT FALSE,  -- Was there a ⚠️ readiness warning?
  deviation_severity TEXT,               -- moderate | major (severity of the flag)
  structure     JSONB,                   -- detailed intervals / phases
  rationale     TEXT,
  agent_output  JSONB NOT NULL,          -- full Coach Agent structured output
  model_used    TEXT,
  completed     BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(athlete_id, workout_date)
);

-- Migration (run if table already exists):
-- ALTER TABLE prescribed_workouts ADD COLUMN IF NOT EXISTS session_type TEXT;
-- ALTER TABLE prescribed_workouts ADD COLUMN IF NOT EXISTS had_deviation_flag BOOLEAN DEFAULT FALSE;
-- ALTER TABLE prescribed_workouts ADD COLUMN IF NOT EXISTS deviation_severity TEXT;

-- ────────────────────────────────────────────────────────────────
-- Agent memory (semantic / episodic)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_memories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id  TEXT NOT NULL REFERENCES athlete_profiles(athlete_id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL,             -- workout | analysis | chat_summary | note
  content     TEXT NOT NULL,            -- human-readable text that was embedded
  embedding   vector(1024),             -- dimension must match LLM_EMBED_MODEL output
  metadata    JSONB DEFAULT '{}',       -- date, source, tags etc.
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_memories_embedding_idx
  ON agent_memories USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ────────────────────────────────────────────────────────────────
-- Semantic memory search RPC
-- Used by searchMemory tool in src/agents/tools/searchMemory.ts
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION match_memories(
  p_athlete_id TEXT,
  p_embedding  vector(1024),
  p_limit      INT DEFAULT 5
)
RETURNS TABLE (
  id          UUID,
  memory_type TEXT,
  content     TEXT,
  metadata    JSONB,
  similarity  FLOAT,
  created_at  TIMESTAMPTZ
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id,
    memory_type,
    content,
    metadata,
    1 - (embedding <=> p_embedding) AS similarity,
    created_at
  FROM agent_memories
  WHERE athlete_id = p_athlete_id
    AND embedding IS NOT NULL
  ORDER BY embedding <=> p_embedding
  LIMIT p_limit;
$$;

-- ────────────────────────────────────────────────────────────────
-- Helper: auto-update updated_at on athlete_profiles
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER athlete_profiles_updated_at
  BEFORE UPDATE ON athlete_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ────────────────────────────────────────────────────────────────
-- Chat
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_threads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id  TEXT NOT NULL REFERENCES athlete_profiles(athlete_id) ON DELETE CASCADE,
  title       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content     TEXT NOT NULL,
  tool_calls  JSONB,                    -- stored if assistant used tools
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
