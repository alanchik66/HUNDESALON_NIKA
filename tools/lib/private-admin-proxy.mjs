import { createServer } from 'node:http';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { PAGE_LABELS } from '../../functions/_lib/page-copy.js';
import { SITE_MEDIA_DIRECT_LIMITS, SITE_MEDIA_UPLOAD_CHUNK_SIZE } from '../../functions/_lib/admin-media.js';
import {
  GALLERY_COMPARISON_JSON_LIMIT,
  GALLERY_COMPARISON_UPLOAD_LIMIT,
} from '../../functions/_lib/gallery-comparisons.js';
import { isPublicPath } from './static-test-server.mjs';

const api = '/api/admin/';
const session = api + 'session';
const media = api + 'media';
const comparisons = api + 'comparisons';
const mediaRoutes = [media, comparisons, '/api/site-media', '/api/site-comparisons'];
const reads = new Set(['/admin', '/admin/', api + 'settings', api + 'pages', api + 'page', ...mediaRoutes]);
const writes = new Map([
  ['POST ' + session, 4096],
  ['DELETE ' + session, 0],
  ['PATCH ' + api + 'settings', 24576],
  ['PATCH ' + api + 'page', 128000],
  ['POST ' + media, Math.max(...Object.values(SITE_MEDIA_DIRECT_LIMITS))],
  ['PATCH ' + media, 4096],
  ['DELETE ' + media, 0],
  ['POST ' + comparisons, GALLERY_COMPARISON_UPLOAD_LIMIT],
  ['PATCH ' + comparisons, 4096],
  ['DELETE ' + comparisons, 0],
]);
const localePage = /^\/(?:de|en|ru|uk)(?:\/(.*))?$/;
const browserCookie = '__Host-nika-admin';
const upstreamCookie = 'nika-admin-local';

function canPreview(pathname) {
  const locale = localePage.exec(pathname);
  if (locale) {
    const slug = (locale[1] || 'index').replace(/\/$/, '').replace(/\.html$/, '');
    return slug === 'promotions' || PAGE_LABELS.has(slug);
  }
  if (['/', '/reviews', '/telegram-menu'].includes(pathname)) return true;
  // A preview service worker would share the owner console's origin and scope.
  if (['/sw.js', '/sp-push-worker-fb.js'].includes(pathname)) return false;
  return isPublicPath(pathname.slice(1).split('/').join(path.sep));
}

function safePath(raw) {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.includes('#')) return null;
  const pathname = raw.split('?')[0];
  if (/%(?:2f|5c)/i.test(pathname)) return null;
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (
    decoded.includes('//') ||
    /[\\%?#\p{Cc}]/u.test(decoded) ||
    decoded.split('/').some(part => part === '.' || part === '..')
  )
    return null;
  return decoded;
}

function ownerCookie(header) {
  const names = (header || '')
    .split(';')
    .map(part => part.trim())
    .filter(part => part.startsWith(browserCookie + '='));
  if (names.length !== 1) return null;
  const token = names[0].slice(browserCookie.length + 1);
  return /^[a-f0-9]{64}$/.test(token) ? upstreamCookie + '=' + token : null;
}

function copySessionCookie(headers, response) {
  for (const cookie of headers.getSetCookie()) {
    const match = /^nika-admin-local=([a-f0-9]{64}|);/i.exec(cookie);
    const age = /;\s*Max-Age=(\d+)(?:;|$)/i.exec(cookie);
    if (!match || !age || (!match[1] && Number(age[1]) !== 0)) continue;
    response.setHeader(
      'Set-Cookie',
      browserCookie +
        '=' +
        match[1] +
        '; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=' +
        Math.min(Number(age[1]), 28800)
    );
    return;
  }
}

async function readBody(request, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > limit) {
      request.resume();
      return null;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, size);
}

function sendOwnerKeyTransferEntry(response, active) {
  const heading = active ? 'Перенос ключа в 1Password' : 'Сеанс переноса закрыт';
  const action = active
    ? '<a href="/owner-key-transfer/">Продолжить перенос ключа</a>'
    : '<a href="/admin/">Открыть админ-панель</a>';
  response.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'self'; base-uri 'none'; frame-ancestors 'none'");
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.writeHead(200).end(`<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${heading} · HUNDESALON NIKA</title>
  <link rel="stylesheet" href="/assets/css/site-admin.css?v=2">
</head>
<body><main class="wrap"><section class="login card"><h1>${heading}</h1><p>${action}</p></section></main></body>
</html>`);
}

