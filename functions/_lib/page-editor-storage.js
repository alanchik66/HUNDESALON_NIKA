const HISTORY_LIMIT = 20;

export async function readPageEditor(db, locale, slug) {
  const row = await db.prepare(
    'SELECT live.revision AS published_revision, live.values_json, editor.revision AS editor_revision, editor.draft_json ' +
    'FROM (SELECT ? AS locale, ? AS slug) target ' +
    'LEFT JOIN site_page_copy live USING (locale, slug) LEFT JOIN site_page_editor editor USING (locale, slug)'
  ).bind(locale, slug).first();
  const published = { revision: row.published_revision ?? 0, values: JSON.parse(row.values_json ?? '{}') };
  return {
    published,
    draft: row.draft_json === null ? null : JSON.parse(row.draft_json),
    revision: row.editor_revision ?? published.revision,
  };
}

export async function listPageVersions(db, locale, slug) {
  const { results } = await db
    .prepare('SELECT revision, created_at FROM site_page_versions WHERE locale = ? AND slug = ? ORDER BY revision DESC LIMIT ?')
    .bind(locale, slug, HISTORY_LIMIT)
    .all();
  return [
    ...results.map(row => ({ revision: row.revision, createdAt: row.created_at === null ? null : new Date(row.created_at).toISOString() })),
    { revision: 0, createdAt: null },
  ];
}

export async function readPageVersion(db, locale, slug, version) {
  if (version === 0) return {};
  const row = await db
    .prepare('SELECT values_json FROM site_page_versions WHERE locale = ? AND slug = ? AND revision = ?')
    .bind(locale, slug, version)
    .first();
  return row ? JSON.parse(row.values_json) : null;
}

export async function writePageEditor(db, { locale, slug, state, draft, publish }) {
  const operation = crypto.randomUUID();
  const revision = state.revision + 1;
  const update = db
    .prepare(
      'INSERT INTO site_page_editor (locale, slug, revision, draft_json, operation_id) VALUES (?, ?, ?, ?, ?) ' +
      'ON CONFLICT (locale, slug) DO UPDATE SET revision = excluded.revision, draft_json = excluded.draft_json, ' +
      'operation_id = excluded.operation_id WHERE site_page_editor.revision = ?'
    )
    .bind(locale, slug, revision, draft, operation, state.revision);
  if (publish === null) return (await update.run()).meta?.changes === 1;

  // Only the winner of the optimistic lock owns the operation token for the rest of the transaction.
  const ownsLock = 'EXISTS (SELECT 1 FROM site_page_editor WHERE locale = ? AND slug = ? AND operation_id = ?)';
  const publishedRevision = state.published.revision + 1;
  const [saved] = await db.batch([
    update,
    db.prepare(
      'INSERT INTO site_page_copy (locale, slug, revision, values_json) SELECT ?, ?, ?, ? WHERE ' + ownsLock + ' ' +
      'ON CONFLICT (locale, slug) DO UPDATE SET revision = excluded.revision, values_json = excluded.values_json'
    ).bind(locale, slug, publishedRevision, publish, locale, slug, operation),
    db.prepare(
      'INSERT INTO site_page_versions (locale, slug, revision, values_json, created_at) ' +
      'SELECT ?, ?, ?, ?, ? WHERE ' + ownsLock
    ).bind(locale, slug, publishedRevision, publish, Date.now(), locale, slug, operation),
    db.prepare(
      'DELETE FROM site_page_versions WHERE locale = ? AND slug = ? AND revision <= ? AND ' + ownsLock
    ).bind(locale, slug, publishedRevision - HISTORY_LIMIT, locale, slug, operation),
  ]);
  return saved.meta?.changes === 1;
}
