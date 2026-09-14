CREATE TABLE IF NOT EXISTS chat_telegram_topics (
  category TEXT PRIMARY KEY,
  message_thread_id INTEGER NOT NULL CHECK (message_thread_id > 0),
  updated_at TEXT NOT NULL
);
