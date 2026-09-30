ALTER TABLE sessions ADD COLUMN is_test INTEGER NOT NULL DEFAULT 0;
ALTER TABLE events ADD COLUMN is_test INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS events_unique_round_type ON events(session_id, round_id, type) WHERE round_id IS NOT NULL;
