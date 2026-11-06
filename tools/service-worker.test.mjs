import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

function fetchEvent({ cached, response, writeError, fetchError, destination = 'image', path = '/asset.png', cache = 'default', headers = {} } = {}) {
  const handlers = new Map();
  const pending = [];
  const writes = [];
  const calls = { match: 0, open: 0, fetch: 0, respondWith: 0 };
  let respondWith;
  const request = { method: 'GET', url: new URL(path, 'https://example.com').href, destination, mode: 'cors', cache, headers };
  vm.runInNewContext(source, {
    URL,
    self: { location: { origin: 'https://example.com' }, addEventListener: (type, fn) => handlers.set(type, fn) },
    caches: {
      match: async () => { calls.match += 1; return cached; },
      open: async () => {
        calls.open += 1;
        return {
          put: async (key, value) => {
            if (writeError) throw writeError;
            writes.push([key, value]);
          },
        };
      },
    },
    fetch: async () => {
      calls.fetch += 1;
      if (fetchError) throw fetchError;
      return response;
    },
  });
  handlers.get('fetch')({
    request,
    waitUntil: promise => pending.push(promise),
    respondWith: promise => {
      calls.respondWith += 1;
      respondWith = promise;
    },
  });
  return { request, pending, writes, calls, response: respondWith };
}

test('current and metadata weather requests use the browser network without service-worker interception or cache access', async t => {
  for (const [name, options] of [
    ['current conditions', { path: '/api/weather?location=51.23%2C6.78&forecast_contract=four-day-v2' }],
    ['forced current refresh', { path: '/api/weather?location=51.23%2C6.78', headers: { 'Cache-Control': 'no-cache' } }],
    ['metadata refresh', { path: '/api/weather?location=51.23%2C6.78&meta_only=1', cache: 'no-store' }],
    ['bare endpoint', { path: '/api/weather' }],
  ]) {
    await t.test(name, async () => {
      const event = fetchEvent({ ...options, destination: '', cached: { current: { temp_c: 1 }, stale: true },
        response: { ok: true, clone: () => ({ current: { temp_c: 7 } }) } });
      assert.equal(event.response, undefined, 'the browser must retain the default network path');
      assert.deepEqual(event.calls, { match: 0, open: 0, fetch: 0, respondWith: 0 });
      assert.equal(event.pending.length, 0, 'the worker must not start a background weather refresh');
      assert.equal(event.writes.length, 0, 'even an existing stale weather cache entry must remain unused');
    });
  }
});

test('cached assets keep the refresh and cache write alive', async () => {
  const cached = { cached: true };
  const updated = { ok: true, clone: () => ({ updated: true }) };
  const event = fetchEvent({ cached, response: updated });
  assert.equal(await event.response, cached);
  assert.ok(event.pending.length > 0);
  // Cache writes register their own lifetime promise when the network response resolves.
  for (let index = 0; index < event.pending.length; index++) await event.pending[index];
  assert.equal(event.writes.length, 1);
  assert.equal(event.writes[0][0], event.request);
});

test('cache quota rejection does not reject a successful navigation', async () => {
  const response = { ok: true, clone: () => ({ copy: true }) };
  const event = fetchEvent({ response, destination: 'document', writeError: new Error('QuotaExceededError') });
  assert.equal(await event.response, response);
  assert.equal(event.pending.length, 1);
  await Promise.all(event.pending);
});

test('offline asset refresh preserves the cached response and fulfills its lifetime promise', async () => {
  const cached = { cached: true };
  const event = fetchEvent({ cached, fetchError: new Error('offline') });
  assert.equal(await event.response, cached);
  await Promise.all(event.pending);
  assert.equal(event.writes.length, 0);
});
