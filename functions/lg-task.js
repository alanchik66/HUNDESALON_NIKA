/**
 * Cloudflare Pages Function: POST /lg-task
 * Lightweight webhook bridge for dashboard-driven service tasks.
 */

import { assertAllowedOrigin, enforceRateLimit, jsonResponse } from './_lib/http-security.js';
import { hasAiServiceAuth } from './_lib/ai-policy.js';

function getRuntimeEnvs(context) {
  const candidates = [
    context?.env,
    context?.data,
    context?.platform?.env,
    context?.cloudflare?.env,
    context?.cloudflare?.bindings,
    context?.locals?.env,
  ];

  return candidates.filter(candidate => candidate && typeof candidate === 'object');
}

function getEnvVarFromContext(context, key) {
  for (const env of getRuntimeEnvs(context)) {
    const value = env?.[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  const processValue = globalThis?.process?.env?.[key];
  if (typeof processValue === 'string' && processValue.trim()) {
    return processValue.trim();
  }

  return '';
}

function getBearerToken(request) {
  const header = String(request.headers.get('Authorization') || '').trim();
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() || '';
}

function isAuthorizedBySharedSecret(request, context) {
  const secret = getEnvVarFromContext(context, 'LG_TASK_WEBHOOK_SECRET');
  if (!secret) return false;
  return getBearerToken(request) === secret;
}

function getInternalOrigin(request) {
  const host = String(request.headers.get('Host') || '').trim();
  if (!host) return '';
  return `https://${host}`;
}

async function forwardJson(request, pathname, body) {
  const target = new URL(request.url);
  target.pathname = pathname;
  target.search = '';

  const origin = getInternalOrigin(request);
  return fetch(target.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
      ...(request.headers.get('Authorization') ? { Authorization: request.headers.get('Authorization') } : {}),
    },
    body: JSON.stringify(body || {}),
  });
}

export async function onRequest(context) {
  const { request } = context;

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
  }

  const originCheck = assertAllowedOrigin(request);
  const responseOrigin = originCheck.ok ? originCheck.origin : '';

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400, responseOrigin);
  }

  const task = String(payload?.task || '')
    .trim()
    .toLowerCase();
  if (!task) {
    return jsonResponse({ error: 'Missing task field' }, 400);
  }

  const isAiTask = task === 'message.draft' || task === 'seo.generate';
  const secretOk = isAiTask ? hasAiServiceAuth(request, context) : isAuthorizedBySharedSecret(request, context);
  if (!originCheck.ok && !secretOk) return jsonResponse({ error: 'Forbidden' }, 403);
  if (isAiTask && !secretOk) return jsonResponse({ error: 'AI service authorization required' }, 401);
  const rateLimited = await enforceRateLimit(request, {
    route: 'lg-task',
    limit: 10,
    windowSec: 60,
  });
  if (rateLimited) return rateLimited;

  if (task === 'ping') {
    return jsonResponse(
      { ok: true, task: 'ping', service: 'lg-task', ts: new Date().toISOString() },
      200,
      responseOrigin
    );
  }

  if (task === 'message.draft') {
    const upstream = await forwardJson(request, '/message-draft', payload.payload || {});
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') || 'application/json; charset=utf-8',
      },
    });
  }

  if (task === 'seo.generate') {
    const upstream = await forwardJson(request, '/seo-generate', payload.payload || {});
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') || 'application/json; charset=utf-8',
      },
    });
  }

  return jsonResponse(
    {
      error: 'Unsupported task',
      supported: ['ping', 'message.draft', 'seo.generate'],
    },
    400,
    responseOrigin
  );
}
