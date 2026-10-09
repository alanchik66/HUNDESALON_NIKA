import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';
import { test } from 'node:test';
import { createFullBackup } from '../create-full-backup.mjs';
import { verifyD1Backup, verifyProjectBackup } from '../verify-protected-backup.mjs';
import {
  decryptBackupStream,
  protectBackupStream,
  verifyProtectedBackup,
  windowsBackupKey,
} from './protected-backup.mjs';

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'nika-encrypted-backup-test-'));
  const key = randomBytes(32);
  const keyId = randomUUID();
  t.after(async () => {
    key.fill(0);
    // This is the exact test-owned mkdtemp directory, never a project path.
    assert.ok(path.basename(directory).startsWith('nika-encrypted-backup-test-'));
    await fs.rm(directory, { recursive: true, force: true });
  });
  return { directory, keyId, keyProvider: async () => ({ keyId, key: Buffer.from(key) }) };
}

async function encrypt(context, bytes, options = {}) {
  const outputPath = path.join(context.directory, randomUUID() + '.nikabk');
  const result = await protectBackupStream({
    source: Readable.from([bytes]),
    outputPath,
    keyProvider: context.keyProvider,
    ...options,
  });
  return result;
}

async function plaintext(context, file) {
  const chunks = [];
  const result = await decryptBackupStream({
    file,
    keyProvider: context.keyProvider,
    sink: new Writable({
      write(chunk, encoding, callback) {
        chunks.push(Buffer.from(chunk));
        callback();
      },
    }),
  });
  return { result, bytes: Buffer.concat(chunks) };
}

test('large chunked stream round-trips without plaintext in the encrypted file', async t => {
  const context = await fixture(t);
  const payload = Buffer.concat([Buffer.from('fixture-private-data='), randomBytes(256 * 1024)]);
  const outputPath = path.join(context.directory, 'chunked.nikabk');
  const result = await protectBackupStream({
    source: Readable.from([payload.subarray(0, 8192), payload.subarray(8192)]),
    outputPath,
    type: 'd1-sql',
    keyProvider: context.keyProvider,
  });
  assert.equal(result.plaintextBytes, payload.length);
  assert.equal((await fs.readFile(outputPath)).includes(Buffer.from('fixture-private-data=')), false);
  assert.equal((await verifyProtectedBackup({ file: outputPath, keyProvider: context.keyProvider })).type, 'd1-sql');
  assert.deepEqual((await plaintext(context, outputPath)).bytes, payload);
});

test('valid JSON header modification and ciphertext tampering fail authentication', async t => {
  const context = await fixture(t);
  const result = await encrypt(context, Buffer.from('private fixture payload'));
  const original = await fs.readFile(result.file);
  const headerSize = original.readUInt32BE(8);
  for (const kind of ['header', 'ciphertext', 'tag']) {
    const changed = Buffer.from(original);
    const offset =
      kind === 'header'
        ? original.indexOf(Buffer.from('createdAt')) + 14
        : kind === 'ciphertext'
          ? 12 + headerSize
          : changed.length - 1;
    changed[offset] ^= 1;
    const file = path.join(context.directory, kind + '.nikabk');
    await fs.writeFile(file, changed);
    await assert.rejects(verifyProtectedBackup({ file, keyProvider: context.keyProvider }));
  }
});

test('truncated prefix, header, payload and tag all fail', async t => {
  const context = await fixture(t);
  const result = await encrypt(context, randomBytes(512));
  const bytes = await fs.readFile(result.file);
  for (const length of [4, 12, 30, bytes.length - 17, bytes.length - 1]) {
    const file = path.join(context.directory, 'truncated-' + length + '.nikabk');
    await fs.writeFile(file, bytes.subarray(0, length));
    await assert.rejects(verifyProtectedBackup({ file, keyProvider: context.keyProvider }));
  }
});

test('wrong cryptographic key and key identifier fail', async t => {
  const context = await fixture(t);
  const result = await encrypt(context, Buffer.from('fixture'));
  await assert.rejects(
    verifyProtectedBackup({
      file: result.file,
      keyProvider: async () => ({ keyId: context.keyId, key: randomBytes(32) }),
    })
  );
  await assert.rejects(
    verifyProtectedBackup({
      file: result.file,
      keyProvider: async () => ({ keyId: randomUUID(), key: randomBytes(32) }),
    })
  );
});

