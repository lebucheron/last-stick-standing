ALTER TABLE events ADD COLUMN ruleset TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE events ADD COLUMN starts TEXT;
CREATE INDEX IF NOT EXISTS events_ruleset_type ON events(ruleset, type, created_at);
