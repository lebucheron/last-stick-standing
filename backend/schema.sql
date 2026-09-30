CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  page TEXT,
  referrer TEXT,
  is_test INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS sessions_last_seen ON sessions(last_seen);
CREATE INDEX IF NOT EXISTS sessions_first_seen ON sessions(first_seen);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  type TEXT NOT NULL,
  round_id TEXT,
  winner TEXT,
  choice TEXT,
  bet_placed INTEGER NOT NULL DEFAULT 0,
  won INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  sudden_death INTEGER NOT NULL DEFAULT 0,
  is_test INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS events_type_date ON events(type, created_at);
CREATE INDEX IF NOT EXISTS events_round ON events(round_id);
