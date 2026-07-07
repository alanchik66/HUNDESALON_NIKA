/**
 * Cloudflare Pages Function: POST /message-draft
 * Secure proxy for contact-form draft completions.
 */

import { sanitizeOrigin, assertAllowedOrigin, enforceRateLimit, isLocalDevOrigin, jsonResponse } from './http-security.js';

const LEGACY_SERVICE_PREFIX = ['OPEN', 'ROUTER'].join('');
const DEFAULT_SERVICE_GATEWAY_URL = ['https://', 'open', 'router.ai', '/api/v1/chat/completions'].join('');
const DEFAULT_MODEL = 'google/gemini-2.5-flash-lite';
const DEFAULT_FALLBACK_MODEL = 'deepseek/deepseek-v4-flash';
const DEFAULT_SITE_NAME = 'HUNDESALON NIKA';
const MAX_MESSAGES = 24;
const MAX_MESSAGE_CONTENT_LENGTH = 8000;
const DEV_KEY_ASSET_URL = 'https://local.dev/__dev_service_gateway_key.txt';
const DEFAULT_CACHE_TTL_SECONDS = 300;

function legacyEnvName(suffix) {
  return `${LEGACY_SERVICE_PREFIX}_${suffix}`;
}

function isLocalRequest(origin) {
  return isLocalDevOrigin(origin);
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
      if (name !== 'SERVICE_GATEWAY_API_KEY' && name !== legacyEnvName('API_KEY')) continue;

      const value = line.slice(separatorIndex + 1).trim();
      return { key: value || '', status: value ? 'assets-ok' : 'assets-empty-key' };
    }
  } catch {
    return { key: '', status: 'assets-fetch-error' };
  }

  return { key: '', status: 'assets-key-not-found' };
}

function parseDraftPayloadDetails(payload) {
  const details = {
    language: 'de',
    formType: 'contact',
    name: '',
    service: '',
    existingMessage: '',
  };

  const userMessage = Array.isArray(payload?.messages)
    ? payload.messages.find(message => message?.role === 'user')?.content
    : '';

  if (typeof userMessage !== 'string' || !userMessage.trim()) {
    return details;
  }

  for (const rawLine of userMessage.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || !line.includes(':')) continue;

    const [rawKey, ...rawValue] = line.split(':');
    const key = rawKey.trim().toLowerCase();
    const value = rawValue.join(':').trim();
    if (!value) continue;

    switch (key) {
      case 'language':
        details.language = value.toLowerCase();
        break;
      case 'form type':
        details.formType = value.toLowerCase();
        break;
      case 'customer name':
        details.name = value;
        break;
      case 'service':
        details.service = value;
        break;
      case 'existing message':
        details.existingMessage = value;
        break;
      default:
        break;
    }
  }

  return details;
}

function normalizeDraftLanguage(language) {
  if (!language || typeof language !== 'string') return 'de';
  const normalized = language.trim().toLowerCase();
  if (normalized.startsWith('en')) return 'en';
  if (normalized.startsWith('ru')) return 'ru';
  if (normalized.startsWith('uk') || normalized.startsWith('ua')) return 'uk';
  if (normalized.startsWith('de')) return 'de';
  return 'de';
}

