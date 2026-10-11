import { createCipheriv, createDecipheriv, randomBytes, randomUUID, scrypt } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { secureBackupPath, windowsBackupKey } from './protected-backup.mjs';

const MAGIC = Buffer.from('NIKAKR01');
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_HEADER_BYTES = 4096;
const MAX_KEYS = 128;
const KEY_ID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const RECORD_BYTES = 36 + 32;
const TAG_BYTES = 16;
const KDF = Object.freeze({ algorithm: 'scrypt', N: 131072, r: 8, p: 1, keyLength: 32 });
const derive = promisify(scrypt);

function recoveryCode(value) {
  if (!Buffer.isBuffer(value) || value.length !== 32) {
    throw new Error('A 32-byte random recovery code is required.');
  }
  return Buffer.from(value);
}

function canonicalKeyId(value) {
  if (typeof value !== 'string' || !KEY_ID.test(value)) throw new Error('Invalid recovery key identifier.');
  return value.toLowerCase();
}

function selectedKeyIds(values) {
  if (!Array.isArray(values) || !values.length || values.length > MAX_KEYS) {
    throw new Error('Recovery key selection must contain between 1 and 128 keys.');
  }
  const ids = values.map(canonicalKeyId);
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate recovery key identifier.');
  return ids;
}

function exactFields(value, fields) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === fields.length &&
    fields.every(field => Object.hasOwn(value, field))
  );
}

function outsideRepository(repository, target) {
  const relative = path.relative(repository, target);
  return relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative);
}

async function outputFile(outputPath) {
  if (typeof outputPath !== 'string' || !path.isAbsolute(outputPath)) {
    throw new Error('An absolute recovery keyring output path is required.');
  }
  const repository = await fs.realpath(path.resolve(import.meta.dirname, '../..'));
  const file = path.resolve(outputPath);
  if (!outsideRepository(repository, file)) throw new Error('Recovery keyrings must remain outside the repository.');
  // Check the nearest existing ancestor before mkdir: a junction followed by
  // nonexistent children must not create even empty directories in Git.
  let ancestor = path.dirname(file);
  while (true) {
    try {
      const existing = await fs.realpath(ancestor);
      const destination = path.resolve(existing, path.relative(ancestor, file));
      if (!outsideRepository(repository, destination)) {
        throw new Error('Recovery keyrings must remain outside the repository.');
      }
      break;
    } catch (error) {
      const parent = path.dirname(ancestor);
      if (error.code !== 'ENOENT' || parent === ancestor) throw error;
      ancestor = parent;
    }
  }
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const parent = await fs.realpath(path.dirname(file));
  const resolved = path.join(parent, path.basename(file));
  if (!outsideRepository(repository, resolved))
    throw new Error('Recovery keyrings must remain outside the repository.');
  return resolved;
}

async function wrappingKey(secret, salt) {
  // Version 1 accepts only these fixed costs. Untrusted files cannot select an
  // expensive KDF, an excessive maxmem, or weakened parameters.
  return derive(secret, salt, 32, { N: KDF.N, r: KDF.r, p: KDF.p, maxmem: 256 * 1024 * 1024 });
}

/** Generate a recovery code for separate user custody; never log the buffer. */
export function generateRecoveryCode() {
  return randomBytes(32);
}

/**
 * Wrap existing archive keys without changing any archive or DPAPI record.
 * The recovery code and raw archive keys exist only in process memory here.
 * The caller keeps ownership of recoverySecret and must erase it when done.
 */
