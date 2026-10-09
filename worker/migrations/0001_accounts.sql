-- Accounts, sessions, and the phone <-> laptop mailbox. Every row belongs to one user.
-- Photos live in R2 under `<user id>/`, never in here.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  github_id INTEGER NOT NULL UNIQUE,
  login TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at INTEGER NOT NULL
);

-- Only a SHA-256 of the cookie value is stored, so a leaked table can't sign anyone in.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

-- One-time QR codes that sign a phone into the same account. Hashed like sessions.
CREATE TABLE link_codes (
  code_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

CREATE TABLE finds (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  quest TEXT NOT NULL,
  status TEXT NOT NULL,
  creature TEXT,
  reason TEXT,
  created_at INTEGER NOT NULL,
  resolved_at INTEGER,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX finds_waiting ON finds(user_id, status, created_at);

CREATE TABLE hunts (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  title TEXT NOT NULL,
  items TEXT NOT NULL,
  status TEXT NOT NULL,
  result TEXT,
  created_at INTEGER NOT NULL,
  resolved_at INTEGER,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX hunts_waiting ON hunts(user_id, status, created_at);

-- Quests and hunt lists Gemma wrote ahead of time, oldest first.
CREATE TABLE pool (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('quest', 'hunt')),
  title TEXT NOT NULL,
  draft TEXT NOT NULL
);
CREATE INDEX pool_user ON pool(user_id, kind, seq);

-- The phone's latest setting / weather / season / time, and when the laptop last checked in.
CREATE TABLE user_state (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  context TEXT,
  base_seen_at INTEGER NOT NULL DEFAULT 0,
  gemma_ready INTEGER NOT NULL DEFAULT 0
);
