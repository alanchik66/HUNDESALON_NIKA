-- Operational metadata only: no recipients, message bodies, tokens, or provider responses.
CREATE TABLE IF NOT EXISTS delivery_attempts (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL CHECK(length(request_id) = 36),
  form_type TEXT NOT NULL CHECK(form_type IN ('booking', 'contact', 'feedback', 'client_registration')),
  channel TEXT NOT NULL CHECK(channel IN ('booking_register', 'client_register', 'email_main', 'email_client', 'email_admin', 'telegram', 'contact_sync', 'automation', 'failure_alert', 'calendar')),
  state TEXT NOT NULL CHECK(state IN ('pending', 'accepted', 'failed', 'skipped')),
  provider_status INTEGER NOT NULL DEFAULT 0 CHECK(provider_status BETWEEN 0 AND 599),
  result_code TEXT NOT NULL CHECK(result_code IN ('pending', 'accepted', 'skipped', 'provider_failure', 'network_error')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS delivery_attempts_state_created ON delivery_attempts(state, created_at);
CREATE INDEX IF NOT EXISTS delivery_attempts_request_channel ON delivery_attempts(request_id, channel, created_at);
