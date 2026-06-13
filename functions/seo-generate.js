/**
 * Cloudflare Pages Function: POST /seo-generate
 * ============================================
 * Generates multilingual SEO payload and returns strict JSON.
 *
 * Required env vars:
 *   SERVICE_GATEWAY_API_KEY
 *
 * Recommended env vars:
 *   SERVICE_GATEWAY_SITE_URL
 *   SERVICE_GATEWAY_SITE_NAME
 *   SERVICE_GATEWAY_SEO_MODEL
 *   SERVICE_GATEWAY_SEO_FALLBACK_MODEL
 *   SERVICE_GATEWAY_SEO_MAX_TOKENS
 */

import {
  sanitizeOrigin,
  assertAllowedOrigin,
  enforceRateLimit,
  jsonResponse,
} from './_lib/http-security.js';

const LEGACY_SERVICE_PREFIX = ['OPEN', 'ROUTER'].join('');
const DEFAULT_SERVICE_GATEWAY_URL = ['https://', 'open', 'router.ai', '/api/v1/chat/completions'].join('');
const DEFAULT_SEO_MODEL = 'google/gemini-2.5-flash-lite';
const DEFAULT_SEO_FALLBACK_MODEL = 'deepseek/deepseek-v4-flash';
const DEFAULT_SEO_MAX_TOKENS = 720;
const LOCALES = ['de', 'en', 'ru', 'uk'];
const SEO_LOCALE_FIELDS = ['title', 'description', 'h1', 'shortBlock'];

function legacyEnvName(suffix) {
  return `${LEGACY_SERVICE_PREFIX}_${suffix}`;
}

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
  if (text && typeof text === 'object' && !Array.isArray(text)) {
    return text;
  }

  if (Array.isArray(text)) {
    const merged = text
      .map(part => {
        if (typeof part === 'string') return part;
        if (typeof part?.text === 'string') return part.text;
        return '';
      })
      .join('\n')
      .trim();
    if (!merged) return null;
    return parseJsonMaybe(merged);
  }

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

function parseBoundedInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function assertLocalePayload(payload) {
  if (!payload || typeof payload !== 'object') return false;

  for (const locale of LOCALES) {
    const node = payload[locale];
    if (!node || typeof node !== 'object') return false;

    for (const key of SEO_LOCALE_FIELDS) {
      if (typeof node[key] !== 'string') return false;
      if (!sanitizeText(node[key])) return false;
    }
  }

  return true;
}

