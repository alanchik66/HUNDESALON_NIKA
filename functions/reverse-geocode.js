import {
  applyCorsResponseHeaders,
  enforceRateLimit,
  getPublicReadCorsOrigin,
  jsonResponse,
} from './_lib/http-security.js';

const NOMINATIM_REVERSE_ENDPOINT = 'https://nominatim.openstreetmap.org/reverse';
const PHOTON_REVERSE_ENDPOINT = 'https://photon.komoot.io/reverse';
const REVERSE_CACHE_TTL_SECONDS = 5 * 60;
const CLIENT_CACHE_TTL_SECONDS = 60;
const PROVIDER_TIMEOUT_MS = 8000;
const PROVIDER_USER_AGENT =
  'HundesalonNikaWeather/1.0 (+https://hundesalon-nika.com/kontakty.html)';
const OSM_ATTRIBUTION_URL = 'https://www.openstreetmap.org/copyright';

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function parseReverseCoordinates(latitudeValue, longitudeValue) {
  const latitude = finiteNumber(latitudeValue);
  const longitude = finiteNumber(longitudeValue);
  if (
    latitude === null ||
    longitude === null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }
  return { latitude, longitude };
}

function normalizeLanguage(value) {
  const language = String(value || '')
    .trim()
    .toLowerCase()
    .split(/[-_]/)[0];
  return ['de', 'en', 'ru', 'uk'].includes(language) ? language : 'de';
}

function firstText(...values) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) {
      return text;
    }
  }
  return '';
}

export function buildDistrictLabel(address) {
  if (!address || typeof address !== 'object') {
    return '';
  }

  const city = firstText(
    address.city,
    address.town,
    address.village,
    address.municipality,
    address.county
  );
  const district = firstText(
    address.suburb,
    address.neighbourhood,
    address.neighborhood,
    address.quarter,
    address.hamlet,
    address.city_district,
    address.district,
    address.borough
  );

  if (city && district && city.toLowerCase() !== district.toLowerCase()) {
    return `${city} - ${district}`;
  }
  return district || city || firstText(address.state_district, address.state, address.region, address.country);
}

function buildDisplayName(address) {
  return [
    buildDistrictLabel(address),
    firstText(address.state, address.region),
    firstText(address.country),
  ]
    .filter(Boolean)
    .join(', ');
}

function sanitizeDisplayAddress(address) {
  const safeAddress = { ...address };
  [
    'house_number',
    'housenumber',
    'road',
    'pedestrian',
    'residential',
    'footway',
    'path',
    'street',
  ].forEach(key => delete safeAddress[key]);
  return safeAddress;
}

function getDisplayPrecision(address) {
  if (
    firstText(
      address.suburb,
      address.neighbourhood,
      address.neighborhood,
      address.quarter,
      address.hamlet,
      address.city_district,
      address.district,
      address.borough
    )
  ) {
    return 'district';
  }
  if (firstText(address.city, address.town, address.village, address.municipality, address.county)) {
    return 'city';
  }
  return 'region';
}

export function normalizeNominatimReverse(payload, coordinates) {
  const address = payload?.address;
  if (!address || typeof address !== 'object') {
    return null;
  }

  const latitude = finiteNumber(payload?.lat) ?? coordinates.latitude;
  const longitude = finiteNumber(payload?.lon) ?? coordinates.longitude;
  const label = buildDistrictLabel(address);
  if (!label) {
    return null;
  }
  const displayAddress = sanitizeDisplayAddress(address);

  return {
    name: label,
    label,
    display_name: buildDisplayName(displayAddress),
    lat: String(latitude),
    lon: String(longitude),
    address: displayAddress,
    provider: 'nominatim',
    attribution: 'OpenStreetMap contributors',
    attribution_url: OSM_ATTRIBUTION_URL,
    precision: firstText(address.house_number) ? 'building' : firstText(address.road) ? 'road' : 'locality',
    display_precision: getDisplayPrecision(address),
  };
}

