CREATE TABLE IF NOT EXISTS site_page_copy (
  locale TEXT NOT NULL CHECK (locale IN ('de','en','ru','uk')),
  slug TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  values_json TEXT NOT NULL,
  PRIMARY KEY (locale, slug)
);