test('existing output is never overwritten and incomplete files are removed', async t => {
  const context = await fixture(t);
  const outputPath = path.join(context.directory, 'existing.nikabk');
  await fs.writeFile(outputPath, 'preserved');
  await assert.rejects(
    protectBackupStream({ source: Readable.from(['fixture']), outputPath, keyProvider: context.keyProvider })
  );
  assert.equal(await fs.readFile(outputPath, 'utf8'), 'preserved');
  assert.deepEqual(await fs.readdir(context.directory), ['existing.nikabk']);
});

test('stream limit and producer failure never publish an archive', async t => {
  const context = await fixture(t);
  await assert.rejects(encrypt(context, Buffer.alloc(20), { maxBytes: 10 }));
  await assert.rejects(
    encrypt(context, Buffer.from('fixture'), { completion: Promise.reject(new Error('producer failed')) })
  );
  assert.deepEqual(await fs.readdir(context.directory), []);
});

test('source failure cleans the temporary output', async t => {
  const context = await fixture(t);
  const source = Readable.from(
    (async function* () {
      yield Buffer.from('partial');
      throw new Error('source failed');
    })()
  );
  await assert.rejects(
    protectBackupStream({
      source,
      outputPath: path.join(context.directory, 'source.nikabk'),
      keyProvider: context.keyProvider,
    })
  );
  assert.deepEqual(await fs.readdir(context.directory), []);
});

test('empty authenticated stream is supported', async t => {
  const context = await fixture(t);
  const result = await encrypt(context, Buffer.alloc(0), { type: 'd1-sql' });
  assert.equal(
    (await verifyProtectedBackup({ file: result.file, keyProvider: context.keyProvider })).plaintextBytes,
    0
  );
});

test('unsupported type, key and limits reject before creating files', async t => {
  const context = await fixture(t);
  await assert.rejects(encrypt(context, Buffer.from('fixture'), { type: 'unknown' }));
  await assert.rejects(encrypt(context, Buffer.from('fixture'), { maxBytes: 0 }));
  await assert.rejects(
    encrypt(context, Buffer.from('fixture'), {
      keyProvider: async () => ({ keyId: '../invalid', key: randomBytes(32) }),
    })
  );
  assert.deepEqual(await fs.readdir(context.directory), []);
});

test('real tar backup restores an isolated fixture and excludes regenerable directories at every depth', async t => {
  const context = await fixture(t);
  const projectDir = path.join(context.directory, 'project');
  const backupDir = path.join(context.directory, 'backups');
  const restored = path.join(context.directory, 'restored');
  const included = {
    '.dev.vars': 'FAKE_TEST_SECRET=not-a-credential',
    '.git/config': 'fake git configuration',
    'src/main.js': 'console.log("fixture");',
    '3d-weather-codrops-main/dist-widget/scene.js': 'vendor fixture',
  };
  const excluded = [
    'node_modules/fixture.js',
    'integrations/gateway/node_modules/fixture.js',
    'dist/generated.js',
    'output/screenshot.png',
  ];
  for (const [name, value] of Object.entries(included)) {
    const file = path.join(projectDir, name);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, value);
  }
  for (const name of excluded) {
    const file = path.join(projectDir, name);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, 'generated fixture');
  }
  const result = await createFullBackup({ projectDir, backupDir, keyProvider: context.keyProvider });
  assert.ok(result.entries >= Object.keys(included).length, JSON.stringify(result));
  assert.equal((await fs.readFile(result.file)).includes(Buffer.from(included['.dev.vars'])), false);
  await fs.mkdir(restored);
  const tar =
    process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:/Windows', 'System32/tar.exe') : 'tar';
  const child = spawn(tar, ['-xf', '-', '-C', restored], { windowsHide: true, stdio: ['pipe', 'ignore', 'ignore'] });
  const completion = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', code => (code === 0 ? resolve() : reject(new Error('fixture restore failed'))));
  });
  completion.catch(() => {});
  await decryptBackupStream({ file: result.file, keyProvider: context.keyProvider, sink: child.stdin });
  await completion;
  for (const [name, value] of Object.entries(included))
    assert.equal(await fs.readFile(path.join(restored, 'project', name), 'utf8'), value);
  for (const name of excluded) await assert.rejects(fs.stat(path.join(restored, 'project', name)), { code: 'ENOENT' });
  const files = await fs.readdir(backupDir);
  assert.equal(files.length, 2);
  assert.equal(
    files.some(name => name.endsWith('.tar')),
    false
  );
  await assert.rejects(
    createFullBackup({ projectDir, backupDir: path.join(projectDir, 'unsafe'), keyProvider: context.keyProvider })
  );
});

