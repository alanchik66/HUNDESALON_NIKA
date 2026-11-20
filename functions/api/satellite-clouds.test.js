import assert from 'node:assert/strict';
import test from 'node:test';

import { onRequest } from './satellite-clouds.js';

const ROUTE = 'https://hundesalon-nika.com/api/satellite-clouds';
const NOW = Date.parse('2026-11-20T19:45:00Z');
const MASK_TIME = '2026-11-20T19:30:00Z';
const TOP_TIME = '2026-11-20T19:15:00Z';
const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAYAAAAGACAAAAACBrOpjAAACFElEQVR42u3RMQEAAAjDMMC/5yEDjlRC0yldNhYAACAAAAQAgAAAEA'
  + 'AAAgBAAAAIAAABACAAAAQAgAAAEAAAAgBAAAAIAAABACAAAAQAgAAAEAAAAgBAAAAIAAABACAAAAQAgAAAEAAAAgBAAAAIAAAAAgBA'
  + 'AAAIAAABACAAAAQAgAAAEAAAAgBAAAAIAAABACAAAAQAgAAAEAAAAgBAAAAIAAABACAAAAQAgAAAEAAAAgBAAAAIAAABACAAAAQAgA'
  + 'AAEAAAAAQAgAAAEAAAAgBAAAAIAAABACAAAAQAgAAAEAAAAgBAAAAIAAABACAAAAQAgAAAEAAAAgBAAAAIAAABACAAAAQAgAAAEAAA'
  + 'AgBAAAAIAAABACAAAAAIAAABACAAAAQAgAAAEAAAAgBAAAAIAAABACAAAAQAgAAAEAAAAgBAAAAIAAABACAAAAQAgAAAEAAAAgBAAA'
  + 'AIAAABACAAAAQAgAAAEAAAAgAAgAUAAAgAAAEAIAAABACAAAAQAAACAEAAAAgAAAEAIAAABACAAAAQAAACAEAAAAgAAAEAIAAABACA'
  + 'AAAQAAACAEAAAAgAAAEAIAAABACAAAAQAAACAACAAAAQAAACAEAAAAgAAAEAIAAABACAAAAQAAACAEAAAAgAAAEAIAAABACAAAAQAA'
  + 'ACAEAAAAgAAAEAIAAABACAAAAQAAACAEAAAAgAAAH40gITnQP//D/xpAAAAABJRU5ErkJggg==';
const PNG = Uint8Array.from(atob(PNG_BASE64), c => c.charCodeAt(0));

function capabilities(maskTime, topTime) {
  const layer = (name, stamp) => stamp ? `
    <Layer queryable="1"><Name>${name}</Name><Title>Cloud product</Title>
    <Dimension name="time" default="${stamp}" units="ISO8601">2020-09-01T00:00:00Z/${stamp}/PT15M</Dimension></Layer>
  ` : '';
  return `<WMS_Capabilities><Capability><Layer><Name>msg_fes</Name>
    ${layer('clm', maskTime)}${layer('cth', topTime)}</Layer></Capability></WMS_Capabilities>`;
}

function mockProvider(t, { maskTime = MASK_TIME, topTime = TOP_TIME, map = () => pngResponse(), cache } = {}) {
  const calls = [];
  const originalCaches = globalThis.caches;
  globalThis.caches = cache ? { default: cache } : undefined;
  t.after(() => { globalThis.caches = originalCaches; });
  t.mock.method(Date, 'now', () => NOW);
  t.mock.method(globalThis, 'fetch', async (input, options) => {
    assert.equal(options.redirect, 'manual');
    const url = new URL(input);
    calls.push(url);
    if (url.searchParams.get('request') === 'GetCapabilities') {
      return new Response(capabilities(maskTime, topTime), { headers: { 'Content-Type': 'text/xml' } });
    }
    return map(url.searchParams.get('layers'), options);
  });
  return calls;
}

function pngResponse(body = PNG, contentType = 'image/png') {
  return new Response(body, { headers: { 'Content-Type': contentType } });
}

