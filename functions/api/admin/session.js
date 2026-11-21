import { adminJson, checkAdminRequest, openAdminSession, closeAdminSession } from '../../_lib/site-admin-auth.js';
import {
  enforceRateLimit,
  readJsonBody,
  timingSafeEqualStrings,
  isRequestBodyTooLarge,
} from '../../_lib/http-security.js';

export async function onRequest({ request, env }) {
  const denied = await checkAdminRequest(request, env);
  if (denied) return denied;
  try {
    if (request.method === 'DELETE') return await closeAdminSession(request, env);
    if (request.method !== 'POST') return adminJson({ error: 'method_not_allowed' }, 405);
    if (!(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) {
      return adminJson({ error: 'json_required' }, 415);
    }
    const limited = await enforceRateLimit(request, { route: 'site-admin-login', limit: 10, windowSec: 300 });
    if (limited) return limited;
    const data = await readJsonBody(request, 4096);
    if (typeof data?.key !== 'string' || !(await timingSafeEqualStrings(data.key, env.SITE_ADMIN_KEY))) {
      return adminJson({ error: 'unauthorized' }, 401);
    }
    return await openAdminSession(request, env);
  } catch (error) {
    if (isRequestBodyTooLarge(error)) return adminJson({ error: 'too_large' }, 413);
    if (error instanceof SyntaxError) return adminJson({ error: 'invalid_json' }, 400);
    return adminJson({ error: 'admin_unavailable' }, 503);
  }
}
