#!/usr/bin/env node
/** Authenticate a protected backup without writing or extracting plaintext. */
import { spawn } from 'node:child_process';
import { DatabaseSync, constants } from 'node:sqlite';
import { Writable } from 'node:stream';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decryptBackupStream, verifyProtectedBackup, windowsBackupKey } from './lib/protected-backup.mjs';

export async function verifyProjectBackup({ file, keyProvider = windowsBackupKey }) {
  const authenticated = await verifyProtectedBackup({ file, keyProvider });
  if (authenticated.type === 'd1-sql') return verifyD1Backup({ file, keyProvider });
  if (authenticated.type !== 'tar')
    throw new Error('Structured Git bundle restore is not supported by this CLI; use a separate Git restore verifier.');
  const tar =
    process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:/Windows', 'System32/tar.exe') : 'tar';
  const child = spawn(tar, ['-tf', '-'], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  child.stderr.resume();
  let entries = 0;
  let listingBytes = 0;
  let lastByte;
  child.stdout.on('data', chunk => {
    listingBytes += chunk.length;
    if (listingBytes > 64 * 1024 * 1024) {
      child.kill();
      return;
    }
    for (const byte of chunk) if (byte === 10) entries += 1;
    lastByte = chunk[chunk.length - 1];
  });
  const completion = new Promise((resolve, reject) => {
    child.once('error', () => reject(new Error('Tar directory verification failed.')));
    child.once('close', code =>
      code === 0 && listingBytes <= 64 * 1024 * 1024
        ? resolve()
        : reject(new Error('Tar directory verification failed.'))
    );
  });
  completion.catch(() => {});
  const deadline = setTimeout(() => child.kill(), 5 * 60 * 1000);
  try {
    await decryptBackupStream({ file, keyProvider, sink: child.stdin });
    await completion;
    if (listingBytes && lastByte !== 10) entries += 1;
    return { ...authenticated, entries };
  } catch (error) {
    child.kill();
    throw error;
  } finally {
    clearTimeout(deadline);
  }
}

/** Restore a verified D1 SQL export into memory only, without contacting D1. */
export async function verifyD1Backup({ file, keyProvider = windowsBackupKey, maxBytes = 256 * 1024 * 1024 }) {
  const authenticated = await verifyProtectedBackup({ file, keyProvider, maxBytes });
  if (authenticated.type !== 'd1-sql') throw new Error('Expected a D1 SQL backup.');
  const chunks = [];
  let payload;
  let database;
  try {
    await decryptBackupStream({
      file,
      keyProvider,
      maxBytes,
      sink: new Writable({
        write(chunk, encoding, callback) {
          chunks.push(Buffer.from(chunk));
          callback();
        },
      }),
    });
    payload = Buffer.concat(chunks);
    const sql = new TextDecoder('utf-8', { fatal: true }).decode(payload);
    database = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false, allowExtension: false });
    if (typeof database.setAuthorizer !== 'function') throw new Error('SQLite authorizer is unavailable.');
    database.exec('PRAGMA temp_store=MEMORY;');
    database.enableDefensive(true);
    // The restore can modify only its temporary in-memory database. Block SQL
    // that could attach/write disk databases or change storage-related pragmas.
    database.setAuthorizer((action, first, second) => {
      if (
        action === constants.SQLITE_ATTACH ||
        action === constants.SQLITE_DETACH ||
        action === constants.SQLITE_CREATE_VTABLE ||
        action === constants.SQLITE_DROP_VTABLE
      )
        return constants.SQLITE_DENY;
      if (
        action === constants.SQLITE_PRAGMA &&
        !new Set(['foreign_keys', 'defer_foreign_keys', 'integrity_check', 'foreign_key_check']).has(
          String(first).toLowerCase()
        )
      ) {
        return constants.SQLITE_DENY;
      }
      if (action === constants.SQLITE_FUNCTION && String(second).toLowerCase() === 'load_extension')
        return constants.SQLITE_DENY;
      return constants.SQLITE_OK;
    });
    database.exec(sql);
    const integrity = database.prepare('PRAGMA integrity_check').get();
    if (integrity?.integrity_check !== 'ok') throw new Error('Restored database integrity check failed.');
    const tables = database
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all();
    if (!tables.length || tables.length > 200) throw new Error('Unexpected restored database table count.');
    const tableCounts = tables.map(({ name }) => ({
      table: name,
      rows: Number(database.prepare('SELECT COUNT(*) AS total FROM "' + name.replaceAll('"', '""') + '"').get().total),
    }));
    const foreignKeyViolations = Number(
      database.prepare('SELECT COUNT(*) AS total FROM pragma_foreign_key_check').get().total
    );
    if (foreignKeyViolations) throw new Error('Restored database foreign key check failed.');
    return {
      ...authenticated,
      restore: 'isolated in-memory SQLite',
      integrity: 'ok',
      foreignKeyViolations,
      tableCounts,
    };
  } catch {
    throw new Error('Isolated D1 backup restore verification failed.');
  } finally {
    database?.close();
    payload?.fill(0);
    for (const chunk of chunks) chunk.fill(0);
    chunks.length = 0;
  }
}

async function main() {
  if (process.argv.length !== 3) throw new Error('Usage: node tools/verify-protected-backup.mjs <archive.nikabk>');
  console.log(
    JSON.stringify({ status: 'verified', ...(await verifyProjectBackup({ file: process.argv[2] })) }, null, 2)
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
