-- Only technical hashes and counters are stored; customer content stays in CRM.
CREATE TABLE IF NOT EXISTS resource_usage_daily (
  day TEXT NOT NULL,
  resource TEXT NOT NULL,
  scope_key TEXT NOT NULL,
  units INTEGER NOT NULL DEFAULT 0 CHECK (units >= 0),
  bytes INTEGER NOT NULL DEFAULT 0 CHECK (bytes >= 0),
  PRIMARY KEY (day, resource, scope_key)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS resource_usage_reservations (
  id TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  resource TEXT NOT NULL CHECK (resource IN ('ai', 'uploads', 'upload_transfer', 'storage', 'gifs')),
  client_key TEXT NOT NULL,
  session_key TEXT NOT NULL,
  units INTEGER NOT NULL CHECK (units > 0),
  bytes INTEGER NOT NULL CHECK (bytes >= 0),
  account_limit INTEGER NOT NULL CHECK (account_limit > 0),
  client_limit INTEGER NOT NULL CHECK (client_limit > 0),
  session_limit INTEGER NOT NULL CHECK (session_limit > 0),
  account_bytes INTEGER NOT NULL CHECK (account_bytes > 0),
  client_bytes INTEGER NOT NULL CHECK (client_bytes > 0),
  session_bytes INTEGER NOT NULL CHECK (session_bytes > 0)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS idx_resource_usage_reservations_day ON resource_usage_reservations(day);

-- A single INSERT reserves all three scopes in the same write transaction.
-- RAISE(ABORT) rolls back the whole statement, including every trigger update.
CREATE TRIGGER IF NOT EXISTS resource_usage_reserve
BEFORE INSERT ON resource_usage_reservations
BEGIN
  -- A WHERE guard also avoids confusing SQL migration splitters with CASE ... END.
  SELECT RAISE(ABORT, 'resource_quota_exceeded') WHERE
    COALESCE((SELECT units FROM resource_usage_daily WHERE day = NEW.day AND resource = NEW.resource AND scope_key = 'account'), 0) + NEW.units > NEW.account_limit
    OR COALESCE((SELECT bytes FROM resource_usage_daily WHERE day = NEW.day AND resource = NEW.resource AND scope_key = 'account'), 0) + NEW.bytes > NEW.account_bytes
    OR COALESCE((SELECT units FROM resource_usage_daily WHERE day = NEW.day AND resource = NEW.resource AND scope_key = NEW.client_key), 0) + NEW.units > NEW.client_limit
    OR COALESCE((SELECT bytes FROM resource_usage_daily WHERE day = NEW.day AND resource = NEW.resource AND scope_key = NEW.client_key), 0) + NEW.bytes > NEW.client_bytes
    OR COALESCE((SELECT units FROM resource_usage_daily WHERE day = NEW.day AND resource = NEW.resource AND scope_key = NEW.session_key), 0) + NEW.units > NEW.session_limit
    OR COALESCE((SELECT bytes FROM resource_usage_daily WHERE day = NEW.day AND resource = NEW.resource AND scope_key = NEW.session_key), 0) + NEW.bytes > NEW.session_bytes
  ;

  INSERT INTO resource_usage_daily(day, resource, scope_key, units, bytes)
    VALUES (NEW.day, NEW.resource, 'account', NEW.units, NEW.bytes)
    ON CONFLICT(day, resource, scope_key) DO UPDATE SET units = units + NEW.units, bytes = bytes + NEW.bytes;
  INSERT INTO resource_usage_daily(day, resource, scope_key, units, bytes)
    VALUES (NEW.day, NEW.resource, NEW.client_key, NEW.units, NEW.bytes)
    ON CONFLICT(day, resource, scope_key) DO UPDATE SET units = units + NEW.units, bytes = bytes + NEW.bytes;
  INSERT INTO resource_usage_daily(day, resource, scope_key, units, bytes)
    VALUES (NEW.day, NEW.resource, NEW.session_key, NEW.units, NEW.bytes)
    ON CONFLICT(day, resource, scope_key) DO UPDATE SET units = units + NEW.units, bytes = bytes + NEW.bytes;

  -- Keep at most seven UTC dates of quota metadata, without touching CRM.
  DELETE FROM resource_usage_reservations WHERE day < date(NEW.day, '-6 days');
  DELETE FROM resource_usage_daily WHERE day < date(NEW.day, '-6 days');
END;
