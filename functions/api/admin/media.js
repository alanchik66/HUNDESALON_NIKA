import { adminDatabase, adminJson, authorizeAdmin } from '../../_lib/site-admin-auth.js';
import { isRequestBodyTooLarge, readBoundedBodyBytes, readJsonBody } from '../../_lib/http-security.js';
import { PAGE_LABELS, validLocale } from '../../_lib/page-copy.js';
import {
  SITE_MEDIA_DIRECT_LIMITS,
  SITE_MEDIA_LIMITS,
  SITE_MEDIA_UPLOAD_CHUNK_SIZE,
  abortSiteMediaUpload,
  beginSiteMediaUpload,
  completeSiteMediaUpload,
  deleteDraftSiteMedia,
  findSiteMedia,
  findSiteMediaUpload,
  listOwnerSiteMedia,
  siteMediaMetadata,
  siteMediaMinimumSize,
  siteMediaResponse,
  storeSiteMedia,
  storeSiteMediaPart,
  updateSiteMedia,
  validSiteMediaBytes,
  validSiteMediaId,
  validSiteMediaPage,
} from '../../_lib/admin-media.js';

const contentType = request => request.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase();
const fail = (error, status) => adminJson({ error }, status);
const mutableFields = ['title', 'alt', 'locale', 'slug', 'published'];
const methods = ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE'];

async function upload(request, db, params) {
  const mime = contentType(request);
  if (!Object.hasOwn(SITE_MEDIA_DIRECT_LIMITS, mime)) return fail('unsupported_media_type', 415);
  const locale = params.get('locale');
  const slug = params.get('slug');
  if (!validSiteMediaPage(locale, slug)) return fail('invalid_page', 400);
  const metadata = siteMediaMetadata({ title: params.get('title'), alt: params.get('alt') ?? '' });
  if (!metadata) return fail('invalid_metadata', 400);
  let bytes;
  try {
    bytes = await readBoundedBodyBytes(request, SITE_MEDIA_DIRECT_LIMITS[mime]);
  } catch (error) {
    return isRequestBodyTooLarge(error) ? fail('too_large', 413) : fail('invalid_media', 400);
  }
  if (!validSiteMediaBytes(bytes, mime)) return fail('invalid_media', 400);
  const item = await storeSiteMedia(db, { locale, slug, mime, bytes, ...metadata });
  return item ? adminJson({ item }, 201) : fail('media_limit', 409);
}

async function beginUpload(db, params) {
  const mime = params.get('mime');
  if (!Object.hasOwn(SITE_MEDIA_LIMITS, mime)) return fail('unsupported_media_type', 415);
  const size = Number(params.get('size'));
  if (!Number.isSafeInteger(size) || size < siteMediaMinimumSize(mime)) return fail('invalid_media', 400);
  if (size > SITE_MEDIA_LIMITS[mime]) return fail('too_large', 413);
  const locale = params.get('locale');
  const slug = params.get('slug');
  if (!validSiteMediaPage(locale, slug)) return fail('invalid_page', 400);
  const forComparison = params.get('comparison') === '1';
  if (params.has('comparison') && (!forComparison || slug !== 'do-i-posle' || !mime.startsWith('image/'))) {
    return fail('invalid_media', 400);
  }
  const metadata = siteMediaMetadata({ title: params.get('title'), alt: params.get('alt') ?? '' });
  if (!metadata) return fail('invalid_metadata', 400);
  const id = await beginSiteMediaUpload(db, { locale, slug, mime, size, forComparison, ...metadata });
  return id ? adminJson({ upload_id: id, chunk_size: SITE_MEDIA_UPLOAD_CHUNK_SIZE }, 201) : fail('media_limit', 409);
}

async function uploadPart(request, db, row, params) {
  if (row.upload_until === null) return fail('upload_closed', 409);
  if (contentType(request) !== 'application/octet-stream') return fail('unsupported_media_type', 415);
  const ordinal = params.get('part');
  const part = Number(ordinal);
  const remaining = row.byte_size - part * SITE_MEDIA_UPLOAD_CHUNK_SIZE;
  if (!/^\d+$/.test(ordinal ?? '') || !Number.isSafeInteger(part) || remaining <= 0) return fail('invalid_part', 400);
  const expected = Math.min(SITE_MEDIA_UPLOAD_CHUNK_SIZE, remaining);
  let bytes;
  try {
    bytes = await readBoundedBodyBytes(request, expected);
  } catch (error) {
    return isRequestBodyTooLarge(error) ? fail('too_large', 413) : fail('invalid_part', 400);
  }
  if (bytes.length !== expected) return fail('invalid_part', 400);
  return (await storeSiteMediaPart(db, row, part, bytes)) ? adminJson({ ok: true }) : fail('part_conflict', 409);
}

