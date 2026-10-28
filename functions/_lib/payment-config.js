import { cleanText, getEnvValue, hasUsableValue } from './platform-integrations.js';

const ENABLED_VALUES = new Set(['1', 'true', 'on', 'yes']);
export const PAYMENT_ORDER_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const PAYMENT_STATUS_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export function paymentConfiguration(env) {
  const key = getEnvValue(env, 'STRIPE_SECRET_KEY') || getEnvValue(env, 'PAYMENT_PROVIDER_KEY') || '';
  const requestedMode = cleanText(getEnvValue(env, 'STRIPE_MODE', 'live'), 16).toLowerCase();
  const testEnvironment = getEnvValue(env, 'PAYMENTS_ENVIRONMENT') === 'test';
  const mode = requestedMode === 'test' && testEnvironment ? 'test' : 'live';
  const modeConfigured = requestedMode === 'live' || (requestedMode === 'test' && testEnvironment);
  const keyMatchesMode = mode === 'test' ? /^(sk|rk)_test_/.test(key) : /^(sk|rk)_live_/.test(key);
  const amountValue = Number(getEnvValue(env, 'STRIPE_DEPOSIT_AMOUNT_CENTS') || 2000);
  const amount = Number.isSafeInteger(amountValue) && amountValue >= 500 && amountValue <= 100000 ? amountValue : 2000;
  const emailConfigured =
    hasUsableValue(getEnvValue(env, 'SENDPULSE_API_KEY')) ||
    (hasUsableValue(getEnvValue(env, 'SENDPULSE_CLIENT_ID')) &&
      hasUsableValue(getEnvValue(env, 'SENDPULSE_CLIENT_SECRET')));
  const configured =
    modeConfigured &&
    keyMatchesMode &&
    hasUsableValue(getEnvValue(env, 'STRIPE_WEBHOOK_SECRET')) &&
    Boolean(env.CHAT_DB?.prepare && env.CHAT_DB?.batch) &&
    emailConfigured &&
    hasUsableValue(getEnvValue(env, 'SHEET_ID'));
  return {
    enabled: ENABLED_VALUES.has(cleanText(getEnvValue(env, 'PAYMENTS_ONLINE_ENABLED'), 16).toLowerCase()) && configured,
    mode,
    key,
    amount,
    currency: 'eur',
  };
}

export async function hashPaymentStatusToken(token) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(token || '')));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function createPaymentStatusToken() {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function paymentSiteOrigin(env) {
  const configured =
    getEnvValue(env, 'SITE_ORIGIN') || getEnvValue(env, 'PUBLIC_SITE_URL') || 'https://hundesalon-nika.com';
  try {
    const url = new URL(configured);
    if (url.protocol === 'https:' && ['hundesalon-nika.com', 'www.hundesalon-nika.com'].includes(url.hostname))
      return url.origin;
    if (
      getEnvValue(env, 'PAYMENTS_ENVIRONMENT') === 'test' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    )
      return url.origin;
    if (
      getEnvValue(env, 'PAYMENTS_ENVIRONMENT') === 'test' &&
      url.protocol === 'https:' &&
      url.hostname.endsWith('.hundesalon-nika.pages.dev')
    )
      return url.origin;
  } catch {
    /* Fail closed to the canonical public origin. */
  }
  return 'https://hundesalon-nika.com';
}
