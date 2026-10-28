-- Payment state is durable before a browser redirect or notification is acknowledged.
CREATE TABLE IF NOT EXISTS payment_orders (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL CHECK(length(token_hash) = 64),
  booking_json TEXT NOT NULL CHECK(json_valid(booking_json)),
  amount INTEGER NOT NULL CHECK(amount > 0),
  currency TEXT NOT NULL CHECK(length(currency) = 3),
  mode TEXT NOT NULL CHECK(mode IN ('test', 'live')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  checkout_session_id TEXT UNIQUE,
  checkout_url TEXT,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK(payment_status IN ('pending', 'paid')),
  paid_at TEXT,
  last_event_id TEXT,
  fulfillment_status TEXT NOT NULL DEFAULT 'pending' CHECK(fulfillment_status IN ('pending', 'processing', 'completed')),
  fulfillment_token TEXT,
  fulfillment_lease_until INTEGER NOT NULL DEFAULT 0,
  fulfillment_attempts INTEGER NOT NULL DEFAULT 0,
  fulfilled_at TEXT,
  booking_status TEXT NOT NULL DEFAULT 'requested' CHECK(booking_status IN ('requested', 'confirmed')),
  confirmed_at TEXT,
  calendar_event_id TEXT
);
CREATE INDEX IF NOT EXISTS payment_orders_pending ON payment_orders(payment_status, fulfillment_status, created_at);

-- Durable delivery intent with an atomic lease; provider acceptance is not mailbox delivery.
CREATE TABLE IF NOT EXISTS payment_outbox (
  order_id TEXT NOT NULL REFERENCES payment_orders(id),
  kind TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending', 'processing', 'completed')),
  lease_token TEXT,
  lease_until INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  PRIMARY KEY (order_id, kind)
);
CREATE INDEX IF NOT EXISTS payment_outbox_pending ON payment_outbox(state, next_attempt_at, lease_until);
