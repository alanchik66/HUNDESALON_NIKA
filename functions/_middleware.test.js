import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { onRequest } from './_middleware.js';

test('permits external embedding only for the public email image allowlist', async () => {
  for (const [path, type, expected] of [
    ['/assets/images/email/logo.png', 'image/png', 'cross-origin'],
    ['/assets/images/email/whatsapp.png', 'image/png', 'cross-origin'],
    ['/assets/images/brand/logo.png', 'image/png', 'same-origin'],
    ['/assets/images/email/private.png', 'image/png', 'same-origin'],
    ['/assets/images/email/logo.png', 'text/html', 'same-origin'],
  ]) {
    const response = await onRequest({
      request: new Request(`https://hundesalon-nika.com${path}`),
      next: async () => new Response('fixture', { headers: { 'Content-Type': type } }),
    });
    assert.equal(response.headers.get('Cross-Origin-Resource-Policy'), expected, `${path}: ${type}`);
  }
});

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

  const staticHeaders = parseWildcardSecurityHeaders(await readFile(new URL('../_headers', import.meta.url), 'utf8'));
  assert.equal(staticHeaders.size, 10);
  for (const [name, value] of staticHeaders) {
    assert.equal(response.headers.get(name), value, `${name} must match _headers`);
  }
});

test('static and Function HTML CSP allow Turnstile resources without broadening script execution', async () => {
  const staticHeaders = parseWildcardSecurityHeaders(await readFile(new URL('../_headers', import.meta.url), 'utf8'));
  const response = await onRequest({
    request: new Request('https://hundesalon-nika.com/de/onlayn-bronirovanie'),
    next: async () =>
      new Response('<!doctype html><title>Booking</title>', {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }),
  });
  const turnstileScript = new URL('https://challenges.cloudflare.com/turnstile/v0/api.js');
  const turnstileFrame = new URL('https://challenges.cloudflare.com/turnstile/v0/widget');
  for (const policy of [
    staticHeaders.get('Content-Security-Policy'),
    response.headers.get('Content-Security-Policy'),
  ]) {
    const directives = new Map(
      policy.split(';').map(value => {
        const [name, ...sources] = value.trim().split(/\s+/);
        return [name, sources];
      })
    );
    assert.ok(directives.get('script-src').includes(turnstileScript.origin));
    assert.ok(directives.get('frame-src').includes(turnstileFrame.origin));
    assert.ok(directives.get('connect-src').includes("'self'"), 'Pre-clearance can reach its same-origin endpoint');
    for (const source of ['*', "'unsafe-inline'", "'unsafe-eval'"]) {
      assert.equal(directives.get('script-src').includes(source), false);
    }
    assert.deepEqual(directives.get('object-src'), ["'none'"]);
    assert.deepEqual(directives.get('frame-ancestors'), ["'self'"]);
    assert.deepEqual(directives.get('form-action'), ["'self'"]);
  }
});
