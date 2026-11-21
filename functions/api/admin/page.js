import { adminDatabase, adminJson, authorizeAdmin } from '../../_lib/site-admin-auth.js';
import { isRequestBodyTooLarge, readJsonBody } from '../../_lib/http-security.js';
import { copyFields, escapeCopy, renderPageCopy, validPageCopyValue } from '../../_lib/page-copy.js';
import { pageEditorAssetPath, pageEditorPath } from '../../_lib/page-editor-catalog.js';
import { listPageVersions, readPageEditor, readPageVersion, writePageEditor } from '../../_lib/page-editor-storage.js';
import { renderTelegramEditorPreview, telegramEditorFields } from '../../_lib/page-editor-telegram.js';

const MAX_BYTES = 128000;
const actions = new Set(['save_draft', 'publish', 'discard_draft', 'restore']);
const invalid = (error, status = 400) => adminJson({ error }, status);

async function readPageAsset(env, request, path, assetPath) {
  for (const candidate of [path, assetPath]) {
    const asset = await env.ASSETS.fetch(new URL(candidate, request.url));
    if (asset.ok && asset.headers.get('content-type')?.includes('text/html')) return asset.text();
    await asset.body?.cancel();
  }
  throw new Error('Page asset unavailable');
}

function previewPage(html, path, locale, slug, values) {
  let page = slug === 'telegram-menu' ? renderTelegramEditorPreview(html, locale, values) : renderPageCopy(html, values);
  if (slug === 'prays-list') {
    const originals = new Map(copyFields(html).filter(field => field.id.startsWith('price-')).map(field => [field.id, field.original]));
    const text = key => escapeCopy(values['price-' + key] ?? originals.get('price-' + key) ?? '');
    const hero = '<div class="price-page-hero__copy">' +
      `<p class="section-kicker">${text('herokicker')}</p>` +
      `<h1 class="section-title">${text('herotitle')}</h1>` +
      `<p class="price-page-hero__lead">${text('herolead')}</p>` +
      `<p class="price-page-hero__note">${text('heronote')}</p></div>`;
    page = page.replace(/(<section\b[^>]*\bdata-price-hero[^>]*>)<\/section>/, (_, open) => open + hero + '</section>');
  }
  page = page.replace(/<head\b[^>]*>/i, head => `${head}<base href="${path}">`);
  return new Response(page, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow',
      'Content-Security-Policy': "sandbox; default-src 'none'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: https:; media-src 'self'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'",
    },
  });
}

async function snapshot(db, locale, slug, path, fields, state) {
  const { draft, published, revision } = state;
  const active = draft ?? published.values;
  const query = new URLSearchParams({ locale, slug, view: 'preview' });
  return {
    locale,
    slug,
    revision,
    publishedRevision: published.revision,
    hasDraft: draft !== null,
    url: path,
    previewUrl: '/api/admin/page?' + query,
    versions: await listPageVersions(db, locale, slug),
    fields: fields.map(field => ({
      ...field,
      value: active[field.id] ?? field.original,
      published: published.values[field.id] ?? field.original,
    })),
  };
}

async function applyChange(db, state, fields, input) {
  const action = input.action;
  if (!actions.has(action) || !Number.isSafeInteger(input.revision) || input.revision < 0) return invalid('invalid_changes');
  if (input.revision !== state.revision) return invalid('revision_conflict', 409);
  const { locale, slug } = input;
  let values = null;
  if (action === 'restore') {
    if (!Number.isSafeInteger(input.version) || input.version < 0) return invalid('invalid_changes');
    values = await readPageVersion(db, locale, slug, input.version);
    if (values === null) return invalid('version_not_found', 404);
  } else if (action !== 'discard_draft') {
    const changes = input.values ?? {};
    if (typeof changes !== 'object' || Array.isArray(changes)) return invalid('invalid_changes');
    const byId = new Map(fields.map(field => [field.id, field]));
    values = { ...(state.draft ?? state.published.values) };
    for (const [id, text] of Object.entries(changes)) {
      const field = byId.get(id);
      if (!field || !validPageCopyValue(field, text)) return adminJson({ error: 'invalid_field', field: id }, 400);
      const value = text.trim();
      if (!value || value === field.original) delete values[id];
      else values[id] = value;
    }
  }
  const encoded = values === null ? null : JSON.stringify(values);
  if (encoded !== null && new TextEncoder().encode(encoded).length > MAX_BYTES) return invalid('too_large', 413);
  const publish = action === 'publish' ? encoded : null;
  const draft = publish === null ? encoded : null;
  const saved = await writePageEditor(db, { locale, slug, state, draft, publish });
  return saved ? null : invalid('revision_conflict', 409);
}

export async function onRequest({ request, env }) {
  const denied = await authorizeAdmin(request, env);
  if (denied) return denied;
  if (!['PATCH', 'GET'].includes(request.method)) return invalid('method_not_allowed', 405);
  const write = request.method === 'PATCH';
  const url = new URL(request.url);
  let input;
  if (write) {
    if (request.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
      return invalid('json_required', 415);
    }
    try {
      input = await readJsonBody(request, MAX_BYTES);
    } catch (error) {
      return isRequestBodyTooLarge(error) ? invalid('too_large', 413) : invalid('invalid_json');
    }
  } else {
    input = Object.fromEntries(url.searchParams);
  }
  const { locale, slug } = input ?? {};
  const path = pageEditorPath(locale, slug);
  if (!path) return invalid('invalid_page');
  try {
    const db = adminDatabase(env);
    const [html, state] = await Promise.all([
      readPageAsset(env, request, path, pageEditorAssetPath(locale, slug)),
      readPageEditor(db, locale, slug),
    ]);
    if (!write && input.view === 'preview') return previewPage(html, path, locale, slug, state.draft ?? state.published.values);
    const fields = slug === 'telegram-menu' ? telegramEditorFields(html, locale) : copyFields(html);
    if (!fields.length) throw new Error('Page requires a build with editable content');
    if (!write) return adminJson(await snapshot(db, locale, slug, path, fields, state));
    const error = await applyChange(db, state, fields, input);
    if (error) return error;
    return adminJson(await snapshot(db, locale, slug, path, fields, await readPageEditor(db, locale, slug)));
  } catch {
    return invalid('page_storage_unavailable', 503);
  }
}
