import { enforceRateLimit, jsonResponse } from '../_lib/http-security.js';

const GIPHY_API_ORIGIN = 'https://api.giphy.com';
const ALLOWED_LOCALES = new Set(['de', 'en', 'ru', 'uk']);
const RESULT_LIMIT = 24;

function cleanQuery(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 50);
}

function safeGiphyUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && /(^|\.)giphy\.com$/i.test(url.hostname) ? url.href : '';
  } catch {
    return '';
  }
}

function normalizedItem(item) {
  const preview = safeGiphyUrl(item?.images?.fixed_width_downsampled?.webp || item?.images?.fixed_width?.webp);
  const url = safeGiphyUrl(item?.images?.original?.webp || item?.images?.original?.url);
  if (!item?.id || !preview || !url) return null;
  return {
    id: String(item.id).slice(0, 80),
    title: String(item.title || item.alt_text || 'GIF').trim().slice(0, 160) || 'GIF',
    preview,
    url,
  };
}

export async function onRequestGet({ request, env }) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const apiKey = String(env?.GIPHY_API_KEY || '').trim();
  if (!apiKey) {
    return jsonResponse({ success: false, configured: false, message: 'GIF search is not configured.' }, 503, origin);
  }

  const limited = await enforceRateLimit(request, { route: 'ai-chat-gifs', limit: 30, windowSec: 60 });
  if (limited) return limited;

  const query = cleanQuery(requestUrl.searchParams.get('q'));
  const requestedLocale = String(requestUrl.searchParams.get('locale') || '').toLowerCase().slice(0, 2);
  const locale = ALLOWED_LOCALES.has(requestedLocale) ? requestedLocale : 'de';
  const endpoint = query ? 'search' : 'trending';
  const params = new URLSearchParams({
    api_key: apiKey,
    limit: String(RESULT_LIMIT),
    rating: 'g',
    lang: locale,
    bundle: 'messaging_non_clips',
    remove_low_contrast: 'true',
  });
  if (query) params.set('q', query);
  const countryCode = String(request.cf?.country || '').toUpperCase();
  const regionCode = String(request.cf?.regionCode || '').toUpperCase();
  if (/^[A-Z]{2}$/.test(countryCode)) params.set('country_code', countryCode);
  if (/^[A-Z0-9-]{1,6}$/.test(regionCode)) params.set('region', regionCode);

  try {
    const response = await fetch(`${GIPHY_API_ORIGIN}/v1/gifs/${endpoint}?${params}`);
    if (!response.ok) {
      console.error('[ai-chat-gifs] GIPHY request failed', JSON.stringify({ status: response.status, endpoint }));
      return jsonResponse({ success: false, message: 'GIF search is unavailable.' }, 502, origin);
    }
    const payload = await response.json();
    const items = (Array.isArray(payload?.data) ? payload.data : []).map(normalizedItem).filter(Boolean);
    return new Response(JSON.stringify({ success: true, items }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': query ? 'public, max-age=60' : 'public, max-age=300',
      },
    });
  } catch (error) {
    console.error('[ai-chat-gifs] GIPHY request error', error instanceof Error ? error.message : 'unknown');
    return jsonResponse({ success: false, message: 'GIF search is unavailable.' }, 502, origin);
  }
}
