CREATE TABLE IF NOT EXISTS site_media (
  id TEXT NOT NULL PRIMARY KEY,
  locale TEXT NOT NULL CHECK (locale IN ('de', 'en', 'ru', 'uk')),
  slug TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  alt TEXT NOT NULL CHECK (length(alt) <= 250),
  mime TEXT NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm')),
  byte_size INTEGER NOT NULL CHECK (byte_size BETWEEN 1 AND 12582912),
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (published = 0 OR mime LIKE 'video/%' OR length(alt) > 0)
) STRICT;

CREATE INDEX IF NOT EXISTS site_media_page ON site_media (locale, slug, published, created_at);

CREATE TABLE IF NOT EXISTS site_media_chunks (
  media_id TEXT NOT NULL REFERENCES site_media (id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL CHECK (ordinal BETWEEN 0 AND 47),
  payload TEXT NOT NULL CHECK (length(payload) BETWEEN 4 AND 349528),
  PRIMARY KEY (media_id, ordinal)
) STRICT;
