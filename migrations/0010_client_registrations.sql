-- Primary intake store: Google Sheets is a recoverable mirror, never the sole copy.
CREATE TABLE IF NOT EXISTS client_registrations (
  request_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  values_json TEXT NOT NULL CHECK(json_valid(values_json)),
  sheet_synced_at TEXT,
  sync_attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TEXT
);
CREATE INDEX IF NOT EXISTS client_registrations_pending
  ON client_registrations(sheet_synced_at, created_at);
