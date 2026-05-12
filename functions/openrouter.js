/**
 * Cloudflare Pages Function: POST /openrouter
 * ===========================================
 * Secure proxy for OpenRouter chat completions.
 *
 * Required env vars (Cloudflare Pages -> Settings -> Environment variables):
 *   OPENROUTER_API_KEY=<your key>
 *
 * Optional env vars:
 *   OPENROUTER_SITE_URL=https://hundesalon-nika.com
 *   OPENROUTER_SITE_NAME=HUNDESALON NIKA
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-5.2';
const MAX_MESSAGES = 24;
const MAX_MESSAGE_CONTENT_LENGTH = 8000;

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function sanitizeOrigin(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.replace(/\/$/, '');
}

function getOriginHost(origin) {
  try {
    return new URL(origin).host;
  } catch {
    return '';
  }
}

function isAllowedOrigin(origin, host) {
  if (!origin) return true;
  if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
    return true;
  }

  const originHost = getOriginHost(origin);
  if (!originHost || !host) return false;
  return originHost === host;
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'POST' },
    });
  }

  const origin = sanitizeOrigin(request.headers.get('Origin'));
  const host = sanitizeOrigin(request.headers.get('Host'));
  if (!isAllowedOrigin(origin, host)) {
    return jsonResponse({ error: 'Forbidden' }, 403);
  }

  const apiKey = env?.OPENROUTER_API_KEY;
  if (!apiKey) {
    return jsonResponse({ error: 'OPENROUTER_API_KEY is not configured' }, 503);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!payload || typeof payload !== 'object') {
    return jsonResponse({ error: 'Body must be an object' }, 400);
  }

  if (!Array.isArray(payload.messages) || payload.messages.length < 1) {
    return jsonResponse({ error: 'Body must include messages[]' }, 400);
  }

  if (payload.messages.length > MAX_MESSAGES) {
    return jsonResponse({ error: `Too many messages. Max allowed: ${MAX_MESSAGES}` }, 400);
  }

  const hasOversizedMessage = payload.messages.some(msg => {
    const content = typeof msg?.content === 'string' ? msg.content : '';
    return content.length > MAX_MESSAGE_CONTENT_LENGTH;
  });
  if (hasOversizedMessage) {
    return jsonResponse(
      {
        error: `Message content too large. Max ${MAX_MESSAGE_CONTENT_LENGTH} chars per message.`,
      },
      400
    );
  }

  const resolvedModel = String(payload.model || env?.OPENROUTER_DEFAULT_MODEL || DEFAULT_MODEL).trim();
  const fallbackModel = String(env?.OPENROUTER_FALLBACK_MODEL || '').trim();
  const requestPayload = { ...payload, model: resolvedModel };

  const referer = sanitizeOrigin(env?.OPENROUTER_SITE_URL) || sanitizeOrigin(origin);
  const title = String(env?.OPENROUTER_SITE_NAME || 'HUNDESALON NIKA').trim();

  const upstreamHeaders = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  if (referer) upstreamHeaders['HTTP-Referer'] = referer;
  if (title) upstreamHeaders['X-OpenRouter-Title'] = title;

  let upstream;
  const callOpenRouter = body => {
    return fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: upstreamHeaders,
      body: JSON.stringify(body),
    });
  };

  try {
    upstream = await callOpenRouter(requestPayload);
  } catch (error) {
    return jsonResponse({ error: 'Failed to reach OpenRouter', details: String(error?.message || error) }, 502);
  }

  const isStream = Boolean(requestPayload.stream);
  const canRetryWithFallback =
    !isStream &&
    Boolean(fallbackModel) &&
    fallbackModel !== resolvedModel &&
    (upstream.status === 429 || upstream.status >= 500);

  if (canRetryWithFallback) {
    const fallbackPayload = { ...requestPayload, model: fallbackModel };
    try {
      upstream = await callOpenRouter(fallbackPayload);
    } catch {
      // Keep original upstream response if fallback call itself fails at network layer.
    }
  }

  if (isStream) {
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') || 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  }

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') || 'application/json; charset=utf-8',
    },
  });
}
