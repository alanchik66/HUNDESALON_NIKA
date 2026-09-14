CREATE TABLE IF NOT EXISTS chat_learning_examples (
  id TEXT PRIMARY KEY,
  locale TEXT NOT NULL CHECK (locale IN ('de', 'en', 'ru', 'uk')),
  customer_message TEXT NOT NULL,
  staff_reply TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (locale, customer_message, staff_reply)
);

CREATE INDEX IF NOT EXISTS idx_chat_learning_examples_locale_created
  ON chat_learning_examples(locale, created_at DESC);
