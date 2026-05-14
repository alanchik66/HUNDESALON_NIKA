/**
 * Cloudflare Pages Function: POST /openrouter
 * Secure proxy for OpenRouter chat completions.
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-5.2';
const DEFAULT_SITE_NAME = 'HUNDESALON NIKA';
const MAX_MESSAGES = 24;
const MAX_MESSAGE_CONTENT_LENGTH = 8000;
const DEV_KEY_ASSET_URL = 'https://local.dev/__dev_openrouter_key.txt';
const DEFAULT_CACHE_TTL_SECONDS = 300;

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

function isLocalRequest(origin) {
  return origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1');
}

function parseBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value == null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function parseNumber(value, fallback = 0) {
  const asNumber = Number(value);
  return Number.isFinite(asNumber) ? asNumber : fallback;
}

function parseCsv(value) {
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

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

function getEnvVar(env, key) {
  if (!env || typeof env !== 'object') return '';

  const direct = env[key];
  if (typeof direct === 'string' && direct.trim()) return direct.trim();

  const normalizedKey = String(key || '').trim();
  for (const candidate of Object.keys(env)) {
    const clean = candidate.replace(/^\uFEFF/, '').trim();
    if (clean !== normalizedKey) continue;
    const fallbackValue = env[candidate];
    if (typeof fallbackValue === 'string' && fallbackValue.trim()) return fallbackValue.trim();
  }

  return '';
}

function getEnvVarFromContext(context, key) {
  for (const env of getRuntimeEnvs(context)) {
    const value = getEnvVar(env, key);
    if (value) return value;
  }

  if (globalThis?.process?.env && typeof globalThis.process.env[key] === 'string') {
    const processValue = globalThis.process.env[key].trim();
    if (processValue) return processValue;
  }

  return '';
}

async function getLocalApiKeyFromAssets(runtimeEnv) {
  const assets = runtimeEnv?.ASSETS;
  if (!assets || typeof assets.fetch !== 'function') {
    return { key: '', status: 'no-assets-binding' };
  }

  try {
    const response = await assets.fetch(DEV_KEY_ASSET_URL);
    if (!response?.ok) {
      return { key: '', status: `assets-status-${response?.status || 'unknown'}` };
    }

    const text = await response.text();
    for (const rawLine of String(text || '').split(/\r?\n/)) {
      const line = rawLine.replace(/^\uFEFF/, '').trim();
      if (!line || line.startsWith('#')) continue;

      const separatorIndex = line.indexOf('=');
      if (separatorIndex < 1) continue;

      const name = line.slice(0, separatorIndex).trim();
      if (name !== 'OPENROUTER_API_KEY') continue;

      const value = line.slice(separatorIndex + 1).trim();
      return { key: value || '', status: value ? 'assets-ok' : 'assets-empty-key' };
    }
  } catch {
    return { key: '', status: 'assets-fetch-error' };
  }

  return { key: '', status: 'assets-key-not-found' };
}

function resolveProviderDefaults(context, payloadProvider) {
  const providerOrder = parseCsv(getEnvVarFromContext(context, 'OPENROUTER_PROVIDER_ORDER'));
  const fallbackAllowed = parseBoolean(getEnvVarFromContext(context, 'OPENROUTER_ALLOW_FALLBACKS'), true);
  const sortStrategy = getEnvVarFromContext(context, 'OPENROUTER_PROVIDER_SORT') || '';

  const envProvider = {};
  if (providerOrder.length) envProvider.order = providerOrder;
  if (sortStrategy) envProvider.sort = sortStrategy;
  envProvider.allow_fallbacks = fallbackAllowed;

  if (!Object.keys(envProvider).length && (!payloadProvider || typeof payloadProvider !== 'object')) {
    return null;
  }

  return { ...envProvider, ...(payloadProvider && typeof payloadProvider === 'object' ? payloadProvider : {}) };
}

function isCacheEnabled(context, payload) {
  const envEnabled = parseBoolean(getEnvVarFromContext(context, 'OPENROUTER_ENABLE_RESPONSE_CACHE'), false);
  const payloadEnabled = parseBoolean(payload?.cache, false);
  return envEnabled || payloadEnabled;
}

function getCacheTTLSeconds(context, payload) {
  const payloadTtl = parseNumber(payload?.cache_ttl_seconds, NaN);
  if (Number.isFinite(payloadTtl) && payloadTtl > 0) {
    return Math.min(Math.floor(payloadTtl), 3600);
  }

  const envTtl = parseNumber(getEnvVarFromContext(context, 'OPENROUTER_CACHE_TTL_SECONDS'), NaN);
  if (Number.isFinite(envTtl) && envTtl > 0) {
    return Math.min(Math.floor(envTtl), 3600);
  }

  return DEFAULT_CACHE_TTL_SECONDS;
}

function getCacheStore() {
  if (globalThis?.caches?.default && typeof globalThis.caches.default.match === 'function') {
    return globalThis.caches.default;
  }
  return null;
}

async function sha256Hex(input) {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function buildCacheRequest(request, requestPayload) {
  const keySource = JSON.stringify({
    model: requestPayload.model,
    messages: requestPayload.messages,
    temperature: requestPayload.temperature,
    top_p: requestPayload.top_p,
    max_tokens: requestPayload.max_tokens,
    provider: requestPayload.provider,
  });
  const hash = await sha256Hex(keySource);
  const cacheUrl = new URL(request.url);
  cacheUrl.pathname = `/__openrouter_cache/${hash}`;
  cacheUrl.search = '';

  return new Request(cacheUrl.toString(), { method: 'GET' });
}

async function readCachedResponse(cacheStore, cacheRequest) {
  if (!cacheStore || !cacheRequest) return null;

  try {
    const cached = await cacheStore.match(cacheRequest);
    if (!cached) return null;
    return cached;
  } catch {
    return null;
  }
}

async function writeCachedResponse(cacheStore, cacheRequest, text, ttlSeconds) {
  if (!cacheStore || !cacheRequest || !text) return;

  const response = new Response(text, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${ttlSeconds}`,
      'X-Proxy-Cache': 'MISS',
    },
  });

  try {
    await cacheStore.put(cacheRequest, response.clone());
  } catch {
    // Ignore cache write failures to keep request path reliable.
  }
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') return 'Body must be an object';
  if (!Array.isArray(payload.messages) || payload.messages.length < 1) return 'Body must include messages[]';
  if (payload.messages.length > MAX_MESSAGES) return `Too many messages. Max allowed: ${MAX_MESSAGES}`;

  const hasOversizedMessage = payload.messages.some(msg => {
    const content = typeof msg?.content === 'string' ? msg.content : '';
    return content.length > MAX_MESSAGE_CONTENT_LENGTH;
  });

  if (hasOversizedMessage) {
    return `Message content too large. Max ${MAX_MESSAGE_CONTENT_LENGTH} chars per message.`;
  }

  return '';
}

export async function onRequest(context) {
  const { request } = context;
  const runtimeEnvs = getRuntimeEnvs(context);
  const primaryRuntimeEnv = runtimeEnvs[0] || {};

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
  }

  const origin = sanitizeOrigin(request.headers.get('Origin'));
  const host = sanitizeOrigin(request.headers.get('Host'));
  if (!isAllowedOrigin(origin, host)) {
    return jsonResponse({ error: 'Forbidden' }, 403);
  }

  let apiKey = getEnvVarFromContext(context, 'OPENROUTER_API_KEY');
  let localAssetsStatus = 'skipped';

  if (!apiKey && isLocalRequest(origin)) {
    const localAssets = await getLocalApiKeyFromAssets(primaryRuntimeEnv);
    apiKey = localAssets.key;
    localAssetsStatus = localAssets.status;
  }

  if (!apiKey) {
    const response = { error: 'OPENROUTER_API_KEY is not configured' };

    if (isLocalRequest(origin)) {
      const availableKeys =
        primaryRuntimeEnv && typeof primaryRuntimeEnv === 'object' ? Object.keys(primaryRuntimeEnv).sort() : [];
      const envContainerKeySamples = runtimeEnvs.map(container => Object.keys(container).filter(Boolean).slice(0, 25));
      response.debug = {
        openrouterKeyCandidates: availableKeys.filter(key => /OPENROUTER/i.test(key)).slice(0, 20),
        bindingIntrospection: {
          contextTopLevelKeys: Object.keys(context || {}).slice(0, 30),
          runtimeEnvContainers: runtimeEnvs.length,
          envContainerKeySamples,
          localAssetsStatus,
        },
      };
    }

    return jsonResponse(response, 503);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const payloadError = validatePayload(payload);
  if (payloadError) return jsonResponse({ error: payloadError }, 400);

  const resolvedModel = String(
    payload.model || getEnvVarFromContext(context, 'OPENROUTER_DEFAULT_MODEL') || DEFAULT_MODEL
  ).trim();
  const fallbackModel = String(getEnvVarFromContext(context, 'OPENROUTER_FALLBACK_MODEL') || '').trim();
  const provider = resolveProviderDefaults(context, payload.provider);

  const requestPayload = {
    ...payload,
    model: resolvedModel,
    provider: provider || undefined,
  };

  // Internal transport flags should not leak to OpenRouter.
  delete requestPayload.cache;
  delete requestPayload.cache_ttl_seconds;

  const referer = sanitizeOrigin(getEnvVarFromContext(context, 'OPENROUTER_SITE_URL')) || sanitizeOrigin(origin);
  const title = String(getEnvVarFromContext(context, 'OPENROUTER_SITE_NAME') || DEFAULT_SITE_NAME).trim();

  const upstreamHeaders = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  if (referer) upstreamHeaders['HTTP-Referer'] = referer;
  if (title) upstreamHeaders['X-OpenRouter-Title'] = title;

  const isStream = Boolean(requestPayload.stream);
  const useCache = !isStream && isCacheEnabled(context, payload);
  const cacheStore = useCache ? getCacheStore() : null;
  const cacheTtlSeconds = getCacheTTLSeconds(context, payload);
  const cacheRequest = useCache && cacheStore ? await buildCacheRequest(request, requestPayload) : null;

  if (cacheStore && cacheRequest) {
    const cached = await readCachedResponse(cacheStore, cacheRequest);
    if (cached) {
      const cachedText = await cached.text();
      return new Response(cachedText, {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Proxy-Cache': 'HIT',
        },
      });
    }
  }

  const callOpenRouter = body =>
    fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: upstreamHeaders,
      body: JSON.stringify(body),
    });

  let upstream;
  try {
    upstream = await callOpenRouter(requestPayload);
  } catch (error) {
    return jsonResponse({ error: 'Failed to reach OpenRouter', details: String(error?.message || error) }, 502);
  }

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
      // Keep original upstream response if fallback call fails.
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

  if (upstream.status === 200 && cacheStore && cacheRequest) {
    await writeCachedResponse(cacheStore, cacheRequest, text, cacheTtlSeconds);
  }

  return new Response(text, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') || 'application/json; charset=utf-8',
      'X-Proxy-Cache': cacheStore && cacheRequest ? 'MISS' : 'BYPASS',
    },
  });
}
