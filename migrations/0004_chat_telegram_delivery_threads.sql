ALTER TABLE chat_telegram_deliveries ADD COLUMN message_thread_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_chat_telegram_deliveries_thread
  ON chat_telegram_deliveries(telegram_chat_id, message_thread_id, created_at DESC);
