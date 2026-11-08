CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
  auth_version INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sessions (
  idhash TEXT PRIMARY KEY,
  userid TEXT REFERENCES users(id) ON DELETE CASCADE,
  csrf TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  auth_version INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(userid);
CREATE TABLE IF NOT EXISTS content (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('experience', 'activities', 'projects', 'certificates')),
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS content_kind_created ON content(kind, created_at);