export function normalizePhotonReverse(payload, coordinates) {
  const feature = payload?.features?.[0];
  const properties = feature?.properties || {};
  const featureCoordinates = feature?.geometry?.coordinates || [];
  const latitude = finiteNumber(featureCoordinates[1]) ?? coordinates.latitude;
  const longitude = finiteNumber(featureCoordinates[0]) ?? coordinates.longitude;
  const address = {
    house_number: firstText(properties.housenumber),
    road: firstText(properties.street),
    suburb: firstText(properties.district, properties.locality),
    city_district: firstText(properties.district),
    neighbourhood: firstText(properties.locality),
    city: firstText(properties.city),
    town: firstText(properties.town),
    village: firstText(properties.village),
    county: firstText(properties.county),
    state: firstText(properties.state),
    postcode: firstText(properties.postcode),
    country: firstText(properties.country),
    country_code: String(properties.countrycode || '').toLowerCase(),
  };
  const label = buildDistrictLabel(address);
  if (!label) {
    return null;
  }
  const displayAddress = sanitizeDisplayAddress(address);

  return {
    name: label,
    label,
    display_name: buildDisplayName(displayAddress),
    lat: String(latitude),
    lon: String(longitude),
    address: displayAddress,
    provider: 'photon',
    attribution: 'OpenStreetMap contributors',
    attribution_url: OSM_ATTRIBUTION_URL,
    precision: address.house_number ? 'building' : address.road ? 'road' : 'locality',
    display_precision: getDisplayPrecision(address),
  };
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': PROVIDER_USER_AGENT,
        Referer: 'https://hundesalon-nika.com/',
        ...(options.headers || {}),
      },
    });
    if (!response.ok) {
      throw new Error(`Provider returned ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchNominatimReverse(coordinates, language) {
  const url = new URL(NOMINATIM_REVERSE_ENDPOINT);
  url.searchParams.set('lat', coordinates.latitude.toFixed(6));
  url.searchParams.set('lon', coordinates.longitude.toFixed(6));
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('zoom', '18');
  url.searchParams.set('layer', 'address');
  url.searchParams.set('accept-language', language);
  return fetchJson(url);
}

async function fetchPhotonReverse(coordinates, language) {
  const url = new URL(PHOTON_REVERSE_ENDPOINT);
  url.searchParams.set('lat', coordinates.latitude.toFixed(6));
  url.searchParams.set('lon', coordinates.longitude.toFixed(6));
  url.searchParams.set('lang', language);
  url.searchParams.set('limit', '1');
  return fetchJson(url);
}

function apiResponse(payload, { cacheStatus = 'MISS', method = 'GET' } = {}) {
  return new Response(method === 'HEAD' ? null : JSON.stringify(payload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `private, max-age=${CLIENT_CACHE_TTL_SECONDS}, stale-while-revalidate=240`,
      'X-Content-Type-Options': 'nosniff',
      'X-Geocode-Cache': cacheStatus,
      Vary: 'Accept-Language',
    },
  });
}

function getDefaultCache() {
  return typeof caches !== 'undefined' ? caches.default : null;
}

async function readCachedPayload(cache, cacheKey) {
  if (!cache) return null;
  const response = await cache.match(cacheKey);
  if (!response) return null;
  return response.json().catch(() => null);
}

function storeCachedPayload(context, cache, cacheKey, payload) {
  if (!cache) return;
  const response = new Response(JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `max-age=${REVERSE_CACHE_TTL_SECONDS}`,
    },
  });
  const operation = cache.put(cacheKey, response);
  if (typeof context.waitUntil === 'function') {
    context.waitUntil(operation);
  }
}

export async function onRequest(context) {
  const { request } = context;
  const corsOrigin = getPublicReadCorsOrigin(request);
  const respond = response => applyCorsResponseHeaders(response, corsOrigin);

  if (!['GET', 'HEAD'].includes(request.method)) {
    return respond(jsonResponse({ error: 'Method not allowed' }, 405));
  }

  const url = new URL(request.url);
  const coordinates = parseReverseCoordinates(url.searchParams.get('lat'), url.searchParams.get('lon'));
  if (!coordinates) {
    return respond(jsonResponse({ error: 'Valid lat and lon values are required' }, 400));
  }

  const language = normalizeLanguage(
    url.searchParams.get('lang') ||
      url.searchParams.get('accept-language') ||
      request.headers.get('Accept-Language')
  );
  const cache = getDefaultCache();
  const cacheKey = new Request(
    `https://reverse-geocode-cache.hundesalon-nika.internal/v3/${coordinates.latitude.toFixed(5)}/${coordinates.longitude.toFixed(5)}/${language}`
  );
  const cachedPayload = await readCachedPayload(cache, cacheKey);
  if (cachedPayload) {
    return respond(apiResponse(cachedPayload, { cacheStatus: 'HIT', method: request.method }));
  }

  const rateLimitResponse = await enforceRateLimit(request, {
    route: 'reverse-geocode',
    limit: 18,
    windowSec: 60,
  });
  if (rateLimitResponse) {
    return respond(rateLimitResponse);
  }

  let normalized = null;
  try {
    normalized = normalizeNominatimReverse(
      await fetchNominatimReverse(coordinates, language),
      coordinates
    );
  } catch {
    normalized = null;
  }

  if (!normalized) {
    try {
      normalized = normalizePhotonReverse(
        await fetchPhotonReverse(coordinates, language),
        coordinates
      );
    } catch {
      normalized = null;
    }
  }

  if (!normalized) {
    return respond(jsonResponse({ error: 'Reverse geocoding providers are temporarily unavailable' }, 502));
  }

  const payload = {
    ...normalized,
    payload: normalized,
  };
  storeCachedPayload(context, cache, cacheKey, payload);
  return respond(apiResponse(payload, { method: request.method }));
}
