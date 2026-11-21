CREATE TABLE site_media_next (
  id TEXT NOT NULL PRIMARY KEY,
  locale TEXT NOT NULL CHECK (locale IN ('de', 'en', 'ru', 'uk')),
  slug TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  alt TEXT NOT NULL CHECK (length(alt) <= 250),
  mime TEXT NOT NULL CHECK (mime IN (
    'image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm',
    'application/pdf', 'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  )),
  byte_size INTEGER NOT NULL CHECK (byte_size BETWEEN 1 AND 150000000),
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  upload_until INTEGER,
  for_comparison INTEGER NOT NULL DEFAULT 0 CHECK (for_comparison IN (0, 1)),
  CHECK (published = 0 OR mime NOT LIKE 'image/%' OR length(alt) > 0),
  CHECK (upload_until IS NULL OR published = 0),
  CHECK (for_comparison = 0 OR (published = 0 AND mime LIKE 'image/%' AND slug = 'do-i-posle'))
) STRICT;

INSERT INTO site_media_next (id, locale, slug, title, alt, mime, byte_size, published, revision, created_at, updated_at)
SELECT id, locale, slug, title, alt, mime, byte_size, published, revision, created_at, updated_at
FROM site_media;

CREATE TABLE site_media_chunks_next (
  media_id TEXT NOT NULL REFERENCES site_media_next (id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL CHECK (ordinal BETWEEN 0 AND 572),
  payload TEXT NOT NULL CHECK (length(payload) BETWEEN 4 AND 349528),
  PRIMARY KEY (media_id, ordinal)
) STRICT;

INSERT INTO site_media_chunks_next (media_id, ordinal, payload)
SELECT media_id, ordinal, payload FROM site_media_chunks;

-- Copy the chunks before dropping the old child, and drop it before its parent.
DROP TABLE site_media_chunks;
DROP TABLE site_media;
ALTER TABLE site_media_next RENAME TO site_media;
ALTER TABLE site_media_chunks_next RENAME TO site_media_chunks;

CREATE INDEX site_media_page ON site_media (locale, slug, published, created_at);

-- Existing comparisons keep their original chunks and size limits. Linked
-- comparisons read the uploaded files from site_media and can be larger.
CREATE TABLE site_comparisons_next (
  id TEXT NOT NULL PRIMARY KEY,
  locale TEXT NOT NULL CHECK (locale IN ('de', 'en', 'ru', 'uk')),
  category TEXT NOT NULL CHECK (category IN ('dogs', 'cats', 'smallAnimals', 'salon')),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  before_alt TEXT NOT NULL CHECK (length(before_alt) <= 250),
  after_alt TEXT NOT NULL CHECK (length(after_alt) <= 250),
  before_mime TEXT NOT NULL CHECK (before_mime IN ('image/jpeg', 'image/png', 'image/webp')),
  after_mime TEXT NOT NULL CHECK (after_mime IN ('image/jpeg', 'image/png', 'image/webp')),
  before_size INTEGER NOT NULL CHECK (
    before_size BETWEEN 1 AND CASE WHEN before_media_id IS NULL THEN 4194304 ELSE 150000000 END
  ),
  after_size INTEGER NOT NULL CHECK (
    after_size BETWEEN 1 AND CASE WHEN after_media_id IS NULL THEN 4194304 ELSE 150000000 END
  ),
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  before_media_id TEXT REFERENCES site_media (id) ON DELETE RESTRICT,
  after_media_id TEXT REFERENCES site_media (id) ON DELETE RESTRICT,
  CHECK (published = 0 OR (length(before_alt) > 0 AND length(after_alt) > 0)),
  CHECK (
    (before_media_id IS NULL AND after_media_id IS NULL) OR
    (before_media_id IS NOT NULL AND after_media_id IS NOT NULL AND before_media_id <> after_media_id)
  )
) STRICT;

INSERT INTO site_comparisons_next (
  id, locale, category, title, before_alt, after_alt, before_mime, after_mime,
  before_size, after_size, published, revision, created_at, updated_at
)
SELECT id, locale, category, title, before_alt, after_alt, before_mime, after_mime,
  before_size, after_size, published, revision, created_at, updated_at
FROM site_comparisons;

CREATE TABLE site_comparison_chunks_next (
  comparison_id TEXT NOT NULL REFERENCES site_comparisons_next (id) ON DELETE CASCADE,
  side TEXT NOT NULL CHECK (side IN ('before', 'after')),
  ordinal INTEGER NOT NULL CHECK (ordinal BETWEEN 0 AND 15),
  payload TEXT NOT NULL CHECK (length(payload) BETWEEN 4 AND 349528),
  PRIMARY KEY (comparison_id, side, ordinal)
) STRICT;

INSERT INTO site_comparison_chunks_next (comparison_id, side, ordinal, payload)
SELECT comparison_id, side, ordinal, payload FROM site_comparison_chunks;

DROP TABLE site_comparison_chunks;
DROP TABLE site_comparisons;
ALTER TABLE site_comparisons_next RENAME TO site_comparisons;
ALTER TABLE site_comparison_chunks_next RENAME TO site_comparison_chunks;

CREATE INDEX site_comparisons_locale ON site_comparisons (locale, published, created_at);
CREATE UNIQUE INDEX site_comparisons_before_media ON site_comparisons (before_media_id)
  WHERE before_media_id IS NOT NULL;
CREATE UNIQUE INDEX site_comparisons_after_media ON site_comparisons (after_media_id)
  WHERE after_media_id IS NOT NULL;

CREATE TRIGGER site_comparisons_validate_media
BEFORE INSERT ON site_comparisons
WHEN NEW.before_media_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'Comparison image is not ready or does not match its metadata')
  WHERE NOT EXISTS (
    SELECT 1 FROM site_media WHERE id = NEW.before_media_id AND for_comparison = 1 AND upload_until IS NULL
      AND locale = NEW.locale AND mime = NEW.before_mime AND byte_size = NEW.before_size
  ) OR NOT EXISTS (
    SELECT 1 FROM site_media WHERE id = NEW.after_media_id AND for_comparison = 1 AND upload_until IS NULL
      AND locale = NEW.locale AND mime = NEW.after_mime AND byte_size = NEW.after_size
  );
  SELECT RAISE(ABORT, 'Comparison image already belongs to a pair')
  WHERE EXISTS (
    SELECT 1 FROM site_comparisons
    WHERE before_media_id = NEW.after_media_id OR after_media_id = NEW.before_media_id
  );
END;

CREATE TRIGGER site_comparisons_keep_media_links
BEFORE UPDATE OF before_media_id, after_media_id ON site_comparisons
WHEN NEW.before_media_id IS NOT OLD.before_media_id OR NEW.after_media_id IS NOT OLD.after_media_id
BEGIN
  SELECT RAISE(ABORT, 'Comparison image links cannot be changed');
END;

CREATE TRIGGER site_comparisons_delete_linked_media
AFTER DELETE ON site_comparisons
WHEN OLD.before_media_id IS NOT NULL
BEGIN
  DELETE FROM site_media WHERE id IN (OLD.before_media_id, OLD.after_media_id);
END;
