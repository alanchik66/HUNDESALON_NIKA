const WMS = 'https://view.eumetsat.int/geoserver/msg_fes/wms';
const BBOX = [5, 47, 16, 55.8];
const SIZE = 384;
const MAX_AGE_MS = 75 * 60_000;
const CAPABILITIES_LIMIT = 128 * 1024;
const PNG_LIMIT = 192 * 1024;
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

function json(data, status, maxAge = 0, observedAt = null) {
  const headers = new Headers({
    'Cache-Control': maxAge ? `public, max-age=${maxAge}` : 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  });
  if (observedAt) headers.set('X-Observed-At', observedAt);
  return Response.json(data, { status, headers });
}

function sourceUrl(parameters) {
  const url = new URL(WMS);
  url.search = new URLSearchParams({ service: 'WMS', version: '1.3.0', ...parameters });
  return url;
}

async function fetchBytes(url, mime, limit, signal, expectedTime) {
  const response = await fetch(url, { signal, redirect: 'manual', headers: { Accept: mime.join(', ') } });
  const contentType = response.headers.get('content-type')?.split(';', 1)[0].trim();
  // GeoServer can return a nearby frame with HTTP 200 and reports the actual time in Warning.
  const times = (response.headers.get('warning') || '').matchAll(/Nearest value used:\s*time=([^\s,"]+)/gi);
  const differentFrame = expectedTime && Array.from(times).some(([, stamp]) => Date.parse(stamp) !== Date.parse(expectedTime));
  if (response.status !== 200 || !mime.includes(contentType) || differentFrame ||
      Number(response.headers.get('content-length')) > limit || !response.body) {
    await response.body?.cancel();
    throw new Error('Invalid satellite response');
  }
  const reader = response.body.getReader();
  const bytes = new Uint8Array(limit);
  let used = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return bytes.subarray(0, used);
      if (used + value.length > limit) {
        await reader.cancel();
        throw new Error('Satellite response exceeds size limit');
      }
      bytes.set(value, used);
      used += value.length;
    }
  } finally {
    reader.releaseLock();
  }
}

function isFresh(time, now) {
  return Number.isFinite(time) && time <= now && now - time < MAX_AGE_MS;
}

function observedTime(metadata, name, now) {
  const layer = metadata.match(new RegExp(`<Name>(?:msg_fes:)?${name}</Name>([\\s\\S]*?)</Layer>`))?.[1];
  const dimension = layer?.match(/<Dimension\b(?=[^>]*\bname="time")[^>]*>/)?.[0];
  const stamp = dimension?.match(/\bdefault="(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z)"/)?.[1];
  const time = Date.parse(stamp);
  return isFresh(time, now) ? time : null;
}

async function fetchPng(layer, time, signal) {
  const bytes = await fetchBytes(sourceUrl({
    request: 'GetMap',
    layers: `msg_fes:${layer}`,
    styles: '',
    format: 'image/png',
    crs: 'CRS:84',
    bbox: BBOX.join(','),
    width: String(SIZE),
    height: String(SIZE),
    transparent: 'true',
    time,
  }), ['image/png'], PNG_LIMIT, signal, time);
  const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 57 || !PNG_SIGNATURE.every((value, index) => bytes[index] === value) ||
      header.getUint32(8) !== 13 || header.getUint32(12) !== 0x49484452 ||
      header.getUint32(16) !== SIZE || header.getUint32(20) !== SIZE ||
      header.getUint32(bytes.length - 12) !== 0 || header.getUint32(bytes.length - 8) !== 0x49454e44) {
    throw new Error('Invalid satellite PNG');
  }
  let encoded = '';
  for (let index = 0; index < bytes.length; index += 8192) {
    encoded += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }
  return btoa(encoded);
}

export async function onRequest({ request, waitUntil }) {
  if (request.method !== 'GET') {
    const response = json({ error: 'method_not_allowed' }, 405);
    response.headers.set('Allow', 'GET');
    return response;
  }
  const requestUrl = new URL(request.url);
  if (requestUrl.search) return json({ error: 'query_not_supported' }, 400);

  const cache = globalThis.caches?.default;
  const cacheKey = new Request(new URL('/api/satellite-clouds?cache=v3', requestUrl));
  const previous = await cache?.match(cacheKey).catch(() => null);
  if (previous?.ok && isFresh(Date.parse(previous.headers.get('X-Observed-At')), Date.now())) {
    return previous;
  }

  try {
    const signal = globalThis.AbortSignal.timeout(8000);
    const metadata = new TextDecoder().decode(await fetchBytes(
      sourceUrl({ request: 'GetCapabilities' }),
      ['text/xml', 'application/xml'], CAPABILITIES_LIMIT, signal
    ));
    const now = Date.now();
    const maskTime = observedTime(metadata, 'clm', now);
    if (maskTime === null) return json({ error: 'satellite_unavailable' }, 503);
    const topTime = observedTime(metadata, 'cth', now);
    const time = topTime === null ? maskTime : Math.min(maskTime, topTime);
    const observedAt = new Date(time).toISOString();
    const [maskPng, cloudTopPng] = await Promise.all([
      fetchPng('clm', observedAt, signal),
      topTime === null ? null : fetchPng('cth', observedAt, signal).catch(() => null),
    ]);
    const remaining = Math.floor((MAX_AGE_MS - (Date.now() - time)) / 1000);
    if (remaining <= 0) return json({ error: 'satellite_unavailable' }, 503);
    const response = json({
      source: 'eumetsat-msg', observedAt, bbox: BBOX, width: SIZE, height: SIZE, maskPng, cloudTopPng,
    }, 200, Math.min(remaining, cloudTopPng ? 600 : 120), observedAt);
    if (cache) {
      const store = cache.put(cacheKey, response.clone()).catch(() => {});
      if (waitUntil) waitUntil(store);
      else await store;
    }
    return response;
  } catch {
    return json({ error: 'satellite_unavailable' }, 503);
  }
}
