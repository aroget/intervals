-- Athlete Goals Table
CREATE TABLE IF NOT EXISTS athlete_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id TEXT NOT NULL REFERENCES athlete_profiles(athlete_id) ON DELETE CASCADE,
  goal_type TEXT NOT NULL, -- 'aerobic_base', 'race_prep', 'strength', 'weight_loss', etc.
  target_date DATE,
  description TEXT NOT NULL,
  metrics JSONB, -- e.g., {"targetCtl": 60, "targetWeeklyTss": 400}
  status TEXT DEFAULT 'active', -- 'active', 'completed', 'cancelled'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_athlete_goals_athlete_id ON athlete_goals(athlete_id);
CREATE INDEX IF NOT EXISTS idx_athlete_goals_status ON athlete_goals(status);

-- Recovery Patterns Table (stores analyzed patterns)
CREATE TABLE IF NOT EXISTS recovery_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id TEXT NOT NULL REFERENCES athlete_profiles(athlete_id) ON DELETE CASCADE,
  pattern_type TEXT NOT NULL, -- 'hrv_drop_after_key', 'recovery_days_needed', etc.
  pattern_data JSONB NOT NULL, -- Specific pattern metrics
  confidence REAL DEFAULT 0.5, -- 0-1 confidence score
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recovery_patterns_athlete_id ON recovery_patterns(athlete_id);
CREATE INDEX IF NOT EXISTS idx_recovery_patterns_type ON recovery_patterns(pattern_type);
