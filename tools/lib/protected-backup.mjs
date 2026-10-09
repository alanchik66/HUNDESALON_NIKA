import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { PassThrough, Readable, Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const MAGIC = Buffer.from('NIKABK01');
const TAG_BYTES = 16;
const MAX_HEADER_BYTES = 4096;
export const DEFAULT_BACKUP_MAX_BYTES = 10 * 1024 * 1024 * 1024;
const KEY_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const TYPES = new Set(['tar', 'd1-sql', 'git-bundle']);

function validateKey(value) {
  if (!value || !KEY_ID.test(value.keyId || '') || !Buffer.isBuffer(value.key) || value.key.length !== 32) {
    throw new Error('Invalid backup key.');
  }
  return value;
}

function maximumBytes(value) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 100 * 1024 * 1024 * 1024) {
    throw new Error('Invalid backup stream limit.');
  }
  return value;
}

class ByteLimit extends Transform {
  bytes = 0;
  constructor(maximum) {
    super();
    this.maximum = maximumBytes(maximum);
  }
  _transform(chunk, encoding, callback) {
    this.bytes += chunk.length;
    if (this.bytes > this.maximum) return callback(new Error('Backup stream limit exceeded.'));
    callback(null, chunk);
  }
}

function windowsExecutable(name) {
  return path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', name);
}

async function command(executable, args, input = '') {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '';
    let outputBytes = 0;
    const deadline = setTimeout(() => {
      child.kill();
      reject(new Error('Backup key operation timed out.'));
    }, 30_000);
    child.stdout.on('data', chunk => {
      outputBytes += chunk.length;
      if (outputBytes > 128 * 1024) child.kill();
      else output += chunk.toString('utf8');
    });
    child.stderr.on('data', () => {});
    child.stdin.on('error', () => {});
    child.on('error', () => {
      clearTimeout(deadline);
      reject(new Error('Backup key operation failed.'));
    });
    child.on('close', code => {
      clearTimeout(deadline);
      if (code !== 0 || outputBytes > 128 * 1024) reject(new Error('Backup key operation failed.'));
      else resolve(output.trim());
    });
    child.stdin.end(input);
  });
}

async function securePath(target, directory = false) {
  if (process.platform !== 'win32') return fs.chmod(target, directory ? 0o700 : 0o600);
  // Replace the ACL instead of retaining an unexpected explicit permission.
  const script = [
    '$ErrorActionPreference="Stop";',
    '$data=[Console]::In.ReadToEnd() | ConvertFrom-Json;',
    '$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User;',
    '$system=[Security.Principal.SecurityIdentifier]::new("S-1-5-18");',
    'if($data.directory) { $acl=[Security.AccessControl.DirectorySecurity]::new(); $inheritance=[Security.AccessControl.InheritanceFlags]"ContainerInherit, ObjectInherit" }',
    'else { $acl=[Security.AccessControl.FileSecurity]::new(); $inheritance=[Security.AccessControl.InheritanceFlags]::None };',
    '$acl.SetAccessRuleProtection($true,$false);',
    'foreach($principal in @($sid,$system)) { $rule=[Security.AccessControl.FileSystemAccessRule]::new($principal,[Security.AccessControl.FileSystemRights]::FullControl,$inheritance,[Security.AccessControl.PropagationFlags]::None,[Security.AccessControl.AccessControlType]::Allow); $acl.AddAccessRule($rule) };',
    'if($data.directory) { [IO.Directory]::SetAccessControl($data.target,$acl) } else { [IO.File]::SetAccessControl($data.target,$acl) };',
  ].join(' ');
  await command(
    windowsExecutable('WindowsPowerShell/v1.0/powershell.exe'),
    ['-NoProfile', '-NonInteractive', '-Command', script],
    JSON.stringify({ target, directory })
  );
}

async function dpapi(mode, value) {
  const script = [
    '$ErrorActionPreference="Stop";',
    'Add-Type -AssemblyName System.Security;',
    '$data=[Console]::In.ReadToEnd() | ConvertFrom-Json;',
    '$bytes=[Convert]::FromBase64String($data.value);',
    '$entropy=[Text.Encoding]::UTF8.GetBytes("HUNDESALON_NIKA backup key v1");',
    'if($data.mode -eq "protect") { $result=[Security.Cryptography.ProtectedData]::Protect($bytes,$entropy,[Security.Cryptography.DataProtectionScope]::CurrentUser) }',
    'elseif($data.mode -eq "unprotect") { $result=[Security.Cryptography.ProtectedData]::Unprotect($bytes,$entropy,[Security.Cryptography.DataProtectionScope]::CurrentUser) }',
    'else { throw "Invalid operation" };',
    '[Console]::Out.Write([Convert]::ToBase64String($result));',
  ].join(' ');
  return command(
    windowsExecutable('WindowsPowerShell/v1.0/powershell.exe'),
    ['-NoProfile', '-NonInteractive', '-Command', script],
    JSON.stringify({ mode, value })
  );
}

