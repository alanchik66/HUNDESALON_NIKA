import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

function fetchEvent({ cached, response, writeError, fetchError, destination = 'image' } = {}) {
  const handlers = new Map();
  const pending = [];
  const writes = [];
  let respondWith;
  const request = { method: 'GET', url: 'https://example.com/asset.png', destination, mode: 'cors' };
  vm.runInNewContext(source, {
    URL,
    self: { location: { origin: 'https://example.com' }, addEventListener: (type, fn) => handlers.set(type, fn) },
    caches: {
      match: async () => cached,
      open: async () => ({
        put: async (key, value) => {
          if (writeError) throw writeError;
          writes.push([key, value]);
        },
      }),
    },
    fetch: async () => {
      if (fetchError) throw fetchError;
      return response;
    },
  });
  handlers.get('fetch')({
    request,
    waitUntil: promise => pending.push(promise),
    respondWith: promise => {
      respondWith = promise;
    },
  });
  return { request, pending, writes, response: respondWith };
}

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
