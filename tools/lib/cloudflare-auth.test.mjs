import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { getWranglerConfigPath, loadWranglerOAuth, refreshWranglerOAuth } from './cloudflare-auth.mjs';

function useWranglerFixture(t, expirationTime = Date.now() - 60_000) {
  const directory = mkdtempSync(path.join(tmpdir(), 'nika-cloudflare-auth-test-'));
  const configPath = path.join(directory, 'default.toml');
  const previousConfig = process.env.WRANGLER_CONFIG;

  t.after(() => {
    if (previousConfig === undefined) delete process.env.WRANGLER_CONFIG;
    else process.env.WRANGLER_CONFIG = previousConfig;
    if (existsSync(configPath)) unlinkSync(configPath);
    rmdirSync(directory);
  });

  const original = [
    '# Isolated test fixture; never use real credentials.',
    'oauth_token = "fixture-access-token"',
    'refresh_token = "fixture-refresh-token"',
    `expiration_time = "${new Date(expirationTime).toISOString()}"`,
    'scopes = ["account:read"]',
    '',
  ].join('\n');
  writeFileSync(configPath, original, 'utf8');
  process.env.WRANGLER_CONFIG = configPath;
  assert.equal(getWranglerConfigPath(), configPath);

  return { configPath, original };
}

test('refreshes expired Wrangler OAuth with the production client ID and persists only the fixture', async t => {
  const { configPath } = useWranglerFixture(t);
  const beforeRefresh = Date.now();
  const fetchMock = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://dash.cloudflare.com/oauth2/token');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['Content-Type'], 'application/x-www-form-urlencoded');
    assert.equal(options.body.get('client_id'), '54d11594-84e4-41aa-b438-e81b8fa78ee7');
    assert.equal(options.body.get('grant_type'), 'refresh_token');
    assert.equal(options.body.get('refresh_token'), 'fixture-refresh-token');
    return Response.json({
      access_token: 'fixture-new-access-token',
      refresh_token: 'fixture-new-refresh-token',
      expires_in: 7200,
    });
  });

  const accessToken = await refreshWranglerOAuth(loadWranglerOAuth());
  const stored = loadWranglerOAuth();

  assert.equal(fetchMock.mock.callCount(), 1);
  assert.equal(accessToken, 'fixture-new-access-token');
  assert.equal(stored.configPath, configPath);
  assert.equal(stored.access_token, 'fixture-new-access-token');
  assert.equal(stored.refresh_token, 'fixture-new-refresh-token');
  assert.ok(stored.expiration_time >= beforeRefresh + 7200_000);
  assert.ok(stored.expiration_time <= Date.now() + 7200_000);
  assert.match(readFileSync(configPath, 'utf8'), /scopes = \["account:read"\]/);
});

test('reuses a valid Wrangler OAuth token without a request or config write', async t => {
  const { configPath, original } = useWranglerFixture(t, Date.now() + 3600_000);
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('No network request is permitted in this test.');
  });

  const accessToken = await refreshWranglerOAuth(loadWranglerOAuth());

  assert.equal(accessToken, 'fixture-access-token');
  assert.equal(fetchMock.mock.callCount(), 0);
  assert.equal(readFileSync(configPath, 'utf8'), original);
});

test('does not overwrite the Wrangler fixture when OAuth refresh fails', async t => {
  const { configPath, original } = useWranglerFixture(t);
  const fetchMock = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ error: 'invalid_client' }, { status: 401 })
  );

  await assert.rejects(refreshWranglerOAuth(loadWranglerOAuth()), /Failed to refresh Wrangler OAuth token/);

  assert.equal(fetchMock.mock.callCount(), 1);
  assert.equal(readFileSync(configPath, 'utf8'), original);
});
