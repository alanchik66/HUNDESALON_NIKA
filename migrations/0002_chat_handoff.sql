ALTER TABLE chat_sessions
ADD COLUMN conversation_mode TEXT NOT NULL DEFAULT 'ai'
CHECK (conversation_mode IN ('ai', 'human'));
