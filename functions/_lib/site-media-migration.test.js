import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

const migration = name => readFileSync(new URL('../../migrations/' + name, import.meta.url), 'utf8');
const mediaUploads = migration('0017_site_media_video_uploads.sql');

function legacyDatabase(t) {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(migration('0015_site_media.sql'));
  db.exec(migration('0016_site_comparisons.sql'));
  return db;
}

function upgrade(db) {
  db.exec('BEGIN');
  try {
    db.exec(mediaUploads);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

test('migration preserves existing images, videos, comparisons, chunks and page indexes', t => {
  const db = legacyDatabase(t);
  db.exec(`
    INSERT INTO site_media VALUES
      ('photo', 'de', 'galereya', 'Foto', 'Hund', 'image/jpeg', 6, 1, 2, 10, 20),
      ('imported', 'en', 'galereya', 'Import', 'Dog', 'image/png', 4194305, 1, 2, 10, 20),
      ('video', 'uk', 'galereya', 'Відео', '', 'video/webm', 12582912, 0, 3, 30, 40);
    INSERT INTO site_media_chunks VALUES
      ('photo', 0, 'YWJjZGVm'),
      ('imported', 0, 'YWJj'),
      ('video', 0, 'YWJj'),
      ('video', 47, 'ZGVm');
    INSERT INTO site_comparisons VALUES
      ('legacy', 'de', 'dogs', 'Vergleich', 'Vorher', 'Nachher', 'image/png', 'image/webp', 3, 6, 1, 1, 10, 10);
    INSERT INTO site_comparison_chunks VALUES ('legacy', 'before', 0, 'YWJj'), ('legacy', 'after', 0, 'YWJjZGVm');
  `);
  const rows = () => db.prepare('SELECT * FROM site_media ORDER BY id').all();
  const chunks = () => db.prepare('SELECT * FROM site_media_chunks ORDER BY media_id, ordinal').all();
  const originalRows = rows();
  const originalChunks = chunks();
  const legacyComparison = db.prepare('SELECT * FROM site_comparisons').get();
  const legacyComparisonChunks = db.prepare('SELECT * FROM site_comparison_chunks ORDER BY side').all();

  upgrade(db);

  assert.deepEqual(
    rows().map(({ upload_until: expiry, for_comparison: comparison, ...row }) => ({ expiry, comparison, row })),
    originalRows.map(row => ({ expiry: null, comparison: 0, row: { ...row } }))
  );
  assert.deepEqual(chunks(), originalChunks);
  assert.deepEqual(
    { ...db.prepare('SELECT * FROM site_comparisons').get() },
    {
      ...legacyComparison,
      before_media_id: null,
      after_media_id: null,
    }
  );
  assert.deepEqual(db.prepare('SELECT * FROM site_comparison_chunks ORDER BY side').all(), legacyComparisonChunks);
  assert.deepEqual(
    db
      .prepare("PRAGMA index_info('site_media_page')")
      .all()
      .map(column => column.name),
    ['locale', 'slug', 'published', 'created_at']
  );
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);

  db.exec("DELETE FROM site_comparisons WHERE id = 'legacy'");
  assert.deepEqual(db.prepare('SELECT * FROM site_comparison_chunks').all(), []);
  assert.deepEqual(chunks(), originalChunks);
  db.exec("DELETE FROM site_media WHERE id = 'video'");
  assert.deepEqual(
    chunks(),
    originalChunks.filter(chunk => chunk.media_id !== 'video')
  );
});

test('media size, staging and chunk constraints apply at the new boundaries', t => {
  const db = legacyDatabase(t);
  upgrade(db);
  const insert = db.prepare(`
    INSERT INTO site_media (
      id, locale, slug, title, alt, mime, byte_size, published, created_at, updated_at, upload_until, for_comparison
    ) VALUES (?, 'ru', ?, 'Fixture', ?, ?, ?, ?, 1, 1, ?, ?)
  `);
  const mimes = [
    'image/png',
    'video/webm',
    'application/pdf',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ];
  for (const mime of mimes) {
    insert.run(mime, 'galereya', '', mime, 150000000, 0, 1000, 0);
    assert.throws(() => insert.run('too-big', 'galereya', '', mime, 150000001, 0, null, 0), /CHECK constraint failed/);
  }
  assert.throws(() => insert.run('draft', 'galereya', '', 'video/mp4', 100, 1, 1000, 0), /CHECK constraint failed/);
  assert.throws(
    () => insert.run('invalid-comparison', 'galereya', '', 'image/png', 100, 0, null, 1),
    /CHECK constraint failed/
  );
  assert.throws(
    () => insert.run('invalid-comparison', 'do-i-posle', '', 'application/pdf', 100, 0, null, 1),
    /CHECK constraint failed/
  );
  assert.throws(
    () => insert.run('invalid-comparison', 'do-i-posle', 'Dog', 'image/png', 100, 1, null, 1),
    /CHECK constraint failed/
  );
  insert.run('comparison', 'do-i-posle', '', 'image/png', 100, 0, 1000, 1);

  const chunk = db.prepare('INSERT INTO site_media_chunks VALUES (?, ?, ?)');
  chunk.run('video/webm', 572, 'YWJj');
  assert.throws(() => chunk.run('video/webm', 573, 'YWJj'), /CHECK constraint failed/);
  assert.throws(() => chunk.run('missing', 0, 'YWJj'), /FOREIGN KEY constraint failed/);
  assert.throws(
    () => db.exec("UPDATE site_media SET published = 1 WHERE id = 'text/plain'"),
    /CHECK constraint failed/
  );
  db.exec("UPDATE site_media SET upload_until = NULL, published = 1 WHERE id = 'text/plain'");
  assert.equal(db.prepare("SELECT published FROM site_media WHERE id = 'text/plain'").get().published, 1);
});

test('linked comparison images are validated, exclusive and removed with their comparison', t => {
  const db = legacyDatabase(t);
  upgrade(db);
  const addImage = db.prepare(`
    INSERT INTO site_media (
      id, locale, slug, title, alt, mime, byte_size, created_at, updated_at, upload_until, for_comparison
    ) VALUES (?, ?, 'do-i-posle', 'Fixture', '', 'image/png', 150000000, 1, 1, ?, ?)
  `);
  for (const id of ['first-before', 'first-after', 'other']) addImage.run(id, 'ru', null, 1);
  addImage.run('incomplete', 'ru', 1000, 1);
  addImage.run('wrong-locale', 'uk', null, 1);
  addImage.run('ordinary', 'ru', null, 0);

  const pair = db.prepare(`
    INSERT INTO site_comparisons (
      id, locale, category, title, before_alt, after_alt, before_mime, after_mime,
      before_size, after_size, created_at, updated_at, before_media_id, after_media_id
    ) VALUES (?, 'ru', 'dogs', 'Fixture', 'До', 'После', 'image/png', 'image/png', 150000000, 150000000, 1, 1, ?, ?)
  `);
  for (const id of ['incomplete', 'wrong-locale', 'ordinary', 'missing']) {
    assert.throws(() => pair.run('rejected', id, 'other'), /Comparison image is not ready/);
  }
  assert.throws(() => pair.run('rejected', 'other', null), /Comparison image is not ready|CHECK constraint failed/);
  assert.throws(() => pair.run('rejected', 'other', 'other'), /CHECK constraint failed/);
  pair.run('first', 'first-before', 'first-after');
  assert.throws(() => pair.run('same-role', 'first-before', 'other'), /UNIQUE constraint failed/);
  assert.throws(() => pair.run('cross-role', 'first-after', 'other'), /Comparison image already belongs/);
  assert.throws(() => pair.run('cross-role', 'other', 'first-before'), /Comparison image already belongs/);
  assert.throws(
    () => db.exec("UPDATE site_comparisons SET after_media_id = 'other' WHERE id = 'first'"),
    /cannot be changed/
  );
  assert.throws(() => db.exec("DELETE FROM site_media WHERE id = 'first-before'"), /FOREIGN KEY constraint failed/);

  db.exec(`
    INSERT INTO site_media_chunks VALUES ('first-before', 0, 'YWJj'), ('first-after', 0, 'YWJj'), ('other', 0, 'YWJj');
    UPDATE site_comparisons SET published = 1 WHERE id = 'first';
    DELETE FROM site_comparisons WHERE id = 'first';
  `);
  assert.equal(db.prepare("SELECT count(*) AS n FROM site_media WHERE id LIKE 'first-%'").get().n, 0);
  assert.deepEqual(
    db
      .prepare('SELECT media_id FROM site_media_chunks')
      .all()
      .map(row => row.media_id),
    ['other']
  );
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
});
