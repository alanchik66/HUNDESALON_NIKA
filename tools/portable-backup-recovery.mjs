#!/usr/bin/env node
/** Export a separately protected recovery route for existing backup keys. */
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  decryptBackupStream,
  secureBackupPath,
  verifyProtectedBackup,
  windowsBackupKey,
} from './lib/protected-backup.mjs';
import { createPortableKeyring, generateRecoveryCode, openPortableKeyring } from './lib/portable-backup-keyring.mjs';
import { verifyProjectBackup } from './verify-protected-backup.mjs';

const KEY_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const CODE_FORMAT = /^NIKA-RECOVERY-1\r?\n([a-f0-9]{64})\r?\n?$/;
const USAGE = [
  'Usage:',
  '  node tools/portable-backup-recovery.mjs export --key UUID [--key UUID] --keyring FILE --code-file FILE',
  '  node tools/portable-backup-recovery.mjs verify --archive FILE --keyring FILE --code-file FILE',
  '  node tools/portable-backup-recovery.mjs decrypt --archive FILE --keyring FILE --code-file FILE --output FILE',
  'Use absolute paths outside Git. Keep the recovery code in a separate private location.',
].join('\n');

function resolvedFile(value) {
  if (typeof value !== 'string' || !value.trim() || !path.isAbsolute(value) || value.includes('\0')) {
    throw new Error('An absolute recovery file path is required.');
  }
  return path.resolve(value);
}

async function statOrAbsent(file) {
  try {
    return await fs.lstat(file);
  } catch (error) {
    if (error.code === 'ENOENT') return undefined;
    throw new Error('Recovery path validation failed.');
  }
}

function sameFile(stat, identity) {
  return stat?.isFile() && !stat.isSymbolicLink() && stat.ino === identity?.ino && stat.dev === identity?.dev;
}

async function removeOwnedFile(file, identity) {
  if (identity && sameFile(await statOrAbsent(file), identity)) await fs.unlink(file);
}

