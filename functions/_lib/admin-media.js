import { Buffer } from 'node:buffer';
import { PAGE_LABELS, validLocale } from './page-copy.js';
import { sectionForPath } from './site-settings.js';

const MIB = 1024 * 1024;
const CHUNK_SIZE = 256 * 1024;
const READ_WINDOW = 16 * CHUNK_SIZE;
const MAX_ITEMS = 120;
const MAX_PAGE_ITEMS = 24;
// Base64 adds a third to the raw size. Leave capacity for the site's other D1 tables.
export const SITE_MEDIA_LIBRARY_LIMIT = 325_000_000;
export const siteMediaUsedBytesSql =
  '((SELECT coalesce(sum(byte_size), 0) FROM site_media) + ' +
  '(SELECT coalesce(sum(before_size + after_size), 0) FROM site_comparisons WHERE before_media_id IS NULL))';
const UPLOAD_TTL = 24 * 60 * 60 * 1000;
const listFields = 'id, locale, slug, title, alt, mime, byte_size, published, revision, created_at, updated_at';

export const SITE_MEDIA_DIRECT_LIMITS = Object.freeze({
  'image/jpeg': 4 * MIB,
  'image/png': 4 * MIB,
  'image/webp': 4 * MIB,
  'video/mp4': 12 * MIB,
  'video/webm': 12 * MIB,
});
const documentExtensions = Object.freeze({
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt',
});
export const SITE_MEDIA_LIMITS = Object.freeze(
  Object.fromEntries([...Object.keys(SITE_MEDIA_DIRECT_LIMITS), ...Object.keys(documentExtensions)]
    .map(mime => [mime, 150_000_000]))
);
export const SITE_MEDIA_UPLOAD_CHUNK_SIZE = 4 * CHUNK_SIZE;

export const validSiteMediaId = id =>
  typeof id === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id);
export const validSiteMediaPage = (locale, slug) =>
  validLocale(locale) && (slug === 'promotions' || PAGE_LABELS.has(slug));

export function siteMediaPageVisible(state, locale, slug) {
  return validSiteMediaPage(locale, slug) && state.sections[sectionForPath('/' + locale + '/' + slug)] !== false;
}

function boundedText(value, limit, required = true) {
  if (typeof value !== 'string' || /\p{Cc}/u.test(value)) return null;
  const text = value.trim();
  return text.length <= limit && (text || !required) ? text : null;
}

export function siteMediaMetadata(input) {
  const title = boundedText(input.title, 120);
  const alt = boundedText(input.alt, 250, false);
  return title && alt !== null ? { title, alt } : null;
}

const bytesAt = (bytes, offset, signature) => signature.every((byte, index) => bytes[offset + index] === byte);
const wordAt = (bytes, offset, value) =>
  [...value].every((char, index) => bytes[offset + index] === char.charCodeAt(0));
const boundedDimensions = (width, height) =>
  width > 0 && height > 0 && width <= 8192 && height <= 8192 && width * height <= 32 * MIB;

function* jpegFrame(size) {
  let offset = 2;
  for (let count = 0; offset + 4 < size && count < 4096; count++) {
    const bytes = yield offset;
    if (bytes[0] !== 0xff) return false;
    const marker = bytes[1];
    if (marker === 0xff) {
      offset++;
      continue;
    }
    if (marker < 0xc0 || marker === 0xd9 || marker === 0xda) return false;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const length = view.getUint16(2);
    if (length < 2 || offset + 2 + length > size) return false;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return length >= 8 && bytes.length >= 9 && boundedDimensions(view.getUint16(7), view.getUint16(5));
    }
    offset += 2 + length;
  }
  return false;
}

function jpegDimensions(bytes) {
  if (!bytesAt(bytes, 0, [0xff, 0xd8, 0xff]) || !bytesAt(bytes, bytes.length - 2, [0xff, 0xd9])) return false;
  const frame = jpegFrame(bytes.length);
  let segment = frame.next();
  while (!segment.done) segment = frame.next(bytes.subarray(segment.value, segment.value + 9));
  return segment.value;
}

