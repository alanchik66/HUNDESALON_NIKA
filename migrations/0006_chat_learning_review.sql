-- Existing and automatically collected examples require an explicit privacy review.
ALTER TABLE chat_learning_examples
  ADD COLUMN review_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_chat_learning_examples_locale_review_created
  ON chat_learning_examples(locale, review_status, created_at DESC);
