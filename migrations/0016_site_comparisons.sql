CREATE TABLE IF NOT EXISTS site_comparisons (
  id TEXT NOT NULL PRIMARY KEY,
  locale TEXT NOT NULL CHECK (locale IN ('de', 'en', 'ru', 'uk')),
  category TEXT NOT NULL CHECK (category IN ('dogs', 'cats', 'smallAnimals', 'salon')),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  before_alt TEXT NOT NULL CHECK (length(before_alt) <= 250),
  after_alt TEXT NOT NULL CHECK (length(after_alt) <= 250),
  before_mime TEXT NOT NULL CHECK (before_mime IN ('image/jpeg', 'image/png', 'image/webp')),
  after_mime TEXT NOT NULL CHECK (after_mime IN ('image/jpeg', 'image/png', 'image/webp')),
  before_size INTEGER NOT NULL CHECK (before_size BETWEEN 1 AND 4194304),
  after_size INTEGER NOT NULL CHECK (after_size BETWEEN 1 AND 4194304),
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0,1)),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (published = 0 OR (length(before_alt) > 0 AND length(after_alt) > 0))
) STRICT;

CREATE INDEX IF NOT EXISTS site_comparisons_locale ON site_comparisons (locale, published, created_at);

CREATE TABLE IF NOT EXISTS site_comparison_chunks (
  comparison_id TEXT NOT NULL REFERENCES site_comparisons (id) ON DELETE CASCADE,
  side TEXT NOT NULL CHECK (side IN ('before', 'after')),
  ordinal INTEGER NOT NULL CHECK (ordinal BETWEEN 0 AND 15),
  payload TEXT NOT NULL CHECK (length(payload) BETWEEN 4 AND 349528),
  PRIMARY KEY (comparison_id, side, ordinal)
) STRICT;
