/**
 * Cloudflare Pages Function: POST /seo-generate
 * ============================================
 * Generates multilingual SEO payload using OpenRouter and returns strict JSON.
 *
 * Required env vars:
 *   OPENROUTER_API_KEY
 *
 * Recommended env vars:
 *   OPENROUTER_SITE_URL
 *   OPENROUTER_SITE_NAME
 *   OPENROUTER_DEFAULT_MODEL
 *   OPENROUTER_FALLBACK_MODEL
 */

import {
  sanitizeOrigin,
  assertAllowedOrigin,
  enforceRateLimit,
  jsonResponse,
} from './_lib/http-security.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-5.5';
const DEFAULT_FALLBACK_MODEL = 'openai/gpt-5.2';
const LOCALES = ['de', 'en', 'ru', 'uk'];

function getEnvVar(env, key) {
  if (!env || typeof env !== 'object') return '';

  const direct = env[key];
  if (typeof direct === 'string' && direct.trim()) {
    return direct.trim();
  }

  const normalizedKey = String(key || '').trim();
  for (const candidate of Object.keys(env)) {
    const clean = candidate.replace(/^\uFEFF/, '').trim();
    if (clean !== normalizedKey) continue;

    const value = env[candidate];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  // Local Pages dev fallback: read from process env when binding passthrough is inconsistent.
  const processEnv = globalThis?.process?.env;
  if (processEnv && typeof processEnv === 'object') {
    const fromProcess = processEnv[key];
    if (typeof fromProcess === 'string' && fromProcess.trim()) {
      return fromProcess.trim();
    }
  }

  return '';
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

function getEnvVarFromContext(context, key) {
  for (const env of getRuntimeEnvs(context)) {
    const value = getEnvVar(env, key);
    if (value) return value;
  }

  return '';
}

function stripCodeFence(input) {
  const text = String(input || '').trim();
  if (!text.startsWith('```')) return text;
  return text
    .replace(/^```[a-zA-Z]*\s*/, '')
    .replace(/\s*```$/, '')
    .trim();
}

function parseJsonMaybe(text) {
  const normalized = stripCodeFence(text);
  try {
    return JSON.parse(normalized);
  } catch {
    const match = normalized.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function sanitizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function assertLocalePayload(payload) {
  if (!payload || typeof payload !== 'object') return false;

  for (const locale of LOCALES) {
    const node = payload[locale];
    if (!node || typeof node !== 'object') return false;

    for (const key of ['title', 'description', 'h1', 'shortBlock']) {
      if (typeof node[key] !== 'string') return false;
      if (!sanitizeText(node[key])) return false;
    }
  }

  return true;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildSnippets(localesPayload) {
  const snippets = {};

  for (const locale of LOCALES) {
    const node = localesPayload[locale];
    const title = sanitizeText(node.title);
    const description = sanitizeText(node.description);
    const h1 = sanitizeText(node.h1);
    const shortBlock = sanitizeText(node.shortBlock);

    snippets[locale] = {
      titleTag: `<title>${escapeHtml(title)}</title>`,
      metaDescriptionTag: `<meta name="description" content="${escapeHtml(description)}">`,
      h1Tag: `<h1>${escapeHtml(h1)}</h1>`,
      shortBlockHtml: `<p>${escapeHtml(shortBlock)}</p>`,
    };
  }

  return snippets;
}

function buildPrompt(input) {
  const payload = {
    brand: sanitizeText(input.brand || 'HUNDESALON NIKA'),
    city: sanitizeText(input.city || 'Leipzig'),
    pageType: sanitizeText(input.pageType || 'service page'),
    service: sanitizeText(input.service || ''),
    topic: sanitizeText(input.topic || ''),
    usp: sanitizeText(input.usp || ''),
    tone: sanitizeText(input.tone || 'premium, calm, trustworthy'),
    notes: sanitizeText(input.notes || ''),
  };

  return [
    'Create SEO copy for four locales: de, en, ru, uk.',
    'Return JSON only. No markdown, no commentary.',
    'Required JSON schema:',
    '{',
    '  "de": { "title": "", "description": "", "h1": "", "shortBlock": "" },',
    '  "en": { "title": "", "description": "", "h1": "", "shortBlock": "" },',
    '  "ru": { "title": "", "description": "", "h1": "", "shortBlock": "" },',
    '  "uk": { "title": "", "description": "", "h1": "", "shortBlock": "" }',
    '}',
    'Constraints:',
    '- title: 45-65 chars, keyword-forward, no clickbait, locale-native language.',
    '- description: 130-160 chars, local intent and value proposition.',
    '- h1: max 70 chars, human-readable, locale-native.',
    '- shortBlock: 2-3 sentences, practical and trust-building, locale-native.',
    '- Keep content specific to brand and city context.',
    '- No emojis.',
    '- No unsupported claims.',
    'Input:',
    JSON.stringify(payload),
  ].join('\n');
}

export async function onRequest(context) {
  const { request } = context;

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'POST' },
    });
  }

  const originCheck = assertAllowedOrigin(request);
  if (!originCheck.ok) {
    return jsonResponse({ error: 'Forbidden' }, 403);
  }
  const { origin } = originCheck;

  const rateLimited = await enforceRateLimit(request, {
    route: 'seo-generate',
    limit: 8,
    windowSec: 60,
  });
  if (rateLimited) {
    return rateLimited;
  }

  const apiKey = getEnvVarFromContext(context, 'OPENROUTER_API_KEY');
  if (!apiKey) {
    return jsonResponse({ error: 'OPENROUTER_API_KEY is not configured' }, 503, origin);
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!input || typeof input !== 'object') {
    return jsonResponse({ error: 'Body must be an object' }, 400);
  }

  const referer = sanitizeOrigin(getEnvVarFromContext(context, 'OPENROUTER_SITE_URL')) || sanitizeOrigin(origin);
  const title = String(getEnvVarFromContext(context, 'OPENROUTER_SITE_NAME') || 'HUNDESALON NIKA').trim();
  const model = String(getEnvVarFromContext(context, 'OPENROUTER_DEFAULT_MODEL') || DEFAULT_MODEL).trim();
  const fallbackModel = String(
    getEnvVarFromContext(context, 'OPENROUTER_FALLBACK_MODEL') || DEFAULT_FALLBACK_MODEL
  ).trim();

  const upstreamHeaders = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  if (referer) upstreamHeaders['HTTP-Referer'] = referer;
  if (title) upstreamHeaders['X-OpenRouter-Title'] = title;

  const basePayload = {
    model,
    temperature: 0.35,
    max_tokens: 900,
    messages: [
      {
        role: 'system',
        content:
          'You are an expert multilingual SEO copywriter for a premium pet grooming salon website. Output valid JSON only.',
      },
      {
        role: 'user',
        content: buildPrompt(input),
      },
    ],
  };

  const callOpenRouter = body => {
    return fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: upstreamHeaders,
      body: JSON.stringify(body),
    });
  };

  let upstream;
  let modelUsed = model;
  try {
    upstream = await callOpenRouter(basePayload);
  } catch (error) {
    return jsonResponse({ error: 'Failed to reach OpenRouter', details: String(error?.message || error) }, 502);
  }

  if ((upstream.status === 429 || upstream.status >= 500) && fallbackModel && fallbackModel !== model) {
    try {
      upstream = await callOpenRouter({ ...basePayload, model: fallbackModel });
      modelUsed = fallbackModel;
    } catch {
      // Keep original upstream response on fallback network failure.
    }
  }

  const upstreamText = await upstream.text();
  if (!upstream.ok) {
    return jsonResponse(
      {
        error: 'OpenRouter request failed',
        status: upstream.status,
        details: upstreamText,
      },
      upstream.status
    );
  }

  const parsedUpstream = parseJsonMaybe(upstreamText);
  const rawContent = parsedUpstream?.choices?.[0]?.message?.content;
  const seoPayload = parseJsonMaybe(rawContent);

  if (!assertLocalePayload(seoPayload)) {
    return jsonResponse(
      {
        error: 'Model output is not valid for required SEO schema',
        raw: rawContent || null,
      },
      502
    );
  }

  const normalized = {};
  for (const locale of LOCALES) {
    normalized[locale] = {
      title: sanitizeText(seoPayload[locale].title),
      description: sanitizeText(seoPayload[locale].description),
      h1: sanitizeText(seoPayload[locale].h1),
      shortBlock: sanitizeText(seoPayload[locale].shortBlock),
    };
  }

  return jsonResponse({
    ok: true,
    modelUsed,
    generatedAt: new Date().toISOString(),
    locales: normalized,
    snippets: buildSnippets(normalized),
  });
}
