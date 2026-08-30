import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { onRequest } from './_middleware.js';

function parseWildcardSecurityHeaders(source) {
  const lines = String(source).split(/\r?\n/);
  const blockStart = lines.findIndex(line => line.trim() === '/*');
  assert.notEqual(blockStart, -1, 'Expected a wildcard security-header block in _headers');

  const headers = new Map();
  for (const line of lines.slice(blockStart + 1)) {
    if (line.trim() && !/^\s/.test(line)) break;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf(':');
    if (separator > 0) {
      headers.set(trimmed.slice(0, separator), trimmed.slice(separator + 1).trim());
    }
  }
  return headers;
}

test('adds security headers to Function responses without changing API or CORS headers', async () => {
  const response = await onRequest({
    request: new Request('https://hundesalon-nika.com/message-draft', { method: 'POST' }),
    next: async () =>
      new Response(JSON.stringify({ success: true }), {
        status: 202,
        headers: {
          'Access-Control-Allow-Origin': 'https://hundesalon-nika.com',
          'Cache-Control': 'no-store',
          'Content-Type': 'application/json; charset=utf-8',
          Vary: 'Origin',
        },
      }),
  });

  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { success: true });
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://hundesalon-nika.com');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('Content-Type'), 'application/json; charset=utf-8');
  assert.equal(response.headers.get('Vary'), 'Origin');

  const staticHeaders = parseWildcardSecurityHeaders(
    await readFile(new URL('../_headers', import.meta.url), 'utf8')
  );
  assert.equal(staticHeaders.size, 10);
  for (const [name, value] of staticHeaders) {
    assert.equal(response.headers.get(name), value, `${name} must match _headers`);
  }
});
