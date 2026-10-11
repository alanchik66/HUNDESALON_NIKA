import assert from 'node:assert/strict';
import { createCipheriv, randomBytes, randomUUID, scryptSync } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { decryptBackupStream, protectBackupStream } from './protected-backup.mjs';
import { createPortableKeyring, generateRecoveryCode, openPortableKeyring } from './portable-backup-keyring.mjs';

const LIBRARY = path.resolve(import.meta.dirname, 'portable-backup-keyring.mjs');
const VERIFIER = path.resolve(import.meta.dirname, '../verify-protected-backup.mjs');

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'nika-portable-keyring-test-'));
  const recoverySecret = generateRecoveryCode();
  const keys = new Map([
    [randomUUID(), randomBytes(32)],
    [randomUUID(), randomBytes(32)],
  ]);
  const provided = [];
  t.after(async () => {
    recoverySecret.fill(0);
    for (const key of keys.values()) key.fill(0);
    assert.ok(path.basename(directory).startsWith('nika-portable-keyring-test-'));
    await fs.rm(directory, { recursive: true, force: true });
  });
  const keyProvider = async id => {
    const key = Buffer.from(keys.get(id));
    provided.push(key);
    return { keyId: id, key };
  };
  return { directory, recoverySecret, keys, provided, keyProvider, file: path.join(directory, 'recovery.nikakeys') };
}

async function create(context, options = {}) {
  return createPortableKeyring({
    keyIds: [...context.keys.keys()],
    keyProvider: context.keyProvider,
    recoverySecret: context.recoverySecret,
    outputPath: context.file,
    ...options,
  });
}

async function open(context, options = {}) {
  return openPortableKeyring({ file: context.file, recoverySecret: context.recoverySecret, ...options });
}

function changedHeader(bytes, edit) {
  const size = bytes.readUInt32BE(8);
  const header = JSON.parse(bytes.subarray(12, 12 + size).toString());
  edit(header);
  const replacement = Buffer.from(JSON.stringify(header));
  const prefix = Buffer.from(bytes.subarray(0, 12));
  prefix.writeUInt32BE(replacement.length, 8);
  return Buffer.concat([prefix, replacement, bytes.subarray(12 + size)]);
}

test('portable keyring authenticates multiple keys without exposing key bytes or erasing the caller code', async t => {
  const context = await fixture(t);
  const callerCode = Buffer.from(context.recoverySecret);
  const result = await create(context);
  assert.equal(result.version, 1);
  assert.equal(result.format, 'nika-portable-keyring');
  assert.deepEqual(result.keyIds, [...context.keys.keys()]);
  const bytes = await fs.readFile(result.file);
  assert.equal(bytes.includes(callerCode), false);
  for (const key of context.keys.values()) assert.equal(bytes.includes(key), false);
  assert.ok(context.provided.every(key => key.every(byte => byte === 0)));
  assert.deepEqual(context.recoverySecret, callerCode);
  const portable = await open(context);
  t.after(() => portable.dispose());
  for (const [id, expected] of context.keys) {
    const supplied = await portable.keyProvider(id);
    assert.equal(supplied.keyId, id);
    assert.deepEqual(supplied.key, expected);
    supplied.key.fill(0);
  }
  assert.deepEqual(context.recoverySecret, callerCode);
  callerCode.fill(0);
});

test('provider returns fresh buffers and rejects unknown IDs, automatic creation, and access after disposal', async t => {
  const context = await fixture(t);
  await create(context);
  const portable = await open(context);
  const id = portable.keyIds[0];
  const first = await portable.keyProvider(id);
  first.key.fill(0);
  const second = await portable.keyProvider(id);
  assert.notEqual(first.key, second.key);
  assert.deepEqual(second.key, context.keys.get(id));
  second.key.fill(0);
  await assert.rejects(portable.keyProvider(randomUUID()), /absent/);
  await assert.rejects(portable.keyProvider(), /identifier/);
  await assert.rejects(portable.keyProvider('../unsafe'), /identifier/);
  portable.dispose();
  portable.dispose();
  await assert.rejects(portable.keyProvider(id), /disposed/);
  assert.ok(Object.isFrozen(portable.keyIds));
});

