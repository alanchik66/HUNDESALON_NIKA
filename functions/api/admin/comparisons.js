import { adminDatabase, adminJson, authorizeAdmin } from '../../_lib/site-admin-auth.js';
import { isRequestBodyTooLarge, readFormDataBody, readJsonBody } from '../../_lib/http-security.js';
import { validLocale } from '../../_lib/page-copy.js';
import { validSiteMediaId } from '../../_lib/admin-media.js';
import {
  GALLERY_COMPARISON_JSON_LIMIT,
  GALLERY_COMPARISON_UPLOAD_LIMIT,
  comparisonBytesResponse,
  comparisonImage,
  comparisonMetadata,
  deleteComparisonDraft,
  findComparison,
  listComparisons,
  storeComparison,
  storeLinkedComparison,
  updateComparison,
  validComparisonRevision,
  validComparisonSide,
} from '../../_lib/gallery-comparisons.js';

export { GALLERY_COMPARISON_UPLOAD_LIMIT } from '../../_lib/gallery-comparisons.js';

const contentType = request => request.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase();
const fail = (error, status) => adminJson({ error }, status);
const mutable = ['category', 'title', 'beforeAlt', 'afterAlt', 'published'];
const uploadFields = new Set(['locale', 'category', 'title', 'beforeAlt', 'afterAlt', 'before', 'after']);
const linkedFields = new Set(['locale', 'category', 'title', 'beforeAlt', 'afterAlt', 'beforeId', 'afterId']);
const methods = ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE'];

async function uploadMultipart(request, db) {
  let form;
  try {
    form = await readFormDataBody(request, GALLERY_COMPARISON_UPLOAD_LIMIT);
  } catch (error) {
    return isRequestBodyTooLarge(error) ? fail('too_large', 413) : fail('invalid_media', 400);
  }
  const keys = [...form.keys()];
  if (keys.length !== new Set(keys).size || keys.some(key => !uploadFields.has(key))) {
    return fail('invalid_metadata', 400);
  }
  const locale = form.get('locale');
  if (!validLocale(locale)) return fail('invalid_page', 400);
  const metadata = comparisonMetadata({
    category: form.get('category'),
    title: form.get('title'),
    beforeAlt: form.get('beforeAlt') ?? '',
    afterAlt: form.get('afterAlt') ?? '',
  });
  if (!metadata) return fail('invalid_metadata', 400);
  const sides = await Promise.all(['before', 'after'].map(side => comparisonImage(form.get(side))));
  const invalid = sides.find(side => side.error);
  if (invalid) {
    const status = invalid.error === 'too_large' ? 413 : invalid.error === 'unsupported_media_type' ? 415 : 400;
    return fail(invalid.error, status);
  }
  const item = await storeComparison(db, locale, metadata, ...sides);
  return item ? adminJson({ item }, 201) : fail('comparison_limit', 409);
}

async function uploadLinked(request, db) {
  let input;
  try {
    input = await readJsonBody(request, GALLERY_COMPARISON_JSON_LIMIT);
  } catch (error) {
    return isRequestBodyTooLarge(error) ? fail('too_large', 413) : fail('invalid_json', 400);
  }
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some(key => !linkedFields.has(key))) {
    return fail('invalid_metadata', 400);
  }
  const { locale, beforeId, afterId } = input;
  if (!validLocale(locale)) return fail('invalid_page', 400);
  if (!validSiteMediaId(beforeId) || !validSiteMediaId(afterId) || beforeId === afterId) {
    return fail('invalid_media_id', 400);
  }
  const metadata = comparisonMetadata({ beforeAlt: '', afterAlt: '', ...input });
  if (!metadata) return fail('invalid_metadata', 400);
  const { item, error } = await storeLinkedComparison(db, locale, metadata, beforeId, afterId);
  return item ? adminJson({ item }, 201) : fail(error, 409);
}

function upload(request, db) {
  const type = contentType(request);
  if (type === 'application/json') return uploadLinked(request, db);
  if (type === 'multipart/form-data') return uploadMultipart(request, db);
  return fail('multipart_required', 415);
}

async function change(request, db) {
  if (contentType(request) !== 'application/json') return fail('json_required', 415);
  let input;
  try {
    input = await readJsonBody(request, GALLERY_COMPARISON_JSON_LIMIT);
  } catch (error) {
    return isRequestBodyTooLarge(error) ? fail('too_large', 413) : fail('invalid_json', 400);
  }
  if (
    !input ||
    typeof input !== 'object' ||
    !validSiteMediaId(input.id) ||
    !validComparisonRevision(input.revision) ||
    !mutable.some(field => Object.hasOwn(input, field)) ||
    Object.keys(input).some(field => !['id', 'revision', ...mutable].includes(field))
  )
    return fail('invalid_metadata', 400);
  const row = await findComparison(db, input.id);
  if (!row) return fail('not_found', 404);
  if (input.revision !== row.revision) return fail('revision_conflict', 409);

  const values = {
    category: row.category,
    title: row.title,
    beforeAlt: row.before_alt,
    afterAlt: row.after_alt,
    published: row.published === 1,
  };
  for (const field of mutable) if (Object.hasOwn(input, field)) values[field] = input[field];
  const metadata = comparisonMetadata(values);
  if (!metadata || typeof values.published !== 'boolean') return fail('invalid_metadata', 400);
  if (values.published && (!metadata.beforeAlt || !metadata.afterAlt)) return fail('alt_required', 400);
  const item = await updateComparison(db, row, { ...metadata, published: values.published });
  return item ? adminJson({ item }) : fail('revision_conflict', 409);
}

async function remove(params, db) {
  const id = params.get('id');
  const revision = params.get('revision') ?? '';
  if (!validSiteMediaId(id)) return fail('not_found', 404);
  if (!/^[1-9]\d*$/.test(revision) || !validComparisonRevision(Number(revision))) {
    return fail('invalid_metadata', 400);
  }
  const error = await deleteComparisonDraft(db, id, Number(revision));
  return error ? fail(error, error === 'not_found' ? 404 : 409) : adminJson({ ok: true });
}

async function read(request, params, db) {
  if (params.has('id') || params.has('side')) {
    const id = params.get('id');
    const side = params.get('side');
    if (!validSiteMediaId(id) || !validComparisonSide(side)) return fail('not_found', 404);
    const row = await findComparison(db, id);
    return row ? comparisonBytesResponse(db, request, row, side) : fail('not_found', 404);
  }
  const locale = params.get('locale');
  if (!validLocale(locale)) return fail('invalid_page', 400);
  return adminJson({ items: await listComparisons(db, locale, true) });
}

export async function onRequest({ request, env }) {
  const denied = await authorizeAdmin(request, env);
  if (denied) return denied;
  if (!methods.includes(request.method)) return fail('method_not_allowed', 405);
  try {
    const db = adminDatabase(env);
    const params = new URL(request.url).searchParams;
    if (request.method === 'POST') return await upload(request, db);
    if (request.method === 'PATCH') return await change(request, db);
    if (request.method === 'DELETE') return await remove(params, db);
    const result = await read(request, params, db);
    return request.method === 'HEAD' ? new Response(null, result) : result;
  } catch {
    return fail('comparison_storage_unavailable', 503);
  }
}
