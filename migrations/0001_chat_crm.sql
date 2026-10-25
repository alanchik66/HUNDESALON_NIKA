PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS chat_customers (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  phone TEXT,
  locale TEXT NOT NULL,
  privacy_consent_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES chat_customers(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  locale TEXT NOT NULL,
  page_path TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'revoked')),
  created_at TEXT NOT NULL,
  last_message_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES chat_customers(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  channel TEXT NOT NULL CHECK (channel IN ('web', 'telegram', 'sendpulse')),
  kind TEXT NOT NULL CHECK (kind IN ('text', 'file', 'voice', 'system')),
  body TEXT,
  file_name TEXT,
  mime_type TEXT,
  file_size INTEGER,
  one_drive_item_id TEXT,
  one_drive_url TEXT,
  reply_to_message_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_telegram_deliveries (
  telegram_chat_id TEXT NOT NULL,
  telegram_message_id INTEGER NOT NULL,
  session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES chat_customers(id) ON DELETE CASCADE,
  source_message_id TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (telegram_chat_id, telegram_message_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_sequence
  ON chat_messages(session_id, sequence);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_customer
  ON chat_sessions(customer_id, last_message_at DESC);
