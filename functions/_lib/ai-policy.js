/** Shared production policy for the site's paid AI gateway calls. */

export const APPROVED_AI_MODEL = 'google/gemini-2.5-flash-lite';
export const APPROVED_AI_PROVIDER = 'google-ai-studio';
export const AI_PROVIDER_POLICY = Object.freeze({
  only: [APPROVED_AI_PROVIDER],
  allow_fallbacks: false,
  require_parameters: true,
});

export const MAX_DRAFT_MESSAGES = 12;
export const MAX_DRAFT_MESSAGE_CONTENT_LENGTH = 4000;
export const DEFAULT_DRAFT_MAX_TOKENS = 320;
export const MAX_DRAFT_MAX_TOKENS = 320;
export const DEFAULT_SEO_MAX_TOKENS = 720;
export const MAX_SEO_MAX_TOKENS = 720;
export const AI_SERVICE_SECRET_ENV = 'AI_SERVICE_WEBHOOK_SECRET';

function runtimeEnvs(context) {
  return [
    context?.env,
    context?.data,
    context?.platform?.env,
    context?.cloudflare?.env,
    context?.cloudflare?.bindings,
    context?.locals?.env,
  ].filter(candidate => candidate && typeof candidate === 'object');
}

export function getContextEnvVar(context, key) {
  for (const env of runtimeEnvs(context)) {
    const value = env[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  const processValue = globalThis?.process?.env?.[key];
  return typeof processValue === 'string' && processValue.trim() ? processValue.trim() : '';
}

export function getBearerToken(request) {
  const header = String(request.headers.get('Authorization') || '').trim();
  return /^Bearer\s+(.+)$/i.exec(header)?.[1]?.trim() || '';
}

function constantTimeEqual(left, right) {
  if (!left || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export function hasAiServiceAuth(request, context) {
  const secret = getContextEnvVar(context, AI_SERVICE_SECRET_ENV);
  return Boolean(secret) && constantTimeEqual(getBearerToken(request), secret);
}

export function resolveApprovedModel(value) {
  const normalized = String(value || '').trim();
  return !normalized || normalized === APPROVED_AI_MODEL ? APPROVED_AI_MODEL : '';
}

export function parseBoundedTokens(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
}