async function uploadChunks(request, db, params) {
  const action = params.get('action');
  if (!['begin', 'chunk', 'finish', 'abort'].includes(action)) return fail('invalid_action', 400);
  if (action !== 'chunk') {
    try {
      if (request.headers.has('Content-Type') || (await readBoundedBodyBytes(request, 1)).length) {
        return fail('empty_body_required', 400);
      }
    } catch {
      return fail('empty_body_required', 400);
    }
  }
  if (action === 'begin') return beginUpload(db, params);
  const id = params.get('upload_id');
  if (!validSiteMediaId(id)) return fail('not_found', 404);
  if (action === 'abort') {
    await abortSiteMediaUpload(db, id);
    return adminJson({ ok: true });
  }
  const row = await findSiteMediaUpload(db, id);
  if (!row || (row.upload_until !== null && row.upload_until <= Date.now())) return fail('upload_expired', 404);
  if (action === 'chunk') return uploadPart(request, db, row, params);
  const result = await completeSiteMediaUpload(db, row);
  if (result.error === 'invalid_media') return fail(result.error, 400);
  return result.item ? adminJson(result, 201) : fail(result.error, 409);
}

async function change(request, db) {
  if (contentType(request) !== 'application/json') return fail('json_required', 415);
  let input;
  try {
    input = await readJsonBody(request, 4096);
  } catch (error) {
    return isRequestBodyTooLarge(error) ? fail('too_large', 413) : fail('invalid_json', 400);
  }
  if (
    !input ||
    typeof input !== 'object' ||
    !validSiteMediaId(input.id) ||
    !mutableFields.some(field => Object.hasOwn(input, field)) ||
    Object.keys(input).some(field => !['id', 'revision', ...mutableFields].includes(field))
  ) {
    return fail('invalid_metadata', 400);
  }
  const row = await findSiteMedia(db, input.id);
  if (!row) return fail('not_found', 404);
  if (Object.hasOwn(input, 'revision')) {
    if (!Number.isSafeInteger(input.revision) || input.revision < 1) return fail('invalid_metadata', 400);
    if (row.revision !== input.revision) return fail('revision_conflict', 409);
  }
  const next = { locale: row.locale, slug: row.slug, title: row.title, alt: row.alt, published: row.published === 1 };
  for (const field of mutableFields) if (Object.hasOwn(input, field)) next[field] = input[field];
  if (!validSiteMediaPage(next.locale, next.slug)) return fail('invalid_page', 400);
  const metadata = siteMediaMetadata(next);
  if (!metadata || typeof next.published !== 'boolean') return fail('invalid_metadata', 400);
  if (next.published && row.mime.startsWith('image/') && !metadata.alt) return fail('alt_required', 400);
  const result = await updateSiteMedia(db, row, { ...next, ...metadata });
  return result.item ? adminJson(result) : fail(result.error, result.error === 'not_found' ? 404 : 409);
}

async function read(request, db, params) {
  if (params.has('id')) {
    const id = params.get('id');
    if (!validSiteMediaId(id)) return fail('not_found', 404);
    const row = await findSiteMedia(db, id);
    return row ? siteMediaResponse(db, request, row) : fail('not_found', 404);
  }
  const locale = params.get('locale');
  const slug = params.get('slug');
  if (
    (locale !== null && !validLocale(locale)) ||
    (slug !== null && !(slug === 'promotions' || PAGE_LABELS.has(slug)))
  ) {
    return fail('invalid_page', 400);
  }
  const result = adminJson({ items: await listOwnerSiteMedia(db, locale, slug) });
  return request.method === 'HEAD' ? new Response(null, result) : result;
}

export async function onRequest({ request, env }) {
  const denied = await authorizeAdmin(request, env);
  if (denied) return denied;
  if (!methods.includes(request.method)) return fail('method_not_allowed', 405);
  try {
    const db = adminDatabase(env);
    const params = new URL(request.url).searchParams;
    switch (request.method) {
      case 'POST':
        return params.has('action') ? await uploadChunks(request, db, params) : await upload(request, db, params);
      case 'PATCH':
        return await change(request, db);
      case 'DELETE': {
        const id = params.get('id');
        if (!validSiteMediaId(id)) return fail('not_found', 404);
        const error = await deleteDraftSiteMedia(db, id);
        return error ? fail(error, error === 'not_found' ? 404 : 409) : adminJson({ ok: true });
      }
      default:
        return await read(request, db, params);
    }
  } catch {
    return fail('media_storage_unavailable', 503);
  }
}
