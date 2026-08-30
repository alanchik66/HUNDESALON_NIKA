/**
 * Cloudflare Pages Function: POST /message-draft
 * Secure proxy for contact-form draft completions.
 */

import {
  sanitizeOrigin,
  assertAllowedOrigin,
  enforceRateLimit,
  isLocalDevOrigin,
  jsonResponse,
} from './http-security.js';
import {
  AI_PROVIDER_POLICY,
  APPROVED_AI_MODEL,
  DEFAULT_DRAFT_MAX_TOKENS,
  hasAiServiceAuth,
  MAX_DRAFT_MAX_TOKENS,
  MAX_DRAFT_MESSAGES,
  MAX_DRAFT_MESSAGE_CONTENT_LENGTH,
  getContextEnvVar,
  parseBoundedTokens,
  resolveApprovedModel,
} from './ai-policy.js';

const LEGACY_SERVICE_PREFIX = ['OPEN', 'ROUTER'].join('');
const DEFAULT_SERVICE_GATEWAY_URL = ['https://', 'open', 'router.ai', '/api/v1/chat/completions'].join('');
const DEFAULT_SITE_NAME = 'HUNDESALON NIKA';

function legacyEnvName(suffix) {
  return `${LEGACY_SERVICE_PREFIX}_${suffix}`;
}

function isLocalRequest(origin) {
  return isLocalDevOrigin(origin);
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

function cleanPublicDraftField(value, maxLength) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function buildPublicDraftPayload(payload) {
  const draft = payload?.draft;
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return null;

  const language = normalizeDraftLanguage(cleanPublicDraftField(draft.language, 8));
  const requestedFormType = cleanPublicDraftField(draft.formType, 40).toLowerCase();
  const formType = ['booking', 'contact', 'feedback', 'client_registration'].includes(requestedFormType)
    ? requestedFormType
    : 'contact';
  const name = cleanPublicDraftField(draft.name, 160);
  const service = cleanPublicDraftField(draft.service, 240);
  const existingMessage = cleanPublicDraftField(draft.existingMessage, 2000);

  return {
    messages: [
      {
        role: 'user',
        content: [
          `Language: ${language}`,
          `Form type: ${formType}`,
          `Customer name: ${name || 'not provided'}`,
          `Service: ${service || 'not provided'}`,
          `Existing message: ${existingMessage || 'empty'}`,
        ].join('\n'),
      },
    ],
  };
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') return 'Body must be an object';
  if (!Array.isArray(payload.messages) || payload.messages.length < 1) return 'Body must include messages[]';
  if (payload.messages.length > MAX_DRAFT_MESSAGES) return `Too many messages. Max allowed: ${MAX_DRAFT_MESSAGES}`;

  if (payload.model && resolveApprovedModel(payload.model) !== APPROVED_AI_MODEL) {
    return 'Unsupported AI model';
  }
  if (payload.provider !== undefined) return 'Provider selection is managed by the service';

  const hasInvalidMessage = payload.messages.some(
    message => !['system', 'user', 'assistant'].includes(message?.role) || typeof message?.content !== 'string'
  );
  if (hasInvalidMessage) return 'Messages must use supported roles and text content';

  const hasOversizedMessage = payload.messages.some(msg => {
    const content = typeof msg?.content === 'string' ? msg.content : '';
    return content.length > MAX_DRAFT_MESSAGE_CONTENT_LENGTH;
  });

  if (hasOversizedMessage)
    return `Message content too large. Max ${MAX_DRAFT_MESSAGE_CONTENT_LENGTH} chars per message.`;

  return '';
}

export async function handleMessageDraft(context) {
  const { request } = context;

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
    limit: 10,
    windowSec: 60,
  });
  if (rateLimited) {
    return rateLimited;
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400, origin);
  }

  const publicDraftPayload = buildPublicDraftPayload(payload);
  if (publicDraftPayload) {
    return jsonResponse(buildLocalDraftResponse(publicDraftPayload, 'PUBLIC_FIXED_TEMPLATE'), 200, origin);
  }

  if (!hasAiServiceAuth(request, context)) {
    return jsonResponse({ error: 'AI service authorization required' }, 401, origin);
  }

  const payloadError = validatePayload(payload);
  if (payloadError) return jsonResponse({ error: payloadError }, 400, origin);

  const apiKey =
    getEnvVarFromContext(context, 'SERVICE_GATEWAY_API_KEY') || getEnvVarFromContext(context, legacyEnvName('API_KEY'));

  if (!apiKey) {
    if (isLocalRequest(origin)) {
      return jsonResponse(buildLocalDraftResponse(payload, 'SERVICE_GATEWAY_NOT_CONFIGURED'), 200, origin);
    }
    return jsonResponse({ error: 'Draft service is not configured' }, 503, origin);
  }

  const configuredModel =
    getContextEnvVar(context, 'SERVICE_GATEWAY_DEFAULT_MODEL') ||
    getContextEnvVar(context, legacyEnvName('DEFAULT_MODEL'));
  const resolvedModel = resolveApprovedModel(configuredModel);
  if (!resolvedModel) {
    return jsonResponse({ error: 'AI model configuration rejected' }, 503, origin);
  }
  const maxTokens = parseBoundedTokens(
    getContextEnvVar(context, 'SERVICE_GATEWAY_MAX_TOKENS'),
    DEFAULT_DRAFT_MAX_TOKENS,
    64,
    MAX_DRAFT_MAX_TOKENS
  );

  const requestPayload = {
    messages: payload.messages.map(({ role, content }) => ({ role, content })),
    model: resolvedModel,
    temperature: 0.2,
    max_tokens: maxTokens,
    provider: AI_PROVIDER_POLICY,
  };

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
  const serviceGatewayUrl = DEFAULT_SERVICE_GATEWAY_URL;

  const upstreamHeaders = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  if (referer) upstreamHeaders['HTTP-Referer'] = referer;
  if (title) upstreamHeaders[['X-Open', 'Router-Title'].join('')] = title;

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

  const text = await upstream.text();
  if (!upstream.ok) return jsonResponse({ error: 'Draft service request failed' }, 502, origin);
  return new Response(text, {
    status: 200,
    headers: { 'Content-Type': upstream.headers.get('Content-Type') || 'application/json; charset=utf-8' },
  });
}
