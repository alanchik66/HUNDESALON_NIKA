-- Extend existing delivery tracking with a logical notification identity and lease.
ALTER TABLE delivery_attempts ADD COLUMN idempotency_key TEXT;
ALTER TABLE delivery_attempts ADD COLUMN lease_token TEXT;
ALTER TABLE delivery_attempts ADD COLUMN lease_until INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS delivery_attempts_idempotency_key
  ON delivery_attempts(idempotency_key) WHERE idempotency_key IS NOT NULL;