/**
 * DPAPI CurrentUser protects each random key outside the repository.
 * Recovery depends on this Windows user's DPAPI profile and its key files.
 * Copying the encrypted archive alone to another computer is insufficient.
 * A separately protected/exported recovery key or tested Windows-profile recovery
 * is required for disaster recovery; this helper does not invent a passphrase.
 */
export async function windowsBackupKey(keyId) {
  if (process.platform !== 'win32' || !process.env.LOCALAPPDATA) {
    throw new Error('Windows DPAPI backup key provider is unavailable.');
  }
  const repository = path.resolve(import.meta.dirname, '../..').toLowerCase();
  const directory = path.resolve(process.env.LOCALAPPDATA, 'HUNDESALON_NIKA', 'backup-keys');
  if (directory.toLowerCase() === repository || directory.toLowerCase().startsWith(repository + path.sep)) {
    throw new Error('Backup keys must remain outside the repository.');
  }
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  await securePath(directory, true).catch(() => {
    throw new Error('Backup key directory permission operation failed.');
  });
  if (keyId !== undefined && !KEY_ID.test(keyId)) throw new Error('Invalid backup key identifier.');
  const resolvedId = keyId || randomUUID();
  const file = path.join(directory, resolvedId + '.protected-key.json');
  if (keyId) {
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.size > 64 * 1024) throw new Error('Invalid protected key file.');
    const value = JSON.parse(await fs.readFile(file, 'utf8'));
    if (value.version !== 1 || value.keyId !== resolvedId || typeof value.protectedKey !== 'string') {
      throw new Error('Invalid protected key file.');
    }
    const decoded = await dpapi('unprotect', value.protectedKey);
    return validateKey({ keyId: resolvedId, key: Buffer.from(decoded, 'base64') });
  }
  const key = randomBytes(32);
  const protectedKey = await dpapi('protect', key.toString('base64')).catch(() => {
    key.fill(0);
    throw new Error('Backup key DPAPI protection failed.');
  });
  const temporary = file + '.' + randomUUID() + '.partial';
  try {
    await fs.writeFile(temporary, JSON.stringify({ version: 1, keyId: resolvedId, protectedKey }) + '\n', {
      flag: 'wx',
      mode: 0o600,
    });
    await securePath(temporary).catch(() => {
      throw new Error('Backup key file permission operation failed.');
    });
    await fs.link(temporary, file);
    await fs.unlink(temporary);
  } catch (error) {
    await fs.unlink(temporary).catch(() => {});
    key.fill(0);
    throw error;
  }
  return { keyId: resolvedId, key };
}

/** Encrypt directly from a stream; no plaintext archive is written to disk. */
export async function protectBackupStream({
  source,
  outputPath,
  type = 'tar',
  keyProvider = windowsBackupKey,
  maxBytes = DEFAULT_BACKUP_MAX_BYTES,
  completion = Promise.resolve(),
}) {
  // Observe the producer before any key preparation can await.
  const producer = Promise.resolve(completion);
  producer.catch(() => {});
  if (!TYPES.has(type)) throw new Error('Unsupported backup type.');
  maximumBytes(maxBytes);
  const file = path.resolve(outputPath);
  const temporary = file + '.' + randomUUID() + '.partial';
  // Child-process streams may be drained on exit. Attach immediately and let
  // bounded backpressure hold their bytes while DPAPI/file setup is pending.
  const buffered = new PassThrough({ highWaterMark: 64 * 1024 });
  const forwardError = error => buffered.destroy(error);
  buffered.on('error', () => {});
  source.on('error', forwardError);
  source.pipe(buffered);
  let keyData;
  let handle;
  let stage = 'key protection';
  try {
    keyData = validateKey(await keyProvider());
    await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    const iv = randomBytes(12);
    const header = Buffer.from(
      JSON.stringify({
        format: 'nika-protected-backup',
        version: 1,
        type,
        cipher: 'aes-256-gcm',
        keyId: keyData.keyId,
        iv: iv.toString('hex'),
        createdAt: new Date().toISOString(),
      }),
      'utf8'
    );
    const length = Buffer.alloc(4);
    length.writeUInt32BE(header.length);
    const aad = Buffer.concat([MAGIC, length, header]);
    const cipher = createCipheriv('aes-256-gcm', keyData.key, iv);
    cipher.setAAD(aad);
    const meter = new ByteLimit(maxBytes);
    stage = 'file permissions';
    handle = await fs.open(temporary, 'wx', 0o600);
    await securePath(temporary);
    await handle.writeFile(aad);
    const output = createWriteStream(temporary, { fd: handle.fd, autoClose: false, start: aad.length });
    const appendTag = new Transform({
      transform(chunk, encoding, callback) {
        callback(null, chunk);
      },
      flush(callback) {
        this.push(cipher.getAuthTag());
        callback();
      },
    });
    stage = 'archive stream';
    await pipeline(buffered, meter, cipher, appendTag, output);
    stage = 'producer completion';
    await producer;
    stage = 'atomic publication';
    await handle.sync();
    await handle.close();
    handle = undefined;
    // Hard-link publication is atomic and never overwrites an existing backup.
    await fs.link(temporary, file);
    await fs.unlink(temporary);
    const stat = await fs.stat(file);
    return { file, size: stat.size, keyId: keyData.keyId, type, plaintextBytes: meter.bytes };
  } catch {
    source.unpipe(buffered);
    source.destroy();
    buffered.destroy();
    await handle?.close().catch(() => {});
    await fs.unlink(temporary).catch(() => {});
    throw new Error('Encrypted backup creation failed during ' + stage + '.');
  } finally {
    source.off('error', forwardError);
    keyData?.key.fill(0);
  }
}