test('wrong recovery code and changed authenticated header, ciphertext, or tag cannot return a provider', async t => {
  const context = await fixture(t);
  await create(context);
  const wrong = generateRecoveryCode();
  try {
    await assert.rejects(open(context, { recoverySecret: wrong }), /authentication/);
  } finally {
    wrong.fill(0);
  }
  const original = await fs.readFile(context.file);
  const headerSize = original.readUInt32BE(8);
  for (const kind of ['header', 'ciphertext', 'tag']) {
    const bytes =
      kind === 'header'
        ? changedHeader(original, header => {
            header.iv = (header.iv[0] === '0' ? '1' : '0') + header.iv.slice(1);
          })
        : Buffer.from(original);
    if (kind === 'ciphertext') bytes[12 + headerSize + 36] ^= 1;
    if (kind === 'tag') bytes[bytes.length - 1] ^= 1;
    const file = path.join(context.directory, kind + '.nikakeys');
    await fs.writeFile(file, bytes);
    await assert.rejects(open(context, { file }), /authentication/);
  }
});

test('untrusted KDF costs, algorithms, header fields and record counts reject without permitting arbitrary costs', async t => {
  const context = await fixture(t);
  await create(context);
  const original = await fs.readFile(context.file);
  const edits = [
    header => (header.kdf.N = 1073741824),
    header => (header.kdf.N = 16384),
    header => (header.kdf.r = 1024),
    header => (header.kdf.p = 1000000),
    header => (header.kdf.maxmem = Number.MAX_SAFE_INTEGER),
    header => (header.kdf.algorithm = 'unknown'),
    header => (header.cipher = 'aes-256-cbc'),
    header => (header.keyCount = 129),
    header => (header.keyCount = 0),
    header => (header.keyCount = 1.5),
    header => (header.version = 2),
    header => (header.kdf.salt = '00'),
    header => (header.iv = '00'),
    header => (header.unexpected = true),
  ];
  for (let index = 0; index < edits.length; index += 1) {
    const file = path.join(context.directory, 'invalid-header-' + index + '.nikakeys');
    await fs.writeFile(file, changedHeader(original, edits[index]));
    await assert.rejects(open(context, { file }), /validation/);
  }
});

test('truncation, appended bytes, oversized files and oversized headers are rejected', async t => {
  const context = await fixture(t);
  await create(context);
  const original = await fs.readFile(context.file);
  for (const size of [0, 4, 8, 12, 20, original.length - 16, original.length - 1]) {
    const file = path.join(context.directory, 'truncated-' + size + '.nikakeys');
    await fs.writeFile(file, original.subarray(0, size));
    await assert.rejects(open(context, { file }));
  }
  const appended = path.join(context.directory, 'appended.nikakeys');
  await fs.writeFile(appended, Buffer.concat([original, Buffer.from([0])]));
  await assert.rejects(open(context, { file: appended }));
  const oversized = path.join(context.directory, 'oversized.nikakeys');
  await fs.writeFile(oversized, original);
  await fs.truncate(oversized, 1024 * 1024 + 1);
  await assert.rejects(open(context, { file: oversized }));
  const header = Buffer.from(original);
  header.writeUInt32BE(4097, 8);
  const headerFile = path.join(context.directory, 'oversized-header.nikakeys');
  await fs.writeFile(headerFile, header);
  await assert.rejects(open(context, { file: headerFile }));
});

test('duplicate selections, invalid codes and invalid provider results reject and wipe returned key buffers', async t => {
  const context = await fixture(t);
  const id = [...context.keys.keys()][0];
  let calls = 0;
  const keyProvider = async () => {
    calls += 1;
    return { keyId: id, key: Buffer.alloc(31, 123) };
  };
  for (const keyIds of [[], [id, id.toUpperCase()], ['bad'], Array(129).fill(id)]) {
    await assert.rejects(create(context, { keyIds, keyProvider }));
  }
  assert.equal(calls, 0);
  for (const recoverySecret of ['ordinary-password', Buffer.alloc(31), Buffer.alloc(33), null]) {
    await assert.rejects(create(context, { recoverySecret }));
    await assert.rejects(open(context, { recoverySecret }));
  }
  const invalid = Buffer.alloc(31, 123);
  await assert.rejects(create(context, { keyProvider: async () => ({ keyId: id, key: invalid }) }));
  assert.ok(invalid.every(byte => byte === 0));
  assert.deepEqual(await fs.readdir(context.directory), []);
});