test('authenticated ciphertext containing invalid tar fails directory verification', async t => {
  const context = await fixture(t);
  const result = await encrypt(context, Buffer.from('not a tar archive'));
  await assert.rejects(verifyProjectBackup({ file: result.file, keyProvider: context.keyProvider }));
});

test('D1 export restores in memory, checks integrity and reports counts without row contents', async t => {
  const context = await fixture(t);
  const sql = Buffer.from(
    "PRAGMA defer_foreign_keys=TRUE; CREATE TABLE customers(id INTEGER PRIMARY KEY, email TEXT); INSERT INTO customers VALUES(1,'fixture@example.invalid'); CREATE TABLE bookings(id INTEGER PRIMARY KEY, customer_id INTEGER REFERENCES customers(id)); INSERT INTO bookings VALUES(1,1);"
  );
  const result = await encrypt(context, sql, { type: 'd1-sql' });
  const verified = await verifyD1Backup({ file: result.file, keyProvider: context.keyProvider });
  assert.equal(verified.restore, 'isolated in-memory SQLite');
  assert.equal(verified.integrity, 'ok');
  assert.equal(verified.foreignKeyViolations, 0);
  assert.deepEqual(verified.tableCounts, [
    { table: 'bookings', rows: 1 },
    { table: 'customers', rows: 1 },
  ]);
  assert.equal(JSON.stringify(verified).includes('fixture@example.invalid'), false);
});

test('D1 restore rejects disk ATTACH and storage pragma changes', async t => {
  const context = await fixture(t);
  const target = path.join(context.directory, 'should-never-exist.sqlite').replaceAll('\\', '/').replaceAll("'", "''");
  for (const sql of [
    "ATTACH DATABASE '" + target + "' AS unsafe; CREATE TABLE unsafe.private_data(value TEXT);",
    "PRAGMA temp_store_directory='" + path.dirname(target) + "'; CREATE TABLE fixture(id INTEGER);",
  ]) {
    const result = await encrypt(context, Buffer.from(sql), { type: 'd1-sql' });
    await assert.rejects(verifyD1Backup({ file: result.file, keyProvider: context.keyProvider }));
  }
  await assert.rejects(fs.stat(target), { code: 'ENOENT' });
});

test('D1 restore rejects inconsistent references and invalid SQL', async t => {
  const context = await fixture(t);
  for (const sql of [
    'CREATE TABLE parent(id INTEGER PRIMARY KEY); CREATE TABLE child(id INTEGER REFERENCES parent(id)); INSERT INTO child VALUES(123);',
    'CREATE TABLE',
  ]) {
    const result = await encrypt(context, Buffer.from(sql), { type: 'd1-sql' });
    await assert.rejects(verifyD1Backup({ file: result.file, keyProvider: context.keyProvider }));
  }
});