export async function createPortableKeyring({ keyIds, keyProvider = windowsBackupKey, recoverySecret, outputPath }) {
  const ids = selectedKeyIds(keyIds);
  const secret = recoveryCode(recoverySecret);
  let payload;
  let wrapping;
  let temporary;
  let handle;
  try {
    if (typeof keyProvider !== 'function') throw new Error('Invalid recovery key provider.');
    const file = await outputFile(outputPath);
    // Detect an existing destination before unwrapping any archive key.
    await fs.lstat(file).then(
      () => {
        throw new Error('Recovery keyring output already exists.');
      },
      error => {
        if (error.code !== 'ENOENT') throw error;
      }
    );
    payload = Buffer.alloc(ids.length * RECORD_BYTES);
    for (let index = 0; index < ids.length; index += 1) {
      const supplied = await keyProvider(ids[index]);
      try {
        if (
          canonicalKeyId(supplied?.keyId) !== ids[index] ||
          !Buffer.isBuffer(supplied.key) ||
          supplied.key.length !== 32
        ) {
          throw new Error('Invalid recovery key provider result.');
        }
        payload.write(ids[index], index * RECORD_BYTES, 36, 'ascii');
        supplied.key.copy(payload, index * RECORD_BYTES + 36);
      } finally {
        if (Buffer.isBuffer(supplied?.key)) supplied.key.fill(0);
      }
    }
    const salt = randomBytes(32);
    const nonce = randomBytes(12);
    const header = Buffer.from(
      JSON.stringify({
        format: 'nika-portable-keyring',
        version: 1,
        cipher: 'aes-256-gcm',
        kdf: { ...KDF, salt: salt.toString('hex') },
        iv: nonce.toString('hex'),
        keyCount: ids.length,
      })
    );
    const prefix = Buffer.alloc(MAGIC.length + 4);
    MAGIC.copy(prefix);
    prefix.writeUInt32BE(header.length, MAGIC.length);
    const aad = Buffer.concat([prefix, header]);
    wrapping = await wrappingKey(secret, salt);
    const cipher = createCipheriv('aes-256-gcm', wrapping, nonce, { authTagLength: TAG_BYTES });
    cipher.setAAD(aad);
    const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
    const envelope = Buffer.concat([aad, encrypted, cipher.getAuthTag()]);
    temporary = file + '.' + randomUUID() + '.partial';
    handle = await fs.open(temporary, 'wx', 0o600);
    await secureBackupPath(temporary);
    await handle.writeFile(envelope);
    await handle.sync();
    await handle.close();
    handle = undefined;
    // Atomic, exclusive publication preserves every existing recovery bundle.
    await fs.link(temporary, file);
    // Publication is the commit point. A transient cleanup failure must not
    // cancel a complete keyring or cause its caller to discard recovery data.
    await fs.unlink(temporary).catch(() => {});
    temporary = undefined;
    return Object.freeze({
      file,
      size: envelope.length,
      keyIds: Object.freeze([...ids]),
      version: 1,
      format: 'nika-portable-keyring',
    });
  } catch {
    throw new Error('Portable recovery keyring creation failed.');
  } finally {
    secret.fill(0);
    payload?.fill(0);
    wrapping?.fill(0);
    await handle?.close().catch(() => {});
    if (temporary) await fs.unlink(temporary).catch(() => {});
  }
}

