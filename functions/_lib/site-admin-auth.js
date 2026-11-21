import { assertAllowedOrigin } from './http-security.js';
import { hasSiteAdminAccess, isAdminLoopback } from './site-admin-access.js';

const LIFETIME = 8 * 60 * 60;

export function adminJson(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      Vary: '*',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

export function adminDatabase(env) {
  const db = env?.CHAT_DB;
  if (!db) throw new Error('Admin storage unavailable');
  return typeof db.withSession === 'function' ? db.withSession('first-primary') : db;
}

function localHttp(request) {
  const url = new URL(request.url);
  return url.protocol === 'http:' && isAdminLoopback(url);
}

function cookieName(request) {
  return localHttp(request) ? 'nika-admin-local' : '__Host-nika-admin';
}

function sessionCookie(request, value, maxAge) {
  return (
    cookieName(request) +
    '=' +
    value +
    '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' +
    maxAge +
    (localHttp(request) ? '' : '; Secure')
  );
}

export async function checkAdminRequest(request, env) {
  if (!localHttp(request) && new URL(request.url).protocol !== 'https:')
    return adminJson({ error: 'https_required' }, 403);
  if (!(await hasSiteAdminAccess(request, env))) return adminJson({ error: 'not_found' }, 404);
  if (!['GET', 'HEAD'].includes(request.method) && !assertAllowedOrigin(request).ok) {
    return adminJson({ error: 'invalid_origin' }, 403);
  }
  if (typeof env?.SITE_ADMIN_KEY !== 'string' || env.SITE_ADMIN_KEY.trim().length < 32 || !env.CHAT_DB) {
    return adminJson({ error: 'admin_unavailable' }, 503);
  }
  return null;
}

function tokenFrom(request) {
  const prefix = cookieName(request) + '=';
  const raw = (request.headers.get('Cookie') || '')
    .split(';')
    .map(item => item.trim())
    .find(item => item.startsWith(prefix));
  const token = raw?.slice(prefix.length);
  return /^[a-f0-9]{64}$/.test(token || '') ? token : null;
}

function hex(bytes) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Only the browser receives the session token. Rotating the owner's key also invalidates existing sessions.
async function tokenHash(env, token) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(env.SITE_ADMIN_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const digest = await crypto.subtle.sign('HMAC', key, enc.encode('nika-admin-session:' + token));
  return hex(new Uint8Array(digest));
}

export async function authorizeAdmin(request, env) {
  const denied = await checkAdminRequest(request, env);
  if (denied) return denied;
  const token = tokenFrom(request);
  if (!token) return adminJson({ error: 'unauthorized' }, 401);
  try {
    const record = await adminDatabase(env)
      .prepare('SELECT expires_at FROM site_admin_sessions WHERE token_hash = ? AND expires_at > ?')
      .bind(await tokenHash(env, token), Math.floor(Date.now() / 1000))
      .first();
    return record ? null : adminJson({ error: 'unauthorized' }, 401);
  } catch {
    return adminJson({ error: 'admin_unavailable' }, 503);
  }
}

export async function openAdminSession(request, env) {
  const db = adminDatabase(env),
    now = Math.floor(Date.now() / 1000);
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  await db.batch([
    db.prepare('DELETE FROM site_admin_sessions WHERE expires_at <= ?').bind(now),
    db
      .prepare('INSERT INTO site_admin_sessions (token_hash, expires_at) VALUES (?, ?)')
      .bind(await tokenHash(env, token), now + LIFETIME),
  ]);
  const response = adminJson({ ok: true });
  response.headers.set('Set-Cookie', sessionCookie(request, token, LIFETIME));
  return response;
}

export async function closeAdminSession(request, env) {
  const token = tokenFrom(request);
  if (token)
    await adminDatabase(env)
      .prepare('DELETE FROM site_admin_sessions WHERE token_hash = ?')
      .bind(await tokenHash(env, token))
      .run();
  const response = adminJson({ ok: true });
  response.headers.set('Set-Cookie', sessionCookie(request, '', 0));
  return response;
}