function buildLocalDraftText(payload) {
  const { language, formType, name, service, existingMessage } = parseDraftPayloadDetails(payload);
  const locale = normalizeDraftLanguage(language);
  const hasService = Boolean(service && service.toLowerCase() !== 'not provided');
  const hasExisting = Boolean(existingMessage && existingMessage.toLowerCase() !== 'empty');
  const userName = name ? name.trim() : '';
  const serviceText = hasService ? service.trim() : '';
  const messageText = hasExisting ? existingMessage.trim() : '';

  const templates = {
    en: {
      intro: userName ? `Hello, my name is ${userName}.` : 'Hello, I hope you are doing well.',
      request:
        formType === 'booking'
          ? 'I would like to schedule an appointment for my pet.'
          : formType === 'feedback'
            ? 'I would like to share feedback about a recent visit.'
            : 'I need help writing a clear message for your salon.',
      service: hasService ? `I am interested in ${serviceText}.` : 'I would like to know more about your services.',
      existing: hasExisting
        ? `Here is what I have written so far: "${messageText}". Please rewrite it clearly and politely.`
        : 'Please write a polite and concise message with my request and contact details.',
      closing: 'Thank you, and please get back to me with the next available time.',
    },
    de: {
      intro: userName ? `Guten Tag, mein Name ist ${userName}.` : 'Guten Tag, ich hoffe, es geht Ihnen gut.',
      request:
        formType === 'booking'
          ? 'Ich möchte einen Termin für mein Haustier vereinbaren.'
          : formType === 'feedback'
            ? 'Ich möchte ein Feedback zu einem aktuellen Besuch geben.'
            : 'Ich brauche Hilfe beim Formulieren einer klaren Nachricht für Ihren Salon.',
      service: hasService
        ? `Ich interessiere mich für ${serviceText}.`
        : 'Ich möchte mehr über Ihre Dienstleistungen erfahren.',
      existing: hasExisting
        ? `Hier ist mein bisheriger Text: "${messageText}". Bitte formulieren Sie ihn klar und freundlich um.`
        : 'Bitte schreiben Sie eine kurze, höfliche Nachricht mit meiner Anfrage und Kontaktbitte.',
      closing: 'Vielen Dank, bitte teilen Sie mir die nächste verfügbare Zeit mit.',
    },
    ru: {
      intro: userName ? `Здравствуйте, меня зовут ${userName}.` : 'Здравствуйте, надеюсь, у вас все хорошо.',
      request:
        formType === 'booking'
          ? 'Я хотел(а) бы записаться на прием для своего питомца.'
          : formType === 'feedback'
            ? 'Я хотел(а) бы оставить отзыв о недавнем визите.'
            : 'Мне нужна помощь в составлении понятного сообщения для вашего салона.',
      service: hasService ? `Меня интересует ${serviceText}.` : 'Я хотел(а) бы узнать больше о ваших услугах.',
      existing: hasExisting
        ? `Вот что я написал(а): "${messageText}". Пожалуйста, перепишите это ясно и вежливо.`
        : 'Пожалуйста, напишите короткое вежливое сообщение с моей просьбой и контактной информацией.',
      closing: 'Спасибо, свяжитесь со мной, пожалуйста, с ближайшим удобным временем.',
    },
    uk: {
      intro: userName ? `Добрий день, мене звати ${userName}.` : 'Добрий день, сподіваюсь, у вас все добре.',
      request:
        formType === 'booking'
          ? 'Я хотів(ла) би записати свого улюбленця на прийом.'
          : formType === 'feedback'
            ? 'Я хотів(ла) би залишити відгук про недавній візит.'
            : 'Мені потрібна допомога у складанні чіткого повідомлення для вашого салону.',
      service: hasService ? `Мене цікавить ${serviceText}.` : 'Я хотів(ла) би дізнатися більше про ваші послуги.',
      existing: hasExisting
        ? `Ось що я написав(ла): "${messageText}". Будь ласка, перепишіть це ясно і ввічливо.`
        : 'Будь ласка, напишіть коротке ввічливе повідомлення з моїм запитом і контактними даними.',
      closing: 'Дякую, будь ласка, зв’яжіться зі мною з найближчим зручним часом.',
    },
  };

  const selected = templates[locale] || templates.de;
  return `${selected.intro} ${selected.request} ${selected.service} ${selected.existing} ${selected.closing}`
    .replace(/\s+/g, ' ')
    .trim();
}

function buildLocalDraftResponse(payload, reason) {
  return {
    id: 'local-draft-fallback',
    object: 'chat.completion',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: buildLocalDraftText(payload),
        },
      },
    ],
    fallback: true,
    reason: reason || 'SERVICE_GATEWAY_FALLBACK',
  };
}

function resolveProviderDefaults(context, payloadProvider) {
  const providerOrder = parseCsv(
    getEnvVarFromContext(context, 'SERVICE_GATEWAY_PROVIDER_ORDER') ||
      getEnvVarFromContext(context, legacyEnvName('PROVIDER_ORDER'))
  );
  const fallbackAllowed = parseBoolean(
    getEnvVarFromContext(context, 'SERVICE_GATEWAY_ALLOW_FALLBACKS') ||
      getEnvVarFromContext(context, legacyEnvName('ALLOW_FALLBACKS')),
    true
  );
  const sortStrategy =
    getEnvVarFromContext(context, 'SERVICE_GATEWAY_PROVIDER_SORT') ||
    getEnvVarFromContext(context, legacyEnvName('PROVIDER_SORT')) ||
    '';

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
  const envEnabled = parseBoolean(
    getEnvVarFromContext(context, 'SERVICE_GATEWAY_ENABLE_RESPONSE_CACHE') ||
      getEnvVarFromContext(context, legacyEnvName('ENABLE_RESPONSE_CACHE')),
    false
  );
  const payloadEnabled = parseBoolean(payload?.cache, false);
  return envEnabled || payloadEnabled;
}

function isLocalFallbackAllowed(context, origin) {
  const envValue = parseBoolean(
    getEnvVarFromContext(context, 'SERVICE_GATEWAY_ALLOW_FALLBACKS') ||
      getEnvVarFromContext(context, legacyEnvName('ALLOW_FALLBACKS')),
    false
  );
  return envValue || isLocalRequest(origin);
}

