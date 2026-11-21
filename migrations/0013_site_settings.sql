CREATE TABLE site_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL DEFAULT 0,
  payload TEXT NOT NULL DEFAULT '{}'
);
INSERT INTO site_settings (id) VALUES (1);

CREATE TABLE site_admin_sessions (
  token_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);
CREATE INDEX site_admin_sessions_expiry ON site_admin_sessions (expires_at);