async function backupEnvelope(file, maxBytes) {
  const handle = await fs.open(path.resolve(file), 'r');
  try {
    const stat = await handle.stat();
    if (
      !stat.isFile() ||
      stat.size < MAGIC.length + 4 + TAG_BYTES ||
      stat.size > maxBytes + MAX_HEADER_BYTES + 12 + TAG_BYTES
    ) {
      throw new Error('Invalid protected backup size.');
    }
    const prefix = Buffer.alloc(MAGIC.length + 4);
    if (
      (await handle.read(prefix, 0, prefix.length, 0)).bytesRead !== prefix.length ||
      !prefix.subarray(0, MAGIC.length).equals(MAGIC)
    ) {
      throw new Error('Invalid protected backup format.');
    }
    const size = prefix.readUInt32BE(MAGIC.length);
    if (!size || size > MAX_HEADER_BYTES || stat.size < prefix.length + size + TAG_BYTES) {
      throw new Error('Invalid protected backup header.');
    }
    const headerBytes = Buffer.alloc(size);
    if ((await handle.read(headerBytes, 0, size, prefix.length)).bytesRead !== size)
      throw new Error('Truncated backup.');
    const header = JSON.parse(headerBytes.toString('utf8'));
    if (
      header.format !== 'nika-protected-backup' ||
      header.version !== 1 ||
      header.cipher !== 'aes-256-gcm' ||
      !TYPES.has(header.type) ||
      !KEY_ID.test(header.keyId || '') ||
      !/^[a-f0-9]{24}$/i.test(header.iv || '')
    ) {
      throw new Error('Invalid protected backup header.');
    }
    const tag = Buffer.alloc(TAG_BYTES);
    if ((await handle.read(tag, 0, TAG_BYTES, stat.size - TAG_BYTES)).bytesRead !== TAG_BYTES)
      throw new Error('Truncated backup.');
    return {
      handle,
      header,
      aad: Buffer.concat([prefix, headerBytes]),
      tag,
      offset: prefix.length + size,
      size: stat.size,
    };
  } catch {
    await handle.close();
    throw new Error('Protected backup is invalid.');
  }
}

/**
 * Plaintext is streamed to sink before the final GCM tag is checked.
 * First call verifyProtectedBackup before restoring/parsing any plaintext.
 * Callers must discard any partial restore when this function rejects.
 */
export async function decryptBackupStream({
  file,
  sink,
  keyProvider = windowsBackupKey,
  maxBytes = DEFAULT_BACKUP_MAX_BYTES,
}) {
  maximumBytes(maxBytes);
  const envelope = await backupEnvelope(file, maxBytes);
  let keyData;
  try {
    keyData = validateKey(await keyProvider(envelope.header.keyId));
    if (keyData.keyId !== envelope.header.keyId) throw new Error('Incorrect backup key identifier.');
    const decipher = createDecipheriv('aes-256-gcm', keyData.key, Buffer.from(envelope.header.iv, 'hex'));
    decipher.setAAD(envelope.aad);
    decipher.setAuthTag(envelope.tag);
    const meter = new ByteLimit(maxBytes);
    const input =
      envelope.size === envelope.offset + TAG_BYTES
        ? Readable.from([])
        : createReadStream(path.resolve(file), {
            fd: envelope.handle.fd,
            autoClose: false,
            start: envelope.offset,
            end: envelope.size - TAG_BYTES - 1,
          });
    await pipeline(input, decipher, meter, sink);
    return {
      file: path.resolve(file),
      size: envelope.size,
      keyId: envelope.header.keyId,
      type: envelope.header.type,
      plaintextBytes: meter.bytes,
    };
  } catch {
    throw new Error('Protected backup integrity or key validation failed.');
  } finally {
    keyData?.key.fill(0);
    await envelope.handle.close().catch(() => {});
  }
}

export async function verifyProtectedBackup(options) {
  return decryptBackupStream({
    ...options,
    sink: new Writable({
      write(chunk, encoding, callback) {
        callback();
      },
    }),
  });
}