function pngDimensions(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return bytesAt(bytes, 0, [137, 80, 78, 71, 13, 10, 26, 10]) &&
    view.getUint32(8) === 13 && wordAt(bytes, 12, 'IHDR') &&
    boundedDimensions(view.getUint32(16), view.getUint32(20));
}

function webpDimensions(bytes, view, size = bytes.length) {
  if (!wordAt(bytes, 0, 'RIFF') || !wordAt(bytes, 8, 'WEBP') || view.getUint32(4, true) !== size - 8) {
    return false;
  }
  const chunkSize = view.getUint32(16, true);
  if (chunkSize + 20 > size) return false;
  if (wordAt(bytes, 12, 'VP8X') && chunkSize === 10) {
    const extent = offset => 1 + bytes[offset] + bytes[offset + 1] * 256 + bytes[offset + 2] * 65536;
    return boundedDimensions(extent(24), extent(27));
  }
  if (wordAt(bytes, 12, 'VP8L') && chunkSize >= 5 && bytes[20] === 0x2f) {
    const dimensions = view.getUint32(21, true);
    return boundedDimensions(1 + (dimensions & 0x3fff), 1 + ((dimensions >>> 14) & 0x3fff));
  }
  return (
    wordAt(bytes, 12, 'VP8 ') &&
    chunkSize >= 10 &&
    bytesAt(bytes, 23, [0x9d, 1, 0x2a]) &&
    boundedDimensions(view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff)
  );
}

function mp4BrandBoxSize(bytes) {
  const ftypSize = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
  if (!wordAt(bytes, 4, 'ftyp') || ftypSize < 16 || ftypSize > Math.min(1024, bytes.length) || ftypSize % 4) {
    return 0;
  }
  const brands = [
    'isom',
    'iso2',
    'iso4',
    'iso5',
    'iso6',
    'mp41',
    'mp42',
    'M4V ',
    'avc1',
    'hvc1',
    'hev1',
    'dash',
    'cmfc',
    'cmfs',
  ];
  let isMp4 = brands.some(brand => wordAt(bytes, 8, brand));
  for (let offset = 16; !isMp4 && offset < ftypSize; offset += 4) {
    isMp4 = brands.some(brand => wordAt(bytes, offset, brand));
  }
  return isMp4 ? ftypSize : 0;
}

function* mp4Boxes(size, firstBox, maxBoxes) {
  let moov = false;
  let mdat = false;
  for (let offset = firstBox, count = 0; offset + 8 <= size && count < maxBoxes; count++) {
    const bytes = yield offset;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let length = view.getUint32(0);
    let header = 8;
    if (length === 1) {
      if (bytes.length < 16 || view.getUint32(8) !== 0) return false;
      length = view.getUint32(12);
      header = 16;
    } else if (length === 0) length = size - offset;
    if (length < header || offset + length > size) return false;
    if (length > header) {
      moov ||= wordAt(bytes, 4, 'moov');
      mdat ||= wordAt(bytes, 4, 'mdat');
    }
    if (moov && mdat) return true;
    offset += length;
  }
  return false;
}

function validateMp4(bytes) {
  const firstBox = mp4BrandBoxSize(bytes);
  if (!firstBox) return false;
  const boxes = mp4Boxes(bytes.length, firstBox, 4096);
  let box = boxes.next();
  while (!box.done) box = boxes.next(bytes.subarray(box.value, box.value + 16));
  return box.value;
}

function validateWebm(bytes) {
  if (!bytesAt(bytes, 0, [0x1a, 0x45, 0xdf, 0xa3])) return false;
  const webmDocType = [0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d];
  for (let offset = 5; offset <= Math.min(511, bytes.length - webmDocType.length); offset++) {
    if (bytesAt(bytes, offset, webmDocType)) return true;
  }
  return false;
}

const pngEnd = [0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130];

