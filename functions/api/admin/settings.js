import { authorizeAdmin, adminJson } from '../../_lib/site-admin-auth.js';
import { readSiteSettings, saveSettingsChange, settingsSnapshot } from '../../_lib/site-settings.js';
import { isRequestBodyTooLarge, readJsonBody } from '../../_lib/http-security.js';

export async function onRequest({ request, env }) {
  const denied = await authorizeAdmin(request, env);
  if (denied) return denied;
  if (!['GET', 'PATCH'].includes(request.method)) return adminJson({ error: 'method_not_allowed' }, 405);
  try {
    const state = await readSiteSettings(env);
    if (request.method === 'GET') return adminJson(settingsSnapshot(state));
    if (!(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json'))
      return adminJson({ error: 'json_required' }, 415);
    let change;
    try {
      change = await readJsonBody(request, 24576);
    } catch (error) {
      return adminJson({ error: 'invalid_input' }, isRequestBodyTooLarge(error) ? 413 : 400);
    }
    const result = await saveSettingsChange(env, state, change);
    if (result.status !== 200)
      return adminJson({ error: result.status === 409 ? 'version_conflict' : 'invalid_input' }, result.status);
    return adminJson(settingsSnapshot(result.state));
  } catch {
    return adminJson({ error: 'settings_unavailable' }, 503);
  }
}
