CREATE TABLE site_page_editor (
  locale TEXT NOT NULL CHECK (locale IN ('de','en','ru','uk')),
  slug TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  draft_json TEXT,
  operation_id TEXT NOT NULL,
  PRIMARY KEY (locale, slug)
) STRICT;

CREATE TABLE site_page_versions (
  locale TEXT NOT NULL CHECK (locale IN ('de','en','ru','uk')),
  slug TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  values_json TEXT NOT NULL,
  created_at INTEGER,
  PRIMARY KEY (locale, slug, revision)
) STRICT;

INSERT INTO site_page_versions (locale, slug, revision, values_json)
SELECT locale, slug, revision, values_json FROM site_page_copy;