export function validSiteMediaBytes(bytes, mime) {
  if (bytes.length < 32 || !Object.hasOwn(SITE_MEDIA_DIRECT_LIMITS, mime) || bytes.length > SITE_MEDIA_DIRECT_LIMITS[mime]) {
    return false;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
  switch (mime) {
    case 'image/jpeg':
      return jpegDimensions(bytes);
    case 'image/png':
      return pngDimensions(bytes) && bytesAt(bytes, bytes.length - pngEnd.length, pngEnd);
    case 'image/webp':
      return webpDimensions(bytes, view);
    case 'video/mp4':
      return validateMp4(bytes);
    case 'video/webm':
      return validateWebm(bytes);
    default:
      return false;
  }
}

function projection(row, owner = false) {
  const { id, locale, slug, title, alt, mime } = row;
  const item = {
    id,
    locale,
    slug,
    title,
    alt,
    mime,
    size: row.byte_size,
    published: row.published === 1,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    url: '/api/site-media?id=' + id,
  };
  return owner ? { ...item, revision: row.revision, previewUrl: '/api/admin/media?id=' + id } : item;
}

export const missingSiteMediaTable = error =>
  /no such table:\s*(?:main\.)?site_media(?:_chunks)?\b/i.test(String(error?.message));

export async function listOwnerSiteMedia(db, locale, slug) {
  const { results } = await db
    .prepare(
      'SELECT ' +
        listFields +
        ' FROM site_media WHERE upload_until IS NULL AND for_comparison = 0 ' +
        'AND (? IS NULL OR locale = ?) AND (? IS NULL OR slug = ?) ' +
        'ORDER BY created_at DESC, id DESC LIMIT ?'
    )
    .bind(locale, locale, slug, slug, MAX_ITEMS)
    .all();
  return results.map(row => projection(row, true));
}

export async function listPublishedSiteMedia(db, locale, slug) {
  if (!db || !validSiteMediaPage(locale, slug)) return [];
  try {
    const { results } = await db
      .prepare(
        'SELECT ' +
          listFields +
          ' FROM site_media WHERE locale = ? AND slug = ? AND published = 1 ' +
          'ORDER BY created_at DESC, id DESC LIMIT ?'
      )
      .bind(locale, slug, MAX_PAGE_ITEMS)
      .all();
    return results.map(row => projection(row));
  } catch (error) {
    if (missingSiteMediaTable(error)) return [];
    throw error;
  }
}

export function findSiteMedia(db, id, publishedOnly = false) {
  const filter = publishedOnly ? ' AND published = 1' : '';
  return db
    .prepare('SELECT ' + listFields + ' FROM site_media WHERE id = ? AND upload_until IS NULL AND for_comparison = 0' + filter)
    .bind(id)
    .first();
}

export function appendMediaChunks(batch, bytes, prepareChunk) {
  for (let offset = 0; offset < bytes.byteLength; offset += CHUNK_SIZE) {
    const length = Math.min(CHUNK_SIZE, bytes.byteLength - offset);
    const chunk = Buffer.from(bytes.buffer, bytes.byteOffset + offset, length);
    batch.push(prepareChunk(offset / CHUNK_SIZE, chunk.toString('base64')));
  }
}

function reserveMedia(db, row, uploadUntil = null) {
  return db
    .prepare(
      'INSERT INTO site_media (id, locale, slug, title, alt, mime, byte_size, created_at, updated_at, upload_until, for_comparison) ' +
        'SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ' +
        '(SELECT count(*) FROM site_media) < ? AND ' +
        siteMediaUsedBytesSql + ' + ? <= ? AND ' +
        '(? = 1 OR (SELECT count(*) FROM site_media WHERE locale = ? AND slug = ? AND for_comparison = 0) < ?)'
    )
    .bind(
      row.id,
      row.locale,
      row.slug,
      row.title,
      row.alt,
      row.mime,
      row.byte_size,
      row.created_at,
      row.updated_at,
      uploadUntil,
      row.for_comparison,
      MAX_ITEMS,
      row.byte_size,
      SITE_MEDIA_LIBRARY_LIMIT,
      row.for_comparison,
      row.locale,
      row.slug,
      MAX_PAGE_ITEMS
    );
}

function newDraft({ locale, slug, title, alt, mime, size, forComparison = false }) {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    locale,
    slug,
    title,
    alt,
    mime,
    byte_size: size,
    published: 0,
    revision: 1,
    created_at: now,
    updated_at: now,
    for_comparison: Number(forComparison),
  };
}

const unlinkedComparisonFile = 'for_comparison = 1 AND NOT EXISTS (' +
  'SELECT 1 FROM site_comparisons WHERE before_media_id = site_media.id OR after_media_id = site_media.id)';