export function createPrivateAdminProxy({ getOrigin, upstream = 'http://127.0.0.1:8796', isOwnerKeyTransferActive }) {
  const local = new URL(upstream);
  if (
    local.protocol !== 'http:' ||
    !['127.0.0.1', '[::1]'].includes(local.hostname) ||
    local.username ||
    local.password ||
    local.pathname !== '/' ||
    local.search ||
    local.hash
  ) {
    throw new Error('The owner backend must be a loopback HTTP origin.');
  }
  return createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Robots-Tag', 'noindex, nofollow');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const end = status => {
      if (status === 413) response.setHeader('Connection', 'close');
      response.writeHead(status).end();
    };
    const controller = new AbortController();
    response.once('close', () => controller.abort());
    try {
      const registered = getOrigin();
      if (!registered) return end(503);
      const remote = new URL(registered);
      if (
        remote.protocol !== 'https:' ||
        registered !== remote.origin ||
        request.headers.host !== remote.host ||
        !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress)
      )
        return end(403);
      const pathname = safePath(request.url);
      if (!pathname) return end(400);
      const method = request.method;
      const read = method === 'GET' || method === 'HEAD';
      let limit = writes.get(method + ' ' + pathname);
      if (read && !reads.has(pathname) && !canPreview(pathname)) return end(404);
      if (!read && limit === undefined) return end(405);
      if ((!read || request.headers.origin !== undefined) && request.headers.origin !== remote.origin) return end(403);
      if (request.headers['service-worker'] === 'script') return end(403);
      const target = new URL(local.origin);
      target.pathname = pathname;
      const queryStart = request.url.indexOf('?');
      if (queryStart !== -1) target.search = request.url.slice(queryStart);
      if (target.origin !== local.origin || target.username || target.password) return end(400);
      if (method === 'GET' && pathname === '/admin/' && target.search === '?key-transfer=1' && isOwnerKeyTransferActive) {
        return sendOwnerKeyTransferEntry(response, await isOwnerKeyTransferActive());
      }

      const headers = new Headers({ 'Accept-Encoding': 'identity' });
      for (const name of ['accept', 'accept-language', 'range', 'if-range']) {
        if (request.headers[name]) headers.set(name, request.headers[name]);
      }
      if (pathname.startsWith(api)) {
        const cookie = ownerCookie(request.headers.cookie);
        if (cookie) headers.set('Cookie', cookie);
      }
      let body;
      if (!read) {
        const contentType = request.headers['content-type'];
        const type = contentType?.split(';')[0].trim().toLowerCase();
        const upload = method === 'POST' && pathname === media;
        const comparisonUpload = method === 'POST' && pathname === comparisons;
        if (upload) {
          const actions = target.searchParams.getAll('action');
          if (actions.length > 1) return end(400);
          switch (actions[0]) {
            case undefined:
              if (!Object.hasOwn(SITE_MEDIA_DIRECT_LIMITS, type)) return end(415);
              limit = SITE_MEDIA_DIRECT_LIMITS[type];
              break;
            case 'chunk':
              if (type !== 'application/octet-stream') return end(415);
              limit = SITE_MEDIA_UPLOAD_CHUNK_SIZE;
              break;
            case 'begin':
            case 'finish':
            case 'abort':
              if (contentType !== undefined) return end(415);
              limit = 0;
              break;
            default:
              return end(400);
          }
        } else if (comparisonUpload) {
          if (type === 'application/json') limit = GALLERY_COMPARISON_JSON_LIMIT;
          else if (type !== 'multipart/form-data') return end(415);
        } else if (limit && type !== 'application/json') return end(415);
        if (Number(request.headers['content-length']) > limit) return end(413);
        body = await readBody(request, limit);
        if (!body) return end(413);
        if (limit) headers.set('Content-Type', comparisonUpload ? contentType : type);
        headers.set('Origin', local.origin);
      }
      const result = await fetch(target, { method, headers, body, redirect: 'manual', signal: controller.signal });
      const location = result.headers.get('location');
      if (location) {
        const next = new URL(location, target);
        if (
          !read ||
          ![local.origin, remote.origin].includes(next.origin) ||
          next.username ||
          next.password ||
          !safePath(next.pathname) ||
          (!reads.has(next.pathname) && !canPreview(next.pathname))
        ) {
          await result.body?.cancel();
          return end(502);
        }
        response.setHeader('Location', remote.origin + next.pathname + next.search + next.hash);
      }
      for (const name of [
        'content-type',
        'accept-ranges',
        'content-range',
        'content-language',
        'x-frame-options',
        'permissions-policy',
        'cross-origin-opener-policy',
        'cross-origin-resource-policy',
      ]) {
        if (result.headers.has(name)) response.setHeader(name, result.headers.get(name));
      }
      if (mediaRoutes.includes(pathname) && result.headers.has('Content-Disposition')) {
        response.setHeader('Content-Disposition', result.headers.get('Content-Disposition'));
      }
      if (mediaRoutes.includes(pathname) && result.headers.has('Content-Length') &&
        !result.headers.has('Content-Encoding')) response.setHeader('Content-Length', result.headers.get('Content-Length'));
      const policies = [result.headers.get('content-security-policy')].filter(Boolean);
      if (result.headers.get('content-type')?.includes('text/html')) {
        // Scripts in a customer-page preview share an origin with the authenticated console.
        policies.push("script-src 'self' 'wasm-unsafe-eval'; object-src 'none'; base-uri 'self'; form-action 'self'");
      }
      if (policies.length) response.setHeader('Content-Security-Policy', policies);
      if (pathname === session && !read && result.ok) copySessionCookie(result.headers, response);
      response.writeHead(result.status);
      if (!result.body) return response.end();
      await pipeline(Readable.fromWeb(result.body), response);
    } catch {
      if (!response.headersSent && !response.destroyed) end(502);
      else response.destroy();
    }
  });
}
