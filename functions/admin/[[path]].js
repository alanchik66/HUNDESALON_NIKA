import { renderAdminPage } from '../_lib/admin-page.js';
import { checkAdminRequest } from '../_lib/site-admin-auth.js';
import { isAdminLoopback } from '../_lib/site-admin-access.js';

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  if (!['/admin', '/admin/'].includes(url.pathname))
    return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  if (!isAdminLoopback(url)) {
    const denied = await checkAdminRequest(request, env);
    if (denied) return denied;
  }
  if (!['GET', 'HEAD'].includes(request.method))
    return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  return new Response(request.method === 'HEAD' ? null : renderAdminPage(), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'Content-Security-Policy':
        "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; media-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
