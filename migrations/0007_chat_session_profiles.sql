-- NULL preserves legacy sessions; an empty submitted phone stays empty in new sessions.
ALTER TABLE chat_sessions ADD COLUMN profile_first_name TEXT;
ALTER TABLE chat_sessions ADD COLUMN profile_last_name TEXT;
ALTER TABLE chat_sessions ADD COLUMN profile_email TEXT;
ALTER TABLE chat_sessions ADD COLUMN profile_phone TEXT;
ALTER TABLE chat_sessions ADD COLUMN profile_privacy_consent_at TEXT;