const purgeExpired = (db, now) => db.prepare('DELETE FROM site_media WHERE upload_until <= ? OR (' +
  'created_at <= ? AND ' + unlinkedComparisonFile + ')').bind(now, now - UPLOAD_TTL);

export async function storeSiteMedia(db, { bytes, ...metadata }) {
  const row = newDraft({ ...metadata, size: bytes.byteLength });
  // Evaluate the caps in the insert itself so concurrent uploads share the same limits.
  const batch = [purgeExpired(db, row.created_at), reserveMedia(db, row)];
  appendMediaChunks(batch, bytes, (ordinal, payload) =>
    db
      .prepare(
        'INSERT INTO site_media_chunks (media_id, ordinal, payload) ' +
          'SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM site_media WHERE id = ?)'
      )
      .bind(row.id, ordinal, payload, row.id)
  );
  const [, inserted] = await db.batch(batch);
  return inserted.meta?.changes === 1 ? projection(row, true) : null;
}

export async function beginSiteMediaUpload(db, metadata) {
  const row = newDraft(metadata);
  const [, inserted] = await db.batch([
    purgeExpired(db, row.created_at),
    reserveMedia(db, row, row.created_at + UPLOAD_TTL),
  ]);
  return inserted.meta?.changes === 1 ? row.id : null;
}

export function findSiteMediaUpload(db, id) {
  return db
    .prepare('SELECT ' + listFields + ', upload_until FROM site_media WHERE id = ?')
    .bind(id)
    .first();
}

export async function storeSiteMediaPart(db, row, part, bytes) {
  const first = (part * SITE_MEDIA_UPLOAD_CHUNK_SIZE) / CHUNK_SIZE;
  const now = Date.now();
  const batch = [];
  appendMediaChunks(batch, bytes, (offset, payload) =>
    db
      .prepare(
        'INSERT INTO site_media_chunks (media_id, ordinal, payload) ' +
          'SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM site_media WHERE id = ? AND upload_until > ?) ' +
          'ON CONFLICT (media_id, ordinal) DO UPDATE SET payload = excluded.payload ' +
          'WHERE site_media_chunks.payload = excluded.payload'
      )
      .bind(row.id, first + offset, payload, row.id, now)
  );
  const results = await db.batch(batch);
  return results.every(result => result.meta?.changes === 1);
}

export async function completeSiteMediaUpload(db, row) {
  if (row.upload_until === null) return { item: projection(row, true) };
  const expected = Math.ceil(row.byte_size / CHUNK_SIZE);
  const total = await db
    .prepare('SELECT count(*) AS count FROM site_media_chunks WHERE media_id = ?')
    .bind(row.id)
    .first();
  if (total.count !== expected) return { error: 'incomplete_upload' };
  if (!(await validUploadedMedia(row, siteMediaChunks(db, row.id)))) return { error: 'invalid_media' };
  const now = Date.now();
  await db
    .prepare('UPDATE site_media SET upload_until = NULL, updated_at = ? WHERE id = ? AND upload_until > ?')
    .bind(now, row.id, now)
    .run();
  const finished = await findSiteMediaUpload(db, row.id);
  return finished?.upload_until === null ? { item: projection(finished, true) } : { error: 'upload_expired' };
}

export function abortSiteMediaUpload(db, id) {
  return db.prepare('DELETE FROM site_media WHERE id = ? AND (upload_until IS NOT NULL OR (' +
    unlinkedComparisonFile + '))').bind(id).run();
}

export async function updateSiteMedia(db, row, { locale, slug, title, alt, published }) {
  const now = Date.now();
  const samePage = row.locale === locale && row.slug === slug;
  const result = await db
    .prepare(
      'UPDATE site_media SET locale = ?, slug = ?, title = ?, alt = ?, published = ?, updated_at = ?, revision = revision + 1 ' +
        'WHERE id = ? AND revision = ? AND (? = 1 OR ' +
        '(SELECT count(*) FROM site_media WHERE locale = ? AND slug = ? AND for_comparison = 0) < ?)'
    )
    .bind(
      locale,
      slug,
      title,
      alt,
      Number(published),
      now,
      row.id,
      row.revision,
      Number(samePage),
      locale,
      slug,
      MAX_PAGE_ITEMS
    )
    .run();
  if (result.meta?.changes === 1) {
    return {
      item: projection(
        {
          ...row,
          locale,
          slug,
          title,
          alt,
          published: Number(published),
          updated_at: now,
          revision: row.revision + 1,
        },
        true
      ),
    };
  }
  const current = await findSiteMedia(db, row.id);
  if (!current) return { error: 'not_found' };
  return { error: current.revision !== row.revision ? 'revision_conflict' : 'media_limit' };
}

