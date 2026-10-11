import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { test } from 'node:test';
import { protectBackupStream } from './lib/protected-backup.mjs';
import {
  decryptPortableRecovery,
  exportPortableRecovery,
  runPortableBackupCli,
  verifyPortableRecovery,
} from './portable-backup-recovery.mjs';

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'nika-portable-recovery-cli-test-'));
  const key = randomBytes(32);
  const keyId = randomUUID();
  t.after(async () => {
    key.fill(0);
    assert.ok(path.basename(directory).startsWith('nika-portable-recovery-cli-test-'));
    await fs.rm(directory, { recursive: true, force: true });
  });
  return {
    directory,
    keyId,
    keyringFile: path.join(directory, 'keyring', 'recovery.nikakeys'),
    codeFile: path.join(directory, 'separate-custody', 'recovery-code.txt'),
    keyProvider: async identifier => {
      if (identifier !== undefined && identifier !== keyId) throw new Error('Missing fixture key.');
      return { keyId, key: Buffer.from(key) };
    },
  };
}

async function exported(context) {
  return exportPortableRecovery({ ...context, keyIds: [context.keyId] });
}

async function archive(context, payload, type = 'git-bundle') {
  const archiveFile = path.join(context.directory, randomUUID() + '.nikabk');
  await protectBackupStream({
    source: Readable.from([payload]),
    outputPath: archiveFile,
    keyProvider: context.keyProvider,
    type,
  });
  return archiveFile;
}

test('export publishes separate private files and exposes no recovery code in metadata', async t => {
  const context = await fixture(t);
  const result = await exported(context);
  const code = await fs.readFile(context.codeFile, 'utf8');
  assert.match(code, /^NIKA-RECOVERY-1\n[a-f0-9]{64}\n$/);
  assert.equal(result.keyCount, 1);
  assert.equal(JSON.stringify(result).includes(code.split('\n')[1]), false);
  assert.equal((await fs.readFile(context.keyringFile)).includes(Buffer.from(code.split('\n')[1])), false);
  if (process.platform !== 'win32') {
    assert.equal((await fs.stat(context.codeFile)).mode & 0o777, 0o600);
    assert.equal((await fs.stat(context.keyringFile)).mode & 0o777, 0o600);
  }
});

test('export never replaces either existing output and calls no key provider', async t => {
  for (const kind of ['keyringFile', 'codeFile']) {
    const context = await fixture(t);
    await fs.mkdir(path.dirname(context[kind]), { recursive: true });
    await fs.writeFile(context[kind], 'existing fixture');
    let calls = 0;
    await assert.rejects(
      exportPortableRecovery({
        ...context,
        keyIds: [context.keyId],
        keyProvider: async () => {
          calls += 1;
        },
      })
    );
    assert.equal(await fs.readFile(context[kind], 'utf8'), 'existing fixture');
    assert.equal(calls, 0);
  }
});

test('keyring and code in the same directory are rejected before publication', async t => {
  const context = await fixture(t);
  const codeFile = path.join(path.dirname(context.keyringFile), 'code.txt');
  await assert.rejects(
    exportPortableRecovery({ ...context, codeFile, keyIds: [context.keyId] }),
    /separate directories/
  );
  await assert.rejects(fs.stat(context.keyringFile), { code: 'ENOENT' });
  await assert.rejects(fs.stat(codeFile), { code: 'ENOENT' });
});

test('both ordinary Git checkouts and worktrees reject recovery output', async t => {
  for (const worktree of [false, true]) {
    const context = await fixture(t);
    const repository = path.join(context.directory, 'fixture-repository');
    await fs.mkdir(repository);
    if (worktree) await fs.writeFile(path.join(repository, '.git'), 'gitdir: fixture');
    else await fs.mkdir(path.join(repository, '.git'));
    await assert.rejects(
      exportPortableRecovery({
        ...context,
        keyringFile: path.join(repository, 'nested', 'keys.nikakeys'),
        keyIds: [context.keyId],
      }),
      /outside Git/
    );
    await assert.rejects(
      exportPortableRecovery({ ...context, codeFile: path.join(repository, 'code.txt'), keyIds: [context.keyId] }),
      /outside Git/
    );
  }
});

