import { adminDatabase, adminJson } from '../_lib/site-admin-auth.js';
import {
  findSiteMedia,
  listPublishedSiteMedia,
  missingSiteMediaTable,
  siteMediaPageVisible,
  siteMediaResponse,
  validSiteMediaId,
  validSiteMediaPage,
} from '../_lib/admin-media.js';
import { readSiteSettings } from '../_lib/site-settings.js';

const fail = (error, status) => adminJson({ error }, status);
const jsonFor = (request, result) => (request.method === 'HEAD' ? new Response(null, result) : result);
const notFound = request => jsonFor(request, fail('not_found', 404));

export async function onRequest({ request, env }) {
  if (!['GET', 'HEAD'].includes(request.method)) return fail('method_not_allowed', 405);
  if (!env?.CHAT_DB) return notFound(request);
  try {
    const db = adminDatabase(env);
    const params = new URL(request.url).searchParams;
    if (params.has('id')) {
      const id = params.get('id');
      if (!validSiteMediaId(id)) return notFound(request);
      const row = await findSiteMedia(db, id, true);
      if (!row) return notFound(request);
      const state = await readSiteSettings(env);
      return siteMediaPageVisible(state, row.locale, row.slug)
        ? await siteMediaResponse(db, request, row)
        : notFound(request);
    }
    const locale = params.get('locale');
    const slug = params.get('slug');
    if (!validSiteMediaPage(locale, slug)) return notFound(request);
    const state = await readSiteSettings(env);
    if (!siteMediaPageVisible(state, locale, slug)) return notFound(request);
    return jsonFor(request, adminJson({ items: await listPublishedSiteMedia(db, locale, slug) }));
  } catch (error) {
    if (missingSiteMediaTable(error)) return notFound(request);
    return jsonFor(request, fail('media_storage_unavailable', 503));
  }
}
