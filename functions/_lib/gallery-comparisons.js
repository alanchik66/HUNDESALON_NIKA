import {
  SITE_MEDIA_LIBRARY_LIMIT,
  appendMediaChunks,
  mediaBytesResponse,
  siteMediaMetadata,
  siteMediaResponse,
  siteMediaUsedBytesSql,
  validSiteMediaBytes,
} from './admin-media.js';

const MIB = 1024 * 1024;
const MAX_IMAGE_BYTES = 4 * MIB;
const MAX_LEGACY_STORAGE_BYTES = 96 * MIB;
const MAX_LOCALE_PAIRS = 24;
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const categories = new Set(['dogs', 'cats', 'smallAnimals', 'salon']);
const fields =
  'id, locale, category, title, before_alt, after_alt, before_mime, after_mime, before_size, after_size, published, revision, created_at, updated_at';
const legacyStorage =
  '(SELECT coalesce(sum(before_size + after_size), 0) FROM site_comparisons WHERE before_media_id IS NULL)';

export const GALLERY_COMPARISON_UPLOAD_LIMIT = 2 * MAX_IMAGE_BYTES + 16 * 1024;
export const GALLERY_COMPARISON_JSON_LIMIT = 4096;
export const validComparisonSide = side => side === 'before' || side === 'after';
export const validComparisonRevision = revision => Number.isSafeInteger(revision) && revision >= 1;

export function comparisonMetadata({ category, title, beforeAlt, afterAlt }) {
  if (!categories.has(category)) return null;
  const first = siteMediaMetadata({ title, alt: beforeAlt });
  const second = siteMediaMetadata({ title, alt: afterAlt });
  return first && second ? { category, title: first.title, beforeAlt: first.alt, afterAlt: second.alt } : null;
}

export async function comparisonImage(file) {
  if (!(file instanceof File)) return { error: 'invalid_media' };
  const mime = file.type.toLowerCase();
  if (!allowedTypes.has(mime)) return { error: 'unsupported_media_type' };
  if (file.size > MAX_IMAGE_BYTES) return { error: 'too_large' };
  const bytes = new Uint8Array(await file.arrayBuffer());
  return validSiteMediaBytes(bytes, mime) ? { mime, bytes } : { error: 'invalid_media' };
}

export const missingComparisonTable = error =>
  /no such table:\s*(?:main\.)?site_comparison(?:s|_chunks)\b/i.test(String(error?.message));

