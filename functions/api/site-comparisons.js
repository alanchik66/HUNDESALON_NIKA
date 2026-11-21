import { adminDatabase, adminJson } from '../_lib/site-admin-auth.js';
import { readSiteSettings } from '../_lib/site-settings.js';
import { validLocale } from '../_lib/page-copy.js';
import { validSiteMediaId } from '../_lib/admin-media.js';
import {
  comparisonBytesResponse,
  findComparison,
  listComparisons,
  missingComparisonTable,
  validComparisonSide,
} from '../_lib/gallery-comparisons.js';

export async function onRequest({ request, env }) {
  const json = (data, status) => {
    const response = adminJson(data, status);
    return request.method === 'HEAD' ? new Response(null, response) : response;
  };
  const notFound = () => json({ error: 'not_found' }, 404);
  if (!['GET', 'HEAD'].includes(request.method)) return json({ error: 'method_not_allowed' }, 405);
  const params = new URL(request.url).searchParams;
  const byId = params.has('id') || params.has('side');
  const locale = params.get('locale');
  const id = params.get('id');
  const side = params.get('side');
  if (byId ? !validSiteMediaId(id) || !validComparisonSide(side) : !validLocale(locale)) return notFound();
  if (!env?.CHAT_DB) return byId ? notFound() : json({ items: [] });
  try {
    const state = await readSiteSettings(env);
    if (state.sections.beforeAfter === false) return notFound();
    const db = adminDatabase(env);
    if (!byId) return json({ items: await listComparisons(db, locale) });
    const row = await findComparison(db, id, true);
    return row ? await comparisonBytesResponse(db, request, row, side) : notFound();
  } catch (error) {
    if (missingComparisonTable(error)) return byId ? notFound() : json({ items: [] });
    return json({ error: 'comparison_storage_unavailable' }, 503);
  }
}