function getQualityIssues(localesPayload) {
  const issues = [];

  for (const locale of LOCALES) {
    const node = localesPayload[locale] || {};
    const titleLength = sanitizeText(node.title).length;
    const descriptionLength = sanitizeText(node.description).length;
    const h1Length = sanitizeText(node.h1).length;
    const shortBlockLength = sanitizeText(node.shortBlock).length;

    if (titleLength < 40 || titleLength > 70) issues.push(`${locale}.title:${titleLength}`);
    if (descriptionLength < 120 || descriptionLength > 170) issues.push(`${locale}.description:${descriptionLength}`);
    if (h1Length < 10 || h1Length > 80) issues.push(`${locale}.h1:${h1Length}`);
    if (shortBlockLength < 60 || shortBlockLength > 320) issues.push(`${locale}.shortBlock:${shortBlockLength}`);
  }

  return issues;
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
    '- shortBlock: 1-2 concise sentences, practical and trust-building, locale-native.',
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

  const apiKey = getEnvVarFromContext(context, 'SERVICE_GATEWAY_API_KEY') || getEnvVarFromContext(context, legacyEnvName('API_KEY'));
  if (!apiKey) {
    return jsonResponse({ error: 'Content service is not configured' }, 503, origin);
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

  const referer =
    sanitizeOrigin(
      getEnvVarFromContext(context, 'SERVICE_GATEWAY_SITE_URL') ||
        getEnvVarFromContext(context, legacyEnvName('SITE_URL'))
    ) || sanitizeOrigin(origin);
  const title = String(
    getEnvVarFromContext(context, 'SERVICE_GATEWAY_SITE_NAME') ||
      getEnvVarFromContext(context, legacyEnvName('SITE_NAME')) ||
      'HUNDESALON NIKA'
  ).trim();
  const model = String(
    getEnvVarFromContext(context, 'SERVICE_GATEWAY_SEO_MODEL') ||
      getEnvVarFromContext(context, legacyEnvName('SEO_MODEL')) ||
      DEFAULT_SEO_MODEL
  ).trim();
  const fallbackModel = String(
    getEnvVarFromContext(context, 'SERVICE_GATEWAY_SEO_FALLBACK_MODEL') ||
      getEnvVarFromContext(context, legacyEnvName('SEO_FALLBACK_MODEL')) ||
      DEFAULT_SEO_FALLBACK_MODEL
  ).trim();
  const maxTokens = parseBoundedInteger(
    getEnvVarFromContext(context, 'SERVICE_GATEWAY_SEO_MAX_TOKENS') ||
      getEnvVarFromContext(context, legacyEnvName('SEO_MAX_TOKENS')),
    DEFAULT_SEO_MAX_TOKENS,
    360,
    1200
  );
  const serviceGatewayUrl =
    getEnvVarFromContext(context, 'SERVICE_GATEWAY_URL') || DEFAULT_SERVICE_GATEWAY_URL;

  const upstreamHeaders = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  if (referer) upstreamHeaders['HTTP-Referer'] = referer;
  if (title) upstreamHeaders[['X-Open', 'Router-Title'].join('')] = title;

  const basePayload = {
    temperature: 0.25,
    max_tokens: maxTokens,
    messages: [
      {
        role: 'system',
        content: 'You are an expert multilingual SEO copywriter for a premium pet grooming salon website. Output valid JSON only.',
      },
      {
        role: 'user',
        content: buildPrompt(input),
      },
    ],
  };

  const callServiceGateway = body => {
    return fetch(serviceGatewayUrl, {
      method: 'POST',
      headers: upstreamHeaders,
      body: JSON.stringify(body),
    });
  };

  const modelCandidates = [model, fallbackModel].filter((candidate, index, list) => {
    return Boolean(candidate) && list.indexOf(candidate) === index;
  });

  let lastFailure = null;
  let bestUsableResponse = null;

  for (let index = 0; index < modelCandidates.length; index += 1) {
    const modelCandidate = modelCandidates[index];
    const hasNextCandidate = index < modelCandidates.length - 1;
    let upstream;
    try {
      upstream = await callServiceGateway({ ...basePayload, model: modelCandidate });
    } catch (error) {
      lastFailure = {
        error: 'Failed to reach content service',
        details: String(error?.message || error),
        modelUsed: modelCandidate,
      };
      continue;
    }

    const upstreamText = await upstream.text();
    if (!upstream.ok) {
      lastFailure = {
        error: 'Content service request failed',
        status: upstream.status,
        details: upstreamText,
        modelUsed: modelCandidate,
      };

      if (upstream.status === 402 || upstream.status === 429 || upstream.status >= 500) {
        continue;
      }

      return jsonResponse(lastFailure, upstream.status);
    }

    const parsedUpstream = parseJsonMaybe(upstreamText);
    const rawContent = parsedUpstream?.choices?.[0]?.message?.content;
    const seoPayload = parseJsonMaybe(rawContent);

    if (!assertLocalePayload(seoPayload)) {
      lastFailure = {
        error: 'Model output is not valid for required SEO schema',
        modelUsed: modelCandidate,
        raw: rawContent || null,
      };
      continue;
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

    const qualityIssues = getQualityIssues(normalized);
    if (qualityIssues.length) {
      bestUsableResponse = {
        ok: true,
        modelUsed: modelCandidate,
        generatedAt: new Date().toISOString(),
        qualityWarnings: qualityIssues,
        locales: normalized,
        snippets: buildSnippets(normalized),
      };

      if (hasNextCandidate) {
        continue;
      }
    }

    return jsonResponse(
      {
        ok: true,
        modelUsed: modelCandidate,
        generatedAt: new Date().toISOString(),
        qualityWarnings: qualityIssues,
        locales: normalized,
        snippets: buildSnippets(normalized),
      },
      200,
      origin
    );
  }

  if (bestUsableResponse) {
    return jsonResponse(bestUsableResponse, 200, origin);
  }

  return jsonResponse(lastFailure || { error: 'SEO generation failed' }, 502, origin);
}