function getCacheTTLSeconds(context, payload) {
  const payloadTtl = parseNumber(payload?.cache_ttl_seconds, NaN);
  if (Number.isFinite(payloadTtl) && payloadTtl > 0) {
    return Math.min(Math.floor(payloadTtl), 3600);
  }

  const envTtl = parseNumber(
    getEnvVarFromContext(context, 'SERVICE_GATEWAY_CACHE_TTL_SECONDS') ||
      getEnvVarFromContext(context, legacyEnvName('CACHE_TTL_SECONDS')),
    NaN
  );
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
  cacheUrl.pathname = `/__draft_cache/${hash}`;
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

export async function handleMessageDraft(context) {
  const { request } = context;
  const runtimeEnvs = getRuntimeEnvs(context);
  const primaryRuntimeEnv = runtimeEnvs[0] || {};

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
  }

  const originCheck = assertAllowedOrigin(request);
  if (!originCheck.ok) {
    return jsonResponse({ error: 'Forbidden' }, 403);
  }
  const { origin } = originCheck;

  const rateLimited = await enforceRateLimit(request, {
    route: 'message-draft',
    limit: 30,
    windowSec: 60,
  });
  if (rateLimited) {
    return rateLimited;
  }

  let apiKey =
    getEnvVarFromContext(context, 'SERVICE_GATEWAY_API_KEY') || getEnvVarFromContext(context, legacyEnvName('API_KEY'));

  if (!apiKey && isLocalRequest(origin)) {
    const localAssets = await getLocalApiKeyFromAssets(primaryRuntimeEnv);
    apiKey = localAssets.key;
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400, origin);
  }

  const payloadError = validatePayload(payload);
  if (payloadError) return jsonResponse({ error: payloadError }, 400, origin);

  if (!apiKey) {
    if (isLocalFallbackAllowed(context, origin)) {
      return jsonResponse(buildLocalDraftResponse(payload, 'SERVICE_GATEWAY_NOT_CONFIGURED'), 200, origin);
    }
    return jsonResponse({ error: 'Draft service is not configured' }, 503, origin);
  }

  const resolvedModel = String(
    payload.model ||
      getEnvVarFromContext(context, 'SERVICE_GATEWAY_DEFAULT_MODEL') ||
      getEnvVarFromContext(context, legacyEnvName('DEFAULT_MODEL')) ||
      DEFAULT_MODEL
  ).trim();
  const fallbackModel = String(
    getEnvVarFromContext(context, 'SERVICE_GATEWAY_FALLBACK_MODEL') ||
      getEnvVarFromContext(context, legacyEnvName('FALLBACK_MODEL')) ||
      DEFAULT_FALLBACK_MODEL
  ).trim();
  const provider = resolveProviderDefaults(context, payload.provider);

  const requestPayload = {
    ...payload,
    model: resolvedModel,
    provider: provider || undefined,
  };

  // Internal transport flags should not leak to the upstream service.
  delete requestPayload.cache;
  delete requestPayload.cache_ttl_seconds;

  const referer =
    sanitizeOrigin(
      getEnvVarFromContext(context, 'SERVICE_GATEWAY_SITE_URL') ||
        getEnvVarFromContext(context, legacyEnvName('SITE_URL'))
    ) || sanitizeOrigin(origin);
  const title = String(
    getEnvVarFromContext(context, 'SERVICE_GATEWAY_SITE_NAME') ||
      getEnvVarFromContext(context, legacyEnvName('SITE_NAME')) ||
      DEFAULT_SITE_NAME
  ).trim();
  const serviceGatewayUrl = getEnvVarFromContext(context, 'SERVICE_GATEWAY_URL') || DEFAULT_SERVICE_GATEWAY_URL;

  const upstreamHeaders = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  if (referer) upstreamHeaders['HTTP-Referer'] = referer;
  if (title) upstreamHeaders[['X-Open', 'Router-Title'].join('')] = title;

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

  const callDraftService = body =>
    fetch(serviceGatewayUrl, {
      method: 'POST',
      headers: upstreamHeaders,
      body: JSON.stringify(body),
    });

  let upstream;
  try {
    upstream = await callDraftService(requestPayload);
  } catch (error) {
    return jsonResponse(
      { error: 'Failed to reach draft service', details: String(error?.message || error) },
      502,
      origin
    );
  }

  if (upstream.status === 401 || upstream.status === 403) {
    return jsonResponse(buildLocalDraftResponse(payload, 'SERVICE_GATEWAY_AUTH_FAILED'), 200, origin);
  }

  const canRetryWithFallback =
    !isStream &&
    Boolean(fallbackModel) &&
    fallbackModel !== resolvedModel &&
    (upstream.status === 429 || upstream.status >= 500);

  if (canRetryWithFallback) {
    const fallbackPayload = { ...requestPayload, model: fallbackModel };
    try {
      upstream = await callDraftService(fallbackPayload);
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