/** Reject symlinks/junctions and every Git checkout, including worktrees. */
async function validatePath(value, { output = false, maxBytes } = {}) {
  const file = resolvedFile(value);
  let current = file;
  while (true) {
    const stat = await statOrAbsent(current);
    if (stat?.isSymbolicLink()) throw new Error('Recovery paths cannot contain symbolic links.');
    if (current !== file && stat && !stat.isDirectory()) throw new Error('Invalid recovery parent directory.');
    if (
      path.basename(current).toLowerCase() === '.git' ||
      (current !== file && stat?.isDirectory() && (await statOrAbsent(path.join(current, '.git'))))
    ) {
      throw new Error('Recovery files must remain outside Git.');
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  const stat = await statOrAbsent(file);
  if (output && stat) throw new Error('Recovery output already exists.');
  if (!output && (!stat?.isFile() || stat.size === 0 || (maxBytes && stat.size > maxBytes))) {
    throw new Error('Invalid recovery input file.');
  }
  return file;
}

async function separateFiles(keyringFile, codeFile, output) {
  const keyring = await validatePath(keyringFile, { output, maxBytes: 128 * 1024 });
  const code = await validatePath(codeFile, { output, maxBytes: 1024 });
  const comparison = value => (process.platform === 'win32' ? value.toLowerCase() : value);
  if (comparison(path.dirname(keyring)) === comparison(path.dirname(code))) {
    throw new Error('Recovery code and keyring require separate directories.');
  }
  return { keyring, code };
}

async function prepareParent(file) {
  const parent = path.dirname(file);
  if (!(await statOrAbsent(parent))) {
    const missing = [];
    let current = parent;
    while (!(await statOrAbsent(current))) {
      missing.push(current);
      const next = path.dirname(current);
      if (next === current) throw new Error('Recovery output root is unavailable.');
      current = next;
    }
    for (const directory of missing.reverse()) {
      await fs.mkdir(directory, { mode: 0o700 });
      await secureBackupPath(directory, true);
    }
  }
  // Validate again after creating directories; never follow a substituted link.
  await validatePath(file, { output: true });
}

async function writeCodeExclusive(file, recoverySecret) {
  const temporary = file + '.' + randomUUID() + '.partial';
  let handle;
  let identity;
  const bytes = Buffer.from('NIKA-RECOVERY-1\n' + recoverySecret.toString('hex') + '\n', 'ascii');
  try {
    handle = await fs.open(temporary, 'wx', 0o600);
    identity = await handle.stat();
    // Apply the private ACL before writing any recovery material.
    await secureBackupPath(temporary);
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = undefined;
    if (!sameFile(await statOrAbsent(temporary), identity)) throw new Error('Recovery code output changed.');
    await fs.link(temporary, file);
    // Publication is committed; a transient cleanup failure must not report
    // failure or remove the matching keyring after the code has been published.
    await removeOwnedFile(temporary, identity).catch(() => {});
  } finally {
    bytes.fill(0);
    await handle?.close().catch(() => {});
    await removeOwnedFile(temporary, identity).catch(() => {});
  }
}

/** The returned metadata never includes the generated recovery code or keys. */
export async function exportPortableRecovery({ keyIds, keyringFile, codeFile, keyProvider = windowsBackupKey }) {
  if (
    !Array.isArray(keyIds) ||
    !keyIds.length ||
    keyIds.length > 64 ||
    keyIds.some(keyId => typeof keyId !== 'string' || !KEY_ID.test(keyId)) ||
    new Set(keyIds.map(keyId => keyId.toLowerCase())).size !== keyIds.length
  ) {
    throw new Error('Explicit unique backup key identifiers are required.');
  }
  const { keyring, code } = await separateFiles(keyringFile, codeFile, true);
  await prepareParent(keyring);
  await prepareParent(code);
  const recoverySecret = generateRecoveryCode();
  let createdKeyring;
  let identity;
  try {
    createdKeyring = await createPortableKeyring({ keyIds, keyProvider, recoverySecret, outputPath: keyring });
    identity = await fs.lstat(keyring);
    await writeCodeExclusive(code, recoverySecret);
    return { status: 'exported', keyringFile: keyring, codeFile: code, keyCount: createdKeyring.keyIds.length };
  } catch {
    if (createdKeyring && identity) {
      // Remove only the file this operation published, never another output.
      await removeOwnedFile(keyring, identity).catch(() => {});
    }
    throw new Error('Portable recovery export failed; existing files were preserved.');
  } finally {
    recoverySecret.fill(0);
  }
}

async function readRecoveryCode(file) {
  const bytes = await fs.readFile(file);
  try {
    const match = CODE_FORMAT.exec(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!match) throw new Error('Invalid recovery code file.');
    return Buffer.from(match[1], 'hex');
  } finally {
    bytes.fill(0);
  }
}

/** Verify with portable keys only; DPAPI is never tried. */
export async function verifyPortableRecovery({ archiveFile, keyringFile, codeFile }) {
  const { keyring, code } = await separateFiles(keyringFile, codeFile, false);
  const archive = await validatePath(archiveFile);
  const recoverySecret = await readRecoveryCode(code);
  let opened;
  try {
    opened = await openPortableKeyring({ file: keyring, recoverySecret });
    const authenticated = await verifyProtectedBackup({ file: archive, keyProvider: opened.keyProvider });
    if (authenticated.type === 'git-bundle') {
      return {
        status: 'verified',
        recovery: 'portable keyring',
        ...authenticated,
        restored: false,
        integrityOnly: true,
        verification: 'Authenticated bytes only; an isolated Git restore is still required.',
      };
    }
    return {
      status: 'verified',
      recovery: 'portable keyring',
      ...(await verifyProjectBackup({ file: archive, keyProvider: opened.keyProvider })),
    };
  } catch {
    throw new Error('Portable backup authentication or isolated restore verification failed.');
  } finally {
    opened?.dispose();
    recoverySecret.fill(0);
  }
}

/** Publish plaintext only after full authentication, into a private new file. */
export async function decryptPortableRecovery({ archiveFile, keyringFile, codeFile, outputFile }) {
  const { keyring, code } = await separateFiles(keyringFile, codeFile, false);
  const archive = await validatePath(archiveFile);
  const output = await validatePath(outputFile, { output: true });
  const recoverySecret = await readRecoveryCode(code);
  const temporary = output + '.' + randomUUID() + '.partial';
  let opened;
  let handle;
  let identity;
  try {
    opened = await openPortableKeyring({ file: keyring, recoverySecret });
    // Do not create a plaintext output for an invalid key or corrupted archive.
    const authenticated = await verifyProtectedBackup({ file: archive, keyProvider: opened.keyProvider });
    await prepareParent(output);
    handle = await fs.open(temporary, 'wx', 0o600);
    identity = await handle.stat();
    await secureBackupPath(temporary);
    const sink = createWriteStream(temporary, { fd: handle.fd, autoClose: false });
    await decryptBackupStream({ file: archive, keyProvider: opened.keyProvider, sink });
    await handle.sync();
    await handle.close();
    handle = undefined;
    await validatePath(output, { output: true });
    if (!sameFile(await statOrAbsent(temporary), identity)) throw new Error('Recovery plaintext output changed.');
    await fs.link(temporary, output);
    await removeOwnedFile(temporary, identity).catch(() => {});
    return { status: 'decrypted', recovery: 'portable keyring', ...authenticated, outputFile: output, restored: false };
  } catch {
    throw new Error('Portable backup decryption failed; no partial output was published.');
  } finally {
    await handle?.close().catch(() => {});
    await removeOwnedFile(temporary, identity).catch(() => {});
    opened?.dispose();
    recoverySecret.fill(0);
  }
}

export async function runPortableBackupCli(argv, { keyProvider = windowsBackupKey } = {}) {
  if (argv.length === 1 && argv[0] === '--help') return { help: USAGE };
  const [command, ...arguments_] = argv;
  if (!['export', 'verify', 'decrypt'].includes(command) || arguments_.length % 2) throw new Error(USAGE);
  const options = { keyIds: [] };
  const names = {
    '--keyring': 'keyringFile',
    '--code-file': 'codeFile',
    '--archive': 'archiveFile',
    '--output': 'outputFile',
  };
  for (let index = 0; index < arguments_.length; index += 2) {
    const name = arguments_[index];
    const value = arguments_[index + 1];
    if (!value || value.startsWith('--')) throw new Error(USAGE);
    if (name === '--key' && command === 'export') options.keyIds.push(value);
    else if (
      Object.hasOwn(names, name) &&
      !(name === '--archive' && command === 'export') &&
      !(name === '--output' && command !== 'decrypt') &&
      !options[names[name]]
    ) {
      options[names[name]] = value;
    } else throw new Error(USAGE);
  }
  if (
    !options.keyringFile ||
    !options.codeFile ||
    (command !== 'export' && !options.archiveFile) ||
    (command === 'decrypt' && !options.outputFile)
  )
    throw new Error(USAGE);
  if (command === 'export') return exportPortableRecovery({ ...options, keyProvider });
  return command === 'decrypt' ? decryptPortableRecovery(options) : verifyPortableRecovery(options);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runPortableBackupCli(process.argv.slice(2))
    .then(result => console.log(result.help || JSON.stringify(result, null, 2)))
    .catch(() => {
      // Provider errors can contain private paths. Never forward their content.
      console.error(
        'Portable recovery operation failed. Use --help and check paths, code, key identifiers and permissions.'
      );
      process.exitCode = 1;
    });
}