async function readEnvelope(file) {
  if (typeof file !== 'string' || !path.isAbsolute(file)) throw new Error('Invalid recovery keyring path.');
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.size < MAGIC.length + 4 + TAG_BYTES || stat.size > MAX_FILE_BYTES) {
    throw new Error('Invalid recovery keyring size.');
  }
  const handle = await fs.open(file, 'r');
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.size !== stat.size) throw new Error('Recovery keyring changed during read.');
    const bytes = Buffer.alloc(opened.size);
    let offset = 0;
    while (offset < bytes.length) {
      const read = await handle.read(bytes, offset, bytes.length - offset, offset);
      if (!read.bytesRead) throw new Error('Truncated recovery keyring.');
      offset += read.bytesRead;
    }
    if ((await handle.stat()).size !== bytes.length) throw new Error('Recovery keyring changed during read.');
    if (!bytes.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Invalid recovery keyring format.');
    const headerSize = bytes.readUInt32BE(MAGIC.length);
    if (!headerSize || headerSize > MAX_HEADER_BYTES || bytes.length < 12 + headerSize + TAG_BYTES) {
      throw new Error('Invalid recovery keyring header size.');
    }
    const header = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(12, 12 + headerSize)));
    if (
      !exactFields(header, ['format', 'version', 'cipher', 'kdf', 'iv', 'keyCount']) ||
      header.format !== 'nika-portable-keyring' ||
      header.version !== 1 ||
      header.cipher !== 'aes-256-gcm' ||
      !exactFields(header.kdf, [...Object.keys(KDF), 'salt']) ||
      !Object.entries(KDF).every(([key, value]) => header.kdf[key] === value) ||
      typeof header.kdf.salt !== 'string' ||
      !/^[a-f0-9]{64}$/.test(header.kdf.salt) ||
      typeof header.iv !== 'string' ||
      !/^[a-f0-9]{24}$/.test(header.iv) ||
      !Number.isSafeInteger(header.keyCount) ||
      header.keyCount < 1 ||
      header.keyCount > MAX_KEYS ||
      bytes.length !== 12 + headerSize + header.keyCount * RECORD_BYTES + TAG_BYTES
    ) {
      throw new Error('Invalid recovery keyring header.');
    }
    return {
      header,
      aad: bytes.subarray(0, 12 + headerSize),
      ciphertext: bytes.subarray(12 + headerSize, bytes.length - TAG_BYTES),
      tag: bytes.subarray(bytes.length - TAG_BYTES),
    };
  } finally {
    await handle.close();
  }
}

/**
 * Authenticate the entire bounded keyring before exposing a portable provider.
 * Every provider call returns a fresh key buffer for the archive helper to erase.
 * There is deliberately no fallback to DPAPI or automatic key creation.
 */
export async function openPortableKeyring({ file, recoverySecret }) {
  const secret = recoveryCode(recoverySecret);
  let wrapping;
  let unfinished;
  let payload;
  const keys = new Map();
  try {
    const envelope = await readEnvelope(file);
    wrapping = await wrappingKey(secret, Buffer.from(envelope.header.kdf.salt, 'hex'));
    const decipher = createDecipheriv('aes-256-gcm', wrapping, Buffer.from(envelope.header.iv, 'hex'), {
      authTagLength: TAG_BYTES,
    });
    decipher.setAAD(envelope.aad);
    decipher.setAuthTag(envelope.tag);
    unfinished = decipher.update(envelope.ciphertext);
    // final() must succeed before even one decoded archive key is returned.
    const final = decipher.final();
    payload = Buffer.concat([unfinished, final]);
    final.fill(0);
    for (let index = 0; index < envelope.header.keyCount; index += 1) {
      const offset = index * RECORD_BYTES;
      const encodedId = payload.subarray(offset, offset + 36);
      const id = canonicalKeyId(encodedId.toString('ascii'));
      if (!encodedId.equals(Buffer.from(id, 'ascii')) || keys.has(id)) {
        throw new Error('Invalid or duplicate recovery key identifier.');
      }
      keys.set(id, Buffer.from(payload.subarray(offset + 36, offset + RECORD_BYTES)));
    }
    const keyIds = Object.freeze([...keys.keys()]);
    let disposed = false;
    return Object.freeze({
      keyIds,
      keyProvider: async keyId => {
        if (disposed) throw new Error('Portable recovery key provider has been disposed.');
        const id = canonicalKeyId(keyId);
        const key = keys.get(id);
        if (!key) throw new Error('Archive key is absent from the portable recovery keyring.');
        return { keyId: id, key: Buffer.from(key) };
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        for (const key of keys.values()) key.fill(0);
        keys.clear();
      },
    });
  } catch {
    for (const key of keys.values()) key.fill(0);
    keys.clear();
    throw new Error('Portable recovery keyring authentication or validation failed.');
  } finally {
    secret.fill(0);
    wrapping?.fill(0);
    unfinished?.fill(0);
    payload?.fill(0);
  }
}
