import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  getWranglerConfigPath,
  loadWranglerOAuth,
  refreshWranglerOAuth,
  removeDevVar,
  upsertDevVar,
} from './cloudflare-auth.mjs';

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

function useDevVarsFixture(t, content) {
  const directory = mkdtempSync(path.join(tmpdir(), 'nika-dev-vars-test-'));
  const filePath = path.join(directory, '.dev.vars');
  const key = 'NIKA_AUTH_TEST_KEY';
  const previousValue = process.env[key];

  t.after(() => {
    if (previousValue === undefined) delete process.env[key];
    else process.env[key] = previousValue;
    if (existsSync(filePath)) unlinkSync(filePath);
    rmdirSync(directory);
  });

  writeFileSync(filePath, content, 'utf8');
  return { filePath, key };
}

test('upserts one dev variable without leaving spaced or duplicate assignments', t => {
  const { filePath, key } = useDevVarsFixture(
    t,
    '\uFEFF  NIKA_AUTH_TEST_KEY = stale\r\n' +
      '# NIKA_AUTH_TEST_KEY=comment\r\n' +
      'NIKA_AUTH_TEST_KEY_EXTRA=unchanged\r\n' +
      'NIKA_AUTH_TEST_KEY=duplicate\r\n' +
      'NIKA_AUTH_TEST_KEY\r\n'
  );

  upsertDevVar(key, 'replacement', filePath);

  assert.equal(
    readFileSync(filePath, 'utf8'),
    'NIKA_AUTH_TEST_KEY=replacement\n' +
      '# NIKA_AUTH_TEST_KEY=comment\n' +
      'NIKA_AUTH_TEST_KEY_EXTRA=unchanged\n' +
      'NIKA_AUTH_TEST_KEY\n'
  );
  assert.equal(process.env[key], 'replacement');
});

test('removes every matching dev variable while preserving comments and other keys', t => {
  const { filePath, key } = useDevVarsFixture(
    t,
    '\uFEFF  NIKA_AUTH_TEST_KEY = stale\r\n' +
      '# NIKA_AUTH_TEST_KEY=comment\r\n' +
      'NIKA_AUTH_TEST_KEY_EXTRA=unchanged\r\n' +
      '\tNIKA_AUTH_TEST_KEY\t=duplicate\r\n' +
      'NIKA_AUTH_TEST_KEY=current\r\n' +
      'NIKA_AUTH_TEST_KEY\r\n'
  );
  process.env[key] = 'current';

  removeDevVar(key, filePath);

  assert.equal(
    readFileSync(filePath, 'utf8'),
    '# NIKA_AUTH_TEST_KEY=comment\nNIKA_AUTH_TEST_KEY_EXTRA=unchanged\nNIKA_AUTH_TEST_KEY\n'
  );
  assert.equal(process.env[key], undefined);
});

test('removes a process-only dev variable even when its file is absent', t => {
  const { filePath, key } = useDevVarsFixture(t, '');
  unlinkSync(filePath);
  process.env[key] = 'stale';

  removeDevVar(key, filePath);

  assert.equal(process.env[key], undefined);
  assert.equal(existsSync(filePath), false);
});