export async function deleteDraftSiteMedia(db, id) {
  const result = await db
    .prepare('DELETE FROM site_media WHERE id = ? AND published = 0 AND upload_until IS NULL AND for_comparison = 0')
    .bind(id)
    .run();
  // D1 can include the cascading chunk deletes in meta.changes.
  if (result.meta?.changes > 0) return null;
  return (await findSiteMedia(db, id)) ? 'unpublish_first' : 'not_found';
}

function responseRange(value, size) {
  if (!value) return { start: 0, end: size - 1, partial: false };
  const match = /^bytes=(\d*)-(\d*)$/i.exec(value);
  if (!match || (!match[1] && !match[2])) return null;
  const left = match[1] ? Number(match[1]) : null;
  const right = match[2] ? Number(match[2]) : null;
  if ((left !== null && !Number.isSafeInteger(left)) || (right !== null && !Number.isSafeInteger(right))) return null;
  if (left === null) return right > 0 ? { start: Math.max(0, size - right), end: size - 1, partial: true } : null;
  const end = Math.min(right ?? size - 1, size - 1);
  return left <= end ? { start: left, end, partial: true } : null;
}

async function loadMediaRange(readChunks, size, start, end) {
  const first = Math.floor(start / CHUNK_SIZE);
  const last = Math.floor(end / CHUNK_SIZE);
  const { results } = await readChunks(first, last);
  if (results.length !== last - first + 1) throw new Error('Incomplete media');
  const buffer = new Uint8Array(end - start + 1);
  let offset = 0;
  for (const [index, { ordinal, payload }] of results.entries()) {
    const bytes = Buffer.from(payload, 'base64');
    const position = ordinal * CHUNK_SIZE;
    if (ordinal !== first + index || bytes.length !== Math.min(CHUNK_SIZE, size - position)) {
      throw new Error('Incomplete media');
    }
    const slice = bytes.subarray(Math.max(0, start - position), Math.min(CHUNK_SIZE, end + 1 - position));
    buffer.set(slice, offset);
    offset += slice.length;
  }
  return buffer;
}

function siteMediaChunks(db, id) {
  return (first, last) =>
    db
      .prepare(
        'SELECT ordinal, payload FROM site_media_chunks WHERE media_id = ? AND ordinal BETWEEN ? AND ? ORDER BY ordinal'
      )
      .bind(id, first, last)
      .all();
}

async function validateMediaOffsets(boxes, readChunks, size, bytes, headerSize) {
  let start = 0;
  let reads = 1;
  let box = boxes.next();
  while (!box.done) {
    const offset = box.value;
    const end = Math.min(offset + headerSize, size);
    if (offset < start || end > start + bytes.length) {
      // Leave room for authentication and commit within the free D1 subrequest limit.
      if (reads++ >= 36) return false;
      start = offset;
      bytes = await loadMediaRange(readChunks, size, start, Math.min(start + CHUNK_SIZE, size) - 1);
    }
    box = boxes.next(bytes.subarray(offset - start, end - start));
  }
  return box.value;
}

export function siteMediaMinimumSize(mime) {
  if (mime === 'text/plain') return 1;
  if (mime === 'application/pdf') return 8;
  return 32;
}