test('provider failures erase earlier keys, retain existing outputs and publish no partial keyring', async t => {
  const context = await fixture(t);
  let count = 0;
  await assert.rejects(
    create(context, {
      keyProvider: async id => {
        if (++count > 1) throw new Error('provider-private-fixture');
        return context.keyProvider(id);
      },
    }),
    error => error.message === 'Portable recovery keyring creation failed.'
  );
  assert.ok(context.provided.every(key => key.every(byte => byte === 0)));
  assert.deepEqual(await fs.readdir(context.directory), []);
  await fs.writeFile(context.file, 'preserved');
  count = 0;
  await assert.rejects(create(context, { keyProvider: async () => (count += 1) }));
  assert.equal(count, 0);
  assert.equal(await fs.readFile(context.file, 'utf8'), 'preserved');
  assert.deepEqual(await fs.readdir(context.directory), ['recovery.nikakeys']);
});

test('temporary cleanup failure after publication preserves and reports a valid keyring', async t => {
  const context = await fixture(t);
  const original = fs.unlink.bind(fs);
  let cleanupFailures = 0;
  const mocked = t.mock.method(fs, 'unlink', async file => {
    if (file.startsWith(context.file + '.') && file.endsWith('.partial')) {
      cleanupFailures += 1;
      const error = new Error('fixture temporary file locked');
      error.code = 'EPERM';
      throw error;
    }
    return original(file);
  });
  let result;
  try {
    result = await create(context);
  } finally {
    mocked.mock.restore();
  }
  assert.equal(result.file, context.file);
  assert.equal(cleanupFailures, 1);
  const portable = await open(context);
  try {
    const id = portable.keyIds[0];
    const supplied = await portable.keyProvider(id);
    assert.deepEqual(supplied.key, context.keys.get(id));
    supplied.key.fill(0);
  } finally {
    portable.dispose();
  }
  const temporary = (await fs.readdir(context.directory)).filter(file => file.endsWith('.partial'));
  assert.equal(temporary.length, 1);
  assert.deepEqual(await fs.readFile(path.join(context.directory, temporary[0])), await fs.readFile(context.file));
});