function projection(row, owner) {
  const query = '?id=' + row.id + '&side=';
  const item = {
    id: row.id,
    locale: row.locale,
    category: row.category,
    title: row.title,
    beforeAlt: row.before_alt,
    afterAlt: row.after_alt,
    beforeUrl: '/api/site-comparisons' + query + 'before',
    afterUrl: '/api/site-comparisons' + query + 'after',
    published: row.published === 1,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
  if (!owner) return item;
  return {
    ...item,
    revision: row.revision,
    beforePreviewUrl: '/api/admin/comparisons' + query + 'before',
    afterPreviewUrl: '/api/admin/comparisons' + query + 'after',
  };
}

export async function listComparisons(db, locale, owner = false) {
  const visibility = owner ? '' : ' AND published = 1';
  const { results } = await db
    .prepare(
      'SELECT ' +
        fields +
        ' FROM site_comparisons WHERE locale = ?' +
        visibility +
        ' ORDER BY created_at DESC, id DESC LIMIT ?'
    )
    .bind(locale, MAX_LOCALE_PAIRS)
    .all();
  return results.map(row => projection(row, owner));
}

export function findComparison(db, id, publishedOnly = false) {
  const visibility = publishedOnly ? ' AND published = 1' : '';
  return db
    .prepare('SELECT * FROM site_comparisons WHERE id = ?' + visibility)
    .bind(id)
    .first();
}

function projectDraft(id, locale, { category, title, beforeAlt, afterAlt }, now) {
  return projection(
    {
      id,
      locale,
      category,
      title,
      before_alt: beforeAlt,
      after_alt: afterAlt,
      published: 0,
      revision: 1,
      created_at: now,
      updated_at: now,
    },
    true
  );
}

export async function storeComparison(db, locale, metadata, before, after) {
  const id = crypto.randomUUID();
  const { category, title, beforeAlt, afterAlt } = metadata;
  const beforeSize = before.bytes.byteLength;
  const afterSize = after.bytes.byteLength;
  const now = Date.now();
  // One D1 transaction includes the quota check and every chunk for both images.
  const batch = [
    db
      .prepare(
        'INSERT INTO site_comparisons (id, locale, category, title, before_alt, after_alt, before_mime, after_mime, ' +
          'before_size, after_size, created_at, updated_at) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ' +
          '(SELECT count(*) FROM site_comparisons WHERE locale = ?) < ? AND ' +
          legacyStorage + ' + ? <= ? AND ' +
          siteMediaUsedBytesSql + ' + ? <= ?'
      )
      .bind(
        id,
        locale,
        category,
        title,
        beforeAlt,
        afterAlt,
        before.mime,
        after.mime,
        beforeSize,
        afterSize,
        now,
        now,
        locale,
        MAX_LOCALE_PAIRS,
        beforeSize + afterSize,
        MAX_LEGACY_STORAGE_BYTES,
        beforeSize + afterSize,
        SITE_MEDIA_LIBRARY_LIMIT
      ),
  ];
  for (const [side, image] of Object.entries({ before, after })) {
    appendMediaChunks(batch, image.bytes, (ordinal, payload) =>
      db
        .prepare(
          'INSERT INTO site_comparison_chunks (comparison_id, side, ordinal, payload) ' +
            'SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM site_comparisons WHERE id = ?)'
        )
        .bind(id, side, ordinal, payload, id)
    );
  }
  const [result] = await db.batch(batch);
  return result.meta?.changes === 1 ? projectDraft(id, locale, metadata, now) : null;
}

export async function storeLinkedComparison(db, locale, metadata, beforeId, afterId) {
  const id = crypto.randomUUID();
  const { category, title, beforeAlt, afterAlt } = metadata;
  const now = Date.now();
  // Both files are already charged to the media library. One write claims them together.
  const result = await db
    .prepare(
      'INSERT INTO site_comparisons (id, locale, category, title, before_alt, after_alt, before_mime, after_mime, ' +
        'before_size, after_size, created_at, updated_at, before_media_id, after_media_id) ' +
        'SELECT ?, b.locale, ?, ?, ?, ?, b.mime, a.mime, b.byte_size, a.byte_size, ?, ?, b.id, a.id ' +
        'FROM site_media b CROSS JOIN site_media a WHERE b.id = ? AND a.id = ? AND a.id <> b.id ' +
        'AND b.locale = ? AND a.locale = b.locale AND b.for_comparison = 1 AND a.for_comparison = 1 ' +
        'AND b.upload_until IS NULL AND a.upload_until IS NULL AND b.published = 0 AND a.published = 0 ' +
        "AND b.mime IN ('image/jpeg', 'image/png', 'image/webp') AND a.mime IN ('image/jpeg', 'image/png', 'image/webp') " +
        'AND (SELECT count(*) FROM site_comparisons WHERE locale = b.locale) < ? ' +
        'AND NOT EXISTS (SELECT 1 FROM site_comparisons WHERE before_media_id IN (b.id, a.id) OR after_media_id IN (b.id, a.id))'
    )
    .bind(id, category, title, beforeAlt, afterAlt, now, now, beforeId, afterId, locale, MAX_LOCALE_PAIRS)
    .run();
  if (result.meta?.changes === 1) return { item: projectDraft(id, locale, metadata, now) };
  const { count } = await db
    .prepare('SELECT count(*) AS count FROM site_comparisons WHERE locale = ?')
    .bind(locale)
    .first();
  return { error: count >= MAX_LOCALE_PAIRS ? 'comparison_limit' : 'media_unavailable' };
}

export async function updateComparison(db, row, { category, title, beforeAlt, afterAlt, published }) {
  const now = Date.now();
  const result = await db
    .prepare(
      'UPDATE site_comparisons SET category = ?, title = ?, before_alt = ?, after_alt = ?, published = ?, ' +
        'updated_at = ?, revision = revision + 1 WHERE id = ? AND revision = ?'
    )
    .bind(category, title, beforeAlt, afterAlt, Number(published), now, row.id, row.revision)
    .run();
  return result.meta?.changes === 1
    ? projection(
        {
          ...row,
          category,
          title,
          before_alt: beforeAlt,
          after_alt: afterAlt,
          published: Number(published),
          revision: row.revision + 1,
          updated_at: now,
        },
        true
      )
    : null;
}

export async function deleteComparisonDraft(db, id, revision) {
  const result = await db
    .prepare('DELETE FROM site_comparisons WHERE id = ? AND revision = ? AND published = 0')
    .bind(id, revision)
    .run();
  if (result.meta?.changes > 0) return null;
  const current = await findComparison(db, id);
  if (!current) return 'not_found';
  return current.revision !== revision ? 'revision_conflict' : 'unpublish_first';
}

export function comparisonBytesResponse(db, request, row, side) {
  const [mime, size] = side === 'before' ? [row.before_mime, row.before_size] : [row.after_mime, row.after_size];
  const mediaId = side === 'before' ? row.before_media_id : row.after_media_id;
  if (mediaId) return siteMediaResponse(db, request, { id: mediaId, mime, byte_size: size, title: row.title });
  return mediaBytesResponse(request, mime, size, (first, last) =>
    db
      .prepare(
        'SELECT ordinal, payload FROM site_comparison_chunks WHERE comparison_id = ? AND side = ? ' +
          'AND ordinal BETWEEN ? AND ? ORDER BY ordinal'
      )
      .bind(row.id, side, first, last)
      .all()
  );
}