test(
  'Windows DPAPI provider encrypts, reopens the key and enforces a strict file ACL',
  { skip: process.platform !== 'win32' },
  async t => {
    const context = await fixture(t);
    const createdKeys = new Set();
    const keyProvider = async keyId => {
      const value = await windowsBackupKey(keyId);
      if (!keyId) createdKeys.add(value.keyId);
      return value;
    };
    t.after(async () => {
      for (const keyId of createdKeys) {
        assert.match(keyId, /^[a-f0-9-]{36}$/);
        const keyFile = path.join(
          process.env.LOCALAPPDATA,
          'HUNDESALON_NIKA',
          'backup-keys',
          keyId + '.protected-key.json'
        );
        // Delete only this test's newly created key after its fixture is removed.
        await fs.unlink(keyFile);
      }
    });
    const result = await encrypt(
      context,
      Buffer.from('CREATE TABLE fixture(id INTEGER PRIMARY KEY); INSERT INTO fixture VALUES(1);'),
      { type: 'd1-sql', keyProvider }
    );
    const verified = await verifyD1Backup({ file: result.file, keyProvider });
    assert.equal(verified.integrity, 'ok');
    assert.deepEqual(verified.tableCounts, [{ table: 'fixture', rows: 1 }]);
    const script =
      '$ErrorActionPreference="Stop"; $target=[Console]::In.ReadToEnd(); $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value; $acl=Get-Acl -LiteralPath $target; $rules=$acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]); $unexpected=@($rules | Where-Object { $_.IdentityReference.Value -notin @($sid,"S-1-5-18") -or $_.AccessControlType -ne "Allow" -or $_.IsInherited }); [Console]::Out.Write((@{protected=$acl.AreAccessRulesProtected;unexpectedRules=$unexpected.Count;ruleCount=@($rules).Count} | ConvertTo-Json -Compress))';
    const checked = spawnSync(
      path.join(process.env.SystemRoot || 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe'),
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { input: result.file, encoding: 'utf8', timeout: 30_000, windowsHide: true }
    );
    assert.equal(checked.status, 0);
    assert.deepEqual(JSON.parse(checked.stdout), { protected: true, unexpectedRules: 0, ruleCount: 2 });
  }
);

test('encrypted Git bundle restores an exact commit into a separate repository', async t => {
  const context = await fixture(t);
  const source = path.join(context.directory, 'git-source');
  const restored = path.join(context.directory, 'git-restored');
  const emptyTemplate = path.join(context.directory, 'empty-template');
  await fs.mkdir(emptyTemplate);
  const git = process.platform === 'win32' ? 'C:/Program Files/Git/cmd/git.exe' : 'git';
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: 'Backup Fixture',
    GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
    GIT_COMMITTER_NAME: 'Backup Fixture',
    GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
  };
  const run = (directory, args, input) =>
    execFileSync(git, ['-C', directory, ...args], {
      env,
      input,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 16 * 1024 * 1024,
    });
  execFileSync(git, ['init', '--bare', '--template=' + emptyTemplate, source], { windowsHide: true, stdio: 'ignore' });
  const content = Buffer.from('private fixture code\n');
  const blob = run(source, ['hash-object', '-w', '--stdin'], content).toString().trim();
  const tree = run(source, ['mktree'], '100644 blob ' + blob + '\tfixture.txt\n')
    .toString()
    .trim();
  const commit = run(source, ['commit-tree', tree, '-m', 'Backup fixture']).toString().trim();
  run(source, ['update-ref', 'refs/heads/main', commit]);
  const bundle = run(source, ['bundle', 'create', '-', 'refs/heads/main']);
  const encrypted = await encrypt(context, bundle, { type: 'git-bundle' });
  assert.equal(
    (await verifyProtectedBackup({ file: encrypted.file, keyProvider: context.keyProvider })).type,
    'git-bundle'
  );
  await assert.rejects(
    verifyProjectBackup({ file: encrypted.file, keyProvider: context.keyProvider }),
    /Structured Git bundle restore/
  );
  const decoded = await plaintext(context, encrypted.file);
  assert.deepEqual(decoded.bytes, bundle);
  execFileSync(git, ['init', '--bare', '--template=' + emptyTemplate, restored], {
    windowsHide: true,
    stdio: 'ignore',
  });
  run(restored, ['bundle', 'unbundle', '-'], decoded.bytes);
  assert.equal(run(restored, ['cat-file', '-t', commit]).toString().trim(), 'commit');
  assert.deepEqual(run(restored, ['cat-file', 'blob', commit + ':fixture.txt']), content);
});
