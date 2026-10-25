import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { backupD1 } from './backup-d1.mjs';
import { verifyD1Backup } from './verify-protected-backup.mjs';

const databaseId = '00000000-0000-4000-8000-000000000001';
const signedUrl = 'https://exports.example.invalid/fixture.sql?signature=fixture-capability';
const repository = path.resolve(import.meta.dirname, '..');

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'nika-d1-backup-test-'));
  const keyId = randomUUID();
  const key = randomBytes(32);
  t.after(async () => {
    key.fill(0);
    assert.ok(path.basename(directory).startsWith('nika-d1-backup-test-'));
    await fs.rm(directory, { recursive: true, force: true });
  });
  return {
    directory,
    outputPath: path.join(directory, 'fixture.sql.nikabk'),
    keyProvider: async () => ({ keyId, key: Buffer.from(key) }),
  };
}

const complete = () => ({ status: 'complete', result: { signed_url: signedUrl } });

test('D1 export polling carries bookmarks, keeps bearer URL out of metadata and encrypts before restore verification', async t => {
  const context = await fixture(t);
  const apiCalls = [];
  const delays = [];
  const sql =
    "CREATE TABLE fixture(id INTEGER PRIMARY KEY, value TEXT); INSERT INTO fixture VALUES(1,'private-fixture-value');";
  const result = await backupD1({
    ...context,
    databaseId,
    api: async (pathname, init) => {
      apiCalls.push({ pathname, init });
      return apiCalls.length === 1 ? { status: 'active', at_bookmark: 'fixture-bookmark' } : complete();
    },
    pause: async ms => delays.push(ms),
    fetchFile: async (url, init) => {
      assert.equal(url.href, signedUrl);
      assert.equal(init.headers, undefined);
      assert.equal(init.redirect, 'error');
      assert.ok(init.signal instanceof AbortSignal);
      return new Response(sql);
    },
  });
  assert.equal(apiCalls.length, 2);
  assert.equal(apiCalls[0].pathname, '/d1/database/' + databaseId + '/export');
  assert.equal(apiCalls[0].init.method, 'POST');
  assert.ok(apiCalls[0].init.signal instanceof AbortSignal);
  assert.deepEqual(JSON.parse(apiCalls[0].init.body), { output_format: 'polling' });
  assert.deepEqual(JSON.parse(apiCalls[1].init.body), {
    output_format: 'polling',
    current_bookmark: 'fixture-bookmark',
  });
  assert.deepEqual(delays, [2000]);
  assert.equal(result.integrityVerified, true);
  assert.equal(JSON.stringify(result).includes('signature='), false);
  assert.equal((await fs.readFile(context.outputPath)).includes(Buffer.from('private-fixture-value')), false);
  assert.deepEqual(await fs.readdir(context.directory), ['fixture.sql.nikabk']);
  const restored = await verifyD1Backup({ file: context.outputPath, keyProvider: context.keyProvider });
  assert.deepEqual(restored.tableCounts, [{ table: 'fixture', rows: 1 }]);
});

test('D1 rejects failed and malformed polling responses without downloading or writing', async t => {
  const context = await fixture(t);
  for (const response of [{ status: 'error' }, { status: 'active' }, null]) {
    await assert.rejects(
      backupD1({
        ...context,
        databaseId,
        api: async () => response,
        fetchFile: async () => {
          throw new Error('Download must not happen.');
        },
        pause: async () => {},
      })
    );
  }
  assert.deepEqual(await fs.readdir(context.directory), []);
});

test('D1 export incomplete polling is bounded to 30 requests', async t => {
  const context = await fixture(t);
  let calls = 0;
  await assert.rejects(
    backupD1({
      ...context,
      databaseId,
      api: async () => {
        calls += 1;
        return { status: 'active', at_bookmark: 'pending' };
      },
      pause: async () => {},
    })
  );
  assert.equal(calls, 30);
  assert.deepEqual(await fs.readdir(context.directory), []);
});

test('D1 rejects insecure, credentialed and missing signed URLs', async t => {
  const context = await fixture(t);
  for (const url of [
    'http://exports.example.invalid/private.sql',
    'https://user:password@exports.example.invalid/private.sql',
    'data:text/plain,secret',
    undefined,
  ]) {
    let downloads = 0;
    await assert.rejects(
      backupD1({
        ...context,
        databaseId,
        api: async () => ({ status: 'complete', result: { signed_url: url } }),
        fetchFile: async () => {
          downloads += 1;
          return new Response('fixture');
        },
      })
    );
    assert.equal(downloads, 0);
  }
  assert.deepEqual(await fs.readdir(context.directory), []);
});

test('D1 rejects output in Git and invalid source identities before contacting API', async t => {
  const context = await fixture(t);
  let apiCalls = 0;
  const api = async () => {
    apiCalls += 1;
    return complete();
  };
  for (const options of [
    { databaseId: 'invalid' },
    { databaseId, outputPath: path.join(repository, 'must-not-create.nikabk') },
    { databaseId, outputPath: 'relative.nikabk' },
  ]) {
    await assert.rejects(backupD1({ ...context, api, ...options }));
  }
  assert.equal(apiCalls, 0);
  assert.deepEqual(await fs.readdir(context.directory), []);
});

test('D1 rejects an output parent symlink resolving into the repository', async t => {
  const context = await fixture(t);
  const linked = path.join(context.directory, 'repository-link');
  await fs.symlink(repository, linked, process.platform === 'win32' ? 'junction' : 'dir');
  let apiCalls = 0;
  try {
    await assert.rejects(
      backupD1({
        ...context,
        databaseId,
        outputPath: path.join(linked, 'must-not-create.nikabk'),
        api: async () => {
          apiCalls += 1;
          return { status: 'error' };
        },
      })
    );
    assert.equal(apiCalls, 0);
  } finally {
    await fs.unlink(linked);
  }
});

test('D1 download HTTP errors, missing bodies and timeouts never create an output', async t => {
  const context = await fixture(t);
  for (const fetchFile of [
    async () => new Response('failure', { status: 503 }),
    async () => new Response(null),
    async () => {
      throw new globalThis.DOMException('Timed out', 'TimeoutError');
    },
  ]) {
    await assert.rejects(backupD1({ ...context, databaseId, api: async () => complete(), fetchFile }));
  }
  assert.deepEqual(await fs.readdir(context.directory), []);
});

test('D1 source streaming interruption discards incomplete encrypted output', async t => {
  const context = await fixture(t);
  const body = new globalThis.ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('partial fixture export'));
      controller.error(new Error('interrupted download'));
    },
  });
  await assert.rejects(
    backupD1({ ...context, databaseId, api: async () => complete(), fetchFile: async () => new Response(body) })
  );
  assert.deepEqual(await fs.readdir(context.directory), []);
});