test('satellite uses the latest common observation and a fixed Germany crop', async t => {
  const calls = mockProvider(t);
  const response = await onRequest({ request: new Request(ROUTE) });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(result, {
    source: 'eumetsat-msg', observedAt: '2026-11-20T19:15:00.000Z',
    bbox: [5, 47, 16, 55.8], width: 384, height: 384,
    maskPng: PNG_BASE64, cloudTopPng: PNG_BASE64,
  });
  assert.equal(response.headers.get('cache-control'), 'public, max-age=600');
  assert.deepEqual(calls.map(url => url.searchParams.get('request')), ['GetCapabilities', 'GetMap', 'GetMap']);
  assert.ok(calls.every(url =>
    url.origin === 'https://view.eumetsat.int' && url.pathname === '/geoserver/msg_fes/wms'
  ));
  for (const url of calls.slice(1)) {
    assert.equal(url.searchParams.get('time'), result.observedAt);
    assert.equal(url.searchParams.get('bbox'), result.bbox.join(','));
    assert.equal(url.searchParams.get('crs'), 'CRS:84');
  }
});

test('uses the provider-reported time to reject a substituted mask or mismatched height frame', async t => {
  for (const failingLayer of ['clm', 'cth']) {
    await t.test(failingLayer, async st => {
      mockProvider(st, {
        map: layer => {
          const response = pngResponse();
          const actual = layer === 'msg_fes:' + failingLayer ? '2026-11-20T19:00:00.000Z' : TOP_TIME;
          response.headers.set('Warning', '99 Nearest value used: time=' + actual + ' ISO8601 (' + layer + ')');
          return response;
        },
      });
      const response = await onRequest({ request: new Request(ROUTE) });
      assert.equal(response.status, failingLayer === 'clm' ? 503 : 200);
      const data = await response.json();
      if (failingLayer === 'cth') {
        assert.equal(data.observedAt, '2026-11-20T19:15:00.000Z');
        assert.equal(data.maskPng, PNG_BASE64);
        assert.equal(data.cloudTopPng, null);
      } else {
        assert.equal(data.error, 'satellite_unavailable');
      }
    });
  }
});

test('a missing height frame keeps the fresh satellite mask', async t => {
  const calls = mockProvider(t, { topTime: '2026-11-20T17:00:00Z' });
  const response = await onRequest({ request: new Request(ROUTE) });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.observedAt, '2026-11-20T19:30:00.000Z');
  assert.equal(result.cloudTopPng, null);
  assert.equal(result.maskPng, PNG_BASE64);
  assert.equal(calls.length, 2);
});

test('redirects, wrong MIME, wrong extent or excess bytes reject an invalid mask', async t => {
  const wrongWidth = PNG.slice();
  wrongWidth[19] = 64;
  let body = null;
  const calls = mockProvider(t, { map: layer => layer === 'msg_fes:clm' ? body() : pngResponse() });
  for (const entry of [
    () => new Response(null, { status: 302, headers: { Location: 'https://example.test/' } }),
    () => pngResponse(PNG, 'text/html'),
    () => pngResponse(wrongWidth),
    () => pngResponse(new Uint8Array(200 * 1024)),
  ]) {
    body = entry;
    const response = await onRequest({ request: new Request(ROUTE) });
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  assert.equal(calls.length, 12);
});

test('stale or future mask times cannot reach the image endpoint', async t => {
  await t.test('stale', async st => {
    const calls = mockProvider(st, { maskTime: '2026-11-20T18:30:00Z' });
    assert.equal((await onRequest({ request: new Request(ROUTE) })).status, 503);
    assert.equal(calls.length, 1);
  });
  await t.test('future', async st => {
    const calls = mockProvider(st, { maskTime: '2026-11-20T19:55:00Z' });
    assert.equal((await onRequest({ request: new Request(ROUTE) })).status, 503);
    assert.equal(calls.length, 1);
  });
});

test('cache serves a fresh response even if the optional height layer failed', async t => {
  let entry;
  const calls = mockProvider(t, {
    map: layer => layer === 'msg_fes:cth' ? new Response('', { status: 502 }) : pngResponse(),
    cache: {
      async match() { return entry?.clone(); },
      async put(key, response) {
        assert.equal(key.url, `${ROUTE}?cache=v3`);
        entry = response;
      },
    },
  });
  const response = await onRequest({ request: new Request(ROUTE) });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).cloudTopPng, null);
  assert.equal(response.headers.get('cache-control'), 'public, max-age=120');
  assert.equal((await onRequest({ request: new Request(ROUTE) })).status, 200);
  assert.equal(calls.length, 3);
});

test('user coordinates and methods other than GET cannot reach a provider', async t => {
  const calls = mockProvider(t);
  assert.equal((await onRequest({ request: new Request(`${ROUTE}?lat=12`) })).status, 400);
  const response = await onRequest({ request: new Request(ROUTE, { method: 'POST' }) });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET');
  assert.equal(calls.length, 0);
});