test('symbolic files and linked parent directories are refused', async t => {
  const context = await fixture(t);
  const actual = path.join(context.directory, 'actual');
  const linked = path.join(context.directory, 'linked');
  await fs.mkdir(actual);
  await fs.symlink(actual, linked, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(
    exportPortableRecovery({ ...context, codeFile: path.join(linked, 'code.txt'), keyIds: [context.keyId] }),
    /symbolic links/
  );
  await assert.rejects(fs.stat(path.join(actual, 'code.txt')), { code: 'ENOENT' });
});

test('only explicit unique valid key identifiers are accepted', async t => {
  const context = await fixture(t);
  for (const keyIds of [[], undefined, [context.keyId, context.keyId], ['not-an-id']]) {
    await assert.rejects(exportPortableRecovery({ ...context, keyIds }), /unique backup key identifiers/);
  }
  await assert.rejects(
    exportPortableRecovery({ ...context, keyIds: [context.keyId], codeFile: '' }),
    /absolute recovery file path/
  );
});

test('unknown exported keys fail without creating a code or keyring', async t => {
  const context = await fixture(t);
  await assert.rejects(exportPortableRecovery({ ...context, keyIds: [randomUUID()] }), /export failed/);
  await assert.rejects(fs.stat(context.keyringFile), { code: 'ENOENT' });
  await assert.rejects(fs.stat(context.codeFile), { code: 'ENOENT' });
});

test('unknown archive keys fail instead of falling back to local key access', async t => {
  const context = await fixture(t);
  await exported(context);
  const archiveFile = await archive(context, Buffer.from('unrelated fixture'), 'git-bundle');
  const bytes = await fs.readFile(archiveFile);
  const replaced = Buffer.from(bytes.toString('latin1').replace(context.keyId, randomUUID()), 'latin1');
  await fs.writeFile(archiveFile, replaced);
  await assert.rejects(verifyPortableRecovery({ ...context, archiveFile }), /authentication or isolated restore/);
});

test('valid Git bundle bytes are authenticated but are not reported as a Git restoration', async t => {
  const context = await fixture(t);
  await exported(context);
  const archiveFile = await archive(context, Buffer.from('fake bundle fixture for authentication only'));
  const result = await verifyPortableRecovery({ ...context, archiveFile });
  assert.equal(result.type, 'git-bundle');
  assert.equal(result.integrityOnly, true);
  assert.equal(result.restored, false);
});

test('portable D1 verification restores the fixture only into in-memory SQLite', async t => {
  const context = await fixture(t);
  await exported(context);
  const archiveFile = await archive(
    context,
    Buffer.from("CREATE TABLE sample (id INTEGER PRIMARY KEY, value TEXT); INSERT INTO sample VALUES (1, 'fixture');"),
    'd1-sql'
  );
  const result = await verifyPortableRecovery({ ...context, archiveFile });
  assert.equal(result.integrity, 'ok');
  assert.equal(result.foreignKeyViolations, 0);
  assert.deepEqual(result.tableCounts, [{ table: 'sample', rows: 1 }]);
});

test('decrypt publishes exact bytes for all envelope types', async t => {
  const context = await fixture(t);
  await exported(context);
  for (const type of ['tar', 'd1-sql', 'git-bundle']) {
    const payload = Buffer.concat([Buffer.from('private fixture ' + type), randomBytes(256 * 1024)]);
    const archiveFile = await archive(context, payload, type);
    const outputFile = path.join(context.directory, 'restore', type + '.plain');
    const result = await decryptPortableRecovery({ ...context, archiveFile, outputFile });
    assert.equal(result.status, 'decrypted');
    assert.equal(result.restored, false);
    assert.deepEqual(await fs.readFile(outputFile), payload);
  }
});

test('wrong code fails before plaintext output and preserves the encrypted archive', async t => {
  const context = await fixture(t);
  await exported(context);
  const archiveFile = await archive(context, Buffer.from('private fixture'));
  const before = await fs.readFile(archiveFile);
  await fs.writeFile(context.codeFile, 'NIKA-RECOVERY-1\n' + randomBytes(32).toString('hex') + '\n');
  const outputFile = path.join(context.directory, 'failed-restore', 'never-created.plain');
  await assert.rejects(decryptPortableRecovery({ ...context, archiveFile, outputFile }), /decryption failed/);
  await assert.rejects(fs.stat(outputFile), { code: 'ENOENT' });
  await assert.rejects(fs.stat(path.dirname(outputFile)), { code: 'ENOENT' });
  assert.deepEqual(await fs.readFile(archiveFile), before);
});

test('malformed code files reject empty, non-UTF8 and appended data', async t => {
  const context = await fixture(t);
  await exported(context);
  const archiveFile = await archive(context, Buffer.from('fixture'));
  const original = await fs.readFile(context.codeFile);
  for (const changed of [
    Buffer.from(''),
    Buffer.concat([original, Buffer.from('extra')]),
    Buffer.concat([Buffer.from([0xff]), original]),
  ]) {
    await fs.writeFile(context.codeFile, changed);
    await assert.rejects(verifyPortableRecovery({ ...context, archiveFile }));
  }
});

test('existing plaintext output is preserved and no partial file remains', async t => {
  const context = await fixture(t);
  await exported(context);
  const archiveFile = await archive(context, Buffer.from('new fixture'));
  const outputFile = path.join(context.directory, 'existing.plain');
  await fs.writeFile(outputFile, 'existing fixture');
  await assert.rejects(decryptPortableRecovery({ ...context, archiveFile, outputFile }), /already exists/);
  assert.equal(await fs.readFile(outputFile, 'utf8'), 'existing fixture');
  assert.equal(
    (await fs.readdir(context.directory)).some(file => file.includes('.partial')),
    false
  );
});

test('a corrupted archive fails authentication before any plaintext directory is created', async t => {
  const context = await fixture(t);
  await exported(context);
  const archiveFile = await archive(context, Buffer.from('private fixture'));
  const bytes = await fs.readFile(archiveFile);
  bytes[bytes.length - 1] ^= 1;
  await fs.writeFile(archiveFile, bytes);
  const outputFile = path.join(context.directory, 'failed-authentication', 'never-created.plain');
  await assert.rejects(decryptPortableRecovery({ ...context, archiveFile, outputFile }), /decryption failed/);
  await assert.rejects(fs.stat(path.dirname(outputFile)), { code: 'ENOENT' });
});

test('decryption refuses Git outputs and linked output directories', async t => {
  const context = await fixture(t);
  await exported(context);
  const archiveFile = await archive(context, Buffer.from('fixture'));
  const repository = path.join(context.directory, 'fixture-repository');
  await fs.mkdir(repository);
  await fs.mkdir(path.join(repository, '.git'));
  await assert.rejects(
    decryptPortableRecovery({ ...context, archiveFile, outputFile: path.join(repository, 'restored.plain') }),
    /outside Git/
  );
  const actual = path.join(context.directory, 'actual-restore');
  const linked = path.join(context.directory, 'linked-restore');
  await fs.mkdir(actual);
  await fs.symlink(actual, linked, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(
    decryptPortableRecovery({ ...context, archiveFile, outputFile: path.join(linked, 'restored.plain') }),
    /symbolic links/
  );
  assert.deepEqual(await fs.readdir(actual), []);
});

test('CLI accepts paths only and refuses unknown or duplicated options', async () => {
  assert.match((await runPortableBackupCli(['--help'])).help, /--code-file FILE/);
  for (const args of [
    [],
    ['verify', '--code', 'unsupported-input'],
    ['export', '--keyring', 'x', '--keyring', 'y'],
    ['verify', '--code-file', ''],
    ['verify', '--key', randomUUID()],
    ['verify', 'toString', 'unsupported-input'],
  ]) {
    await assert.rejects(runPortableBackupCli(args));
  }
  const child = spawnSync(
    process.execPath,
    [path.resolve(import.meta.dirname, 'portable-backup-recovery.mjs'), 'verify', '--code', 'unsupported-input'],
    { encoding: 'utf8', windowsHide: true }
  );
  assert.equal(child.status, 1);
  assert.equal((child.stdout + child.stderr).includes('unsupported-input'), false);
  assert.match(child.stderr, /Use --help/);
});