async function validUploadedMedia({ mime, byte_size: size }, readChunks) {
  const start = await loadMediaRange(readChunks, size, 0, Math.min(CHUNK_SIZE, size) - 1);
  const tail = length => loadMediaRange(readChunks, size, Math.max(0, size - length), size - 1);
  switch (mime) {
    case 'image/jpeg':
      return bytesAt(start, 0, [0xff, 0xd8, 0xff]) &&
        bytesAt(await tail(2), 0, [0xff, 0xd9]) &&
        (await validateMediaOffsets(jpegFrame(size), readChunks, size, start, 9));
    case 'image/png':
      return pngDimensions(start) && bytesAt(await tail(pngEnd.length), 0, pngEnd);
    case 'image/webp':
      return webpDimensions(start, new DataView(start.buffer), size);
    case 'video/webm':
      return validateWebm(start);
    case 'video/mp4': {
      const firstBox = mp4BrandBoxSize(start);
      return firstBox > 0 && (await validateMediaOffsets(mp4Boxes(size, firstBox, 4096), readChunks, size, start, 16));
    }
    case 'application/pdf':
      return wordAt(start, 0, '%PDF-') && new TextDecoder().decode(await tail(4096)).includes('%%EOF');
    case 'text/plain': {
      const sample = start.subarray(0, 64 * 1024);
      try {
        return !sample.includes(0) &&
          new TextDecoder('utf-8', { fatal: true }).decode(sample, { stream: sample.length < size }).length > 0;
      } catch {
        return false;
      }
    }
    default:
      // Office documents are ZIP containers. They are always served as attachments.
      return Object.hasOwn(documentExtensions, mime) && bytesAt(start, 0, [0x50, 0x4b, 0x03, 0x04]);
  }
}

export function siteMediaResponse(db, request, row) {
  return mediaBytesResponse(request, row.mime, row.byte_size, siteMediaChunks(db, row.id), row.title);
}

async function streamMediaRange(readChunks, size, start, end) {
  let offset = start;
  let first = await loadMediaRange(readChunks, size, offset, offset + READ_WINDOW - 1);
  const source = new ReadableStream({
    async pull(controller) {
      const bytes = first ?? (await loadMediaRange(readChunks, size, offset, Math.min(end, offset + READ_WINDOW - 1)));
      first = null;
      controller.enqueue(bytes);
      offset += bytes.length;
      if (offset > end) controller.close();
    },
  }, { highWaterMark: 0 });
  if (!globalThis.FixedLengthStream) return source;
  const { readable, writable } = new globalThis.FixedLengthStream(end - start + 1);
  // The response consumes the pipe. Disconnections and source errors also close its readable side.
  void source.pipeTo(writable).catch(() => {});
  return readable;
}

export async function mediaBytesResponse(request, mime, size, readChunks, title = '') {
  if (
    !Object.hasOwn(SITE_MEDIA_LIMITS, mime) ||
    !Number.isSafeInteger(size) ||
    size < 1 ||
    size > SITE_MEDIA_LIMITS[mime]
  ) {
    throw new Error('Invalid media record');
  }
  const headers = new Headers({
    'Content-Type': mime,
    'Cache-Control': 'private, no-store',
    'Accept-Ranges': 'bytes',
    'Content-Disposition': 'inline',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'Cross-Origin-Resource-Policy': 'same-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow',
    Vary: '*',
  });
  const extension = documentExtensions[mime];
  if (extension) {
    const cleanTitle = String(title).replace(/[\\/:*?"<>|]/g, '_').toWellFormed().trim() || 'document';
    const filename = cleanTitle.toLowerCase().endsWith('.' + extension) ? cleanTitle : cleanTitle + '.' + extension;
    const encoded = encodeURIComponent(filename).replace(/['()*]/g, char => '%' + char.charCodeAt(0).toString(16));
    headers.set('Content-Disposition', `attachment; filename="document.${extension}"; filename*=UTF-8''${encoded}`);
  }
  const range = responseRange(request.headers.has('If-Range') ? null : request.headers.get('Range'), size);
  if (!range) {
    headers.set('Content-Range', 'bytes */' + size);
    return new Response(null, { status: 416, headers });
  }
  const { start, end, partial } = range;
  headers.set('Content-Length', String(end - start + 1));
  if (partial) headers.set('Content-Range', 'bytes ' + start + '-' + end + '/' + size);
  let body = null;
  if (request.method !== 'HEAD') {
    body = end - start + 1 > READ_WINDOW
      ? await streamMediaRange(readChunks, size, start, end)
      : await loadMediaRange(readChunks, size, start, end);
  }
  return new Response(body, { status: partial ? 206 : 200, headers });
}