test('a symlink into the repository cannot receive recovery output and symlink keyring inputs reject', async t => {
  const context = await fixture(t);
  const repository = await fs.realpath(path.resolve(import.meta.dirname, '../..'));
  await assert.rejects(create(context, { outputPath: path.join(repository, 'recovery-fixture.nikakeys') }));
  const link = path.join(context.directory, 'repo-link');
  await fs.symlink(repository, link, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(create(context, { outputPath: path.join(link, 'recovery-fixture.nikakeys') }));
  const missingDirectory = 'nika-forbidden-keyring-' + randomUUID();
  await assert.rejects(create(context, { outputPath: path.join(link, missingDirectory, 'recovery-fixture.nikakeys') }));
  await assert.rejects(fs.stat(path.join(repository, missingDirectory)), { code: 'ENOENT' });
  await create(context);
  const linkedFile = path.join(link, 'tools', 'lib', 'portable-backup-keyring.mjs');
  // A directory symlink escaping into the repository is never an output target.
  assert.ok((await fs.stat(linkedFile)).isFile());
  const fileLink = path.join(context.directory, 'keyring-link.nikakeys');
  try {
    await fs.symlink(context.file, fileLink, 'file');
  } catch (error) {
    if (process.platform === 'win32' && error.code === 'EPERM') return;
    throw error;
  }
  await assert.rejects(open(context, { file: fileLink }));
});

test('authenticated payloads with duplicate, noncanonical or invalid key IDs are rejected', async t => {
  const context = await fixture(t);
  await create(context);
  const original = await fs.readFile(context.file);
  const headerSize = original.readUInt32BE(8);
  const aad = original.subarray(0, 12 + headerSize);
  const header = JSON.parse(original.subarray(12, 12 + headerSize).toString());
  const wrapping = scryptSync(context.recoverySecret, Buffer.from(header.kdf.salt, 'hex'), 32, {
    N: 131072,
    r: 8,
    p: 1,
    maxmem: 256 * 1024 * 1024,
  });
  const ids = [...context.keys.keys()];
  try {
    for (const kind of ['duplicate', 'noncanonical', 'invalid']) {
      const payload = Buffer.alloc(2 * 68);
      payload.write(ids[0], 0, 36, 'ascii');
      context.keys.get(ids[0]).copy(payload, 36);
      payload.write(
        kind === 'duplicate' ? ids[0] : kind === 'noncanonical' ? ids[1].toUpperCase() : 'x'.repeat(36),
        68,
        36,
        'ascii'
      );
      context.keys.get(ids[1]).copy(payload, 68 + 36);
      const cipher = createCipheriv('aes-256-gcm', wrapping, Buffer.from(header.iv, 'hex'), { authTagLength: 16 });
      cipher.setAAD(aad);
      const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
      payload.fill(0);
      const file = path.join(context.directory, 'invalid-record-' + kind + '.nikakeys');
      await fs.writeFile(file, Buffer.concat([aad, ciphertext, cipher.getAuthTag()]));
      await assert.rejects(open(context, { file }));
    }
  } finally {
    wrapping.fill(0);
  }
});

test('existing backup decrypts with the portable provider and the provider survives helper key wiping', async t => {
  const context = await fixture(t);
  const id = [...context.keys.keys()][0];
  const archive = path.join(context.directory, 'fixture.nikabk');
  const expected = Buffer.from('private fixture bytes');
  await protectBackupStream({
    source: Readable.from([expected]),
    outputPath: archive,
    type: 'd1-sql',
    keyProvider: async () => context.keyProvider(id),
  });
  await create(context);
  const portable = await open(context);
  try {
    for (let count = 0; count < 2; count += 1) {
      const chunks = [];
      await decryptBackupStream({
        file: archive,
        keyProvider: portable.keyProvider,
        sink: new Writable({
          write(chunk, encoding, callback) {
            chunks.push(Buffer.from(chunk));
            callback();
          },
        }),
      });
      const decoded = Buffer.concat(chunks);
      assert.deepEqual(decoded, expected);
      decoded.fill(0);
      for (const chunk of chunks) chunk.fill(0);
    }
  } finally {
    portable.dispose();
  }
});

test('a fresh process with DPAPI unavailable restores an existing D1 archive using only code and keyring', async t => {
  const context = await fixture(t);
  const id = [...context.keys.keys()][0];
  const archive = path.join(context.directory, 'fixture-d1.nikabk');
  await protectBackupStream({
    source: Readable.from(['CREATE TABLE fixture(id INTEGER PRIMARY KEY); INSERT INTO fixture VALUES(1);']),
    outputPath: archive,
    type: 'd1-sql',
    keyProvider: async () => context.keyProvider(id),
  });
  await create(context);
  const code = [
    "import { openPortableKeyring } from '" + pathToFileURL(LIBRARY).href + "';",
    "import { verifyD1Backup } from '" + pathToFileURL(VERIFIER).href + "';",
    "import { windowsBackupKey } from '" +
      pathToFileURL(path.resolve(import.meta.dirname, 'protected-backup.mjs')).href +
      "';",
    "import { readFileSync } from 'node:fs';",
    'const input=JSON.parse(readFileSync(0,"utf8"));',
    'let dpapiUnavailable=false;',
    'try { await windowsBackupKey(input.keyId); } catch { dpapiUnavailable=true; }',
    'if(!dpapiUnavailable) throw new Error("DPAPI must be unavailable in this test");',
    'const secret=Buffer.from(input.code,"base64");',
    'const portable=await openPortableKeyring({file:input.keyring,recoverySecret:secret});',
    'secret.fill(0);',
    'try { const result=await verifyD1Backup({file:input.archive,keyProvider:portable.keyProvider}); console.log(JSON.stringify({integrity:result.integrity,tableCounts:result.tableCounts,dpapiUnavailable})); } finally { portable.dispose(); }',
  ].join('\n');
  const stdout = execFileSync(process.execPath, ['--input-type=module', '--eval', code], {
    input: JSON.stringify({
      keyring: context.file,
      archive,
      code: context.recoverySecret.toString('base64'),
      keyId: id,
    }),
    encoding: 'utf8',
    env: { ...process.env, LOCALAPPDATA: '' },
    windowsHide: true,
    timeout: 30_000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  assert.deepEqual(JSON.parse(stdout), {
    integrity: 'ok',
    tableCounts: [{ table: 'fixture', rows: 1 }],
    dpapiUnavailable: true,
  });
});
