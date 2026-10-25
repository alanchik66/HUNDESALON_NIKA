#!/usr/bin/env node
/** Stream the whole project into an authenticated encrypted archive. */
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { protectBackupStream, windowsBackupKey } from './lib/protected-backup.mjs';
import { verifyProjectBackup } from './verify-protected-backup.mjs';

function outsideProject(projectDir, target) {
  const relative = path.relative(projectDir, target);
  return relative !== '' && (relative.startsWith('..' + path.sep) || relative === '..' || path.isAbsolute(relative));
}

export async function createFullBackup({
  projectDir = path.resolve(import.meta.dirname, '..'),
  backupDir = path.join(path.dirname(projectDir), 'backups'),
  keyProvider = windowsBackupKey,
} = {}) {
  projectDir = await fs.realpath(projectDir);
  backupDir = path.resolve(backupDir);
  if (!outsideProject(projectDir, backupDir)) throw new Error('Backup output must be outside the project.');
  await fs.mkdir(backupDir, { recursive: true, mode: 0o700 });
  backupDir = await fs.realpath(backupDir);
  if (!outsideProject(projectDir, backupDir)) throw new Error('Backup output must be outside the project.');
  const projectName = path.basename(projectDir);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(backupDir, projectName + '_FULL_BACKUP_' + stamp + '.tar.gz.nikabk');
  const manifestFile = file + '.manifest.json';
  const excludes = [
    '*/node_modules',
    projectName + '/dist',
    projectName + '/backups',
    projectName + '/.wrangler',
    projectName + '/test-results',
    projectName + '/.playwright-cli',
    projectName + '/output',
  ];
  const tar =
    process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:/Windows', 'System32/tar.exe') : 'tar';
  const child = spawn(tar, ['-czf', '-', ...excludes.flatMap(item => ['--exclude', item]), '--', projectName], {
    cwd: path.dirname(projectDir),
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  // tar diagnostics can contain private filenames, so they never enter logs.
  child.stderr.resume();
  const completion = new Promise((resolve, reject) => {
    child.once('error', () => reject(new Error('Backup archive producer failed.')));
    child.once('close', code => (code === 0 ? resolve() : reject(new Error('Backup archive producer failed.'))));
  });
  completion.catch(() => {});
  const deadline = setTimeout(() => child.kill(), 30 * 60 * 1000);
  try {
    const encrypted = await protectBackupStream({
      source: child.stdout,
      outputPath: file,
      type: 'tar',
      keyProvider,
      completion,
    });
    const verified = await verifyProjectBackup({ file, keyProvider });
    if (!verified.entries || !encrypted.plaintextBytes) throw new Error('Backup archive contains no project entries.');
    const manifest = {
      version: 1,
      createdAt: new Date().toISOString(),
      file,
      format: 'gzip-compressed POSIX tar in AES-256-GCM envelope',
      sizeBytes: encrypted.size,
      plaintextBytes: encrypted.plaintextBytes,
      entries: verified.entries,
      keyId: encrypted.keyId,
      verification: 'authenticated envelope and tar directory read',
      included: [
        'source',
        'assets',
        '.git',
        'local configuration and secrets',
        'tools',
        'functions',
        'locales',
        'vendor weather bundle',
        'docs',
      ],
      excluded: [
        'node_modules at any depth',
        'root dist',
        'backups',
        '.wrangler',
        'test-results',
        '.playwright-cli',
        'output',
      ],
      recovery:
        'Requires the original Windows user DPAPI profile and the protected key file; archive alone is insufficient.',
    };
    await fs.writeFile(manifestFile, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    return { ...encrypted, entries: verified.entries, manifestFile };
  } catch (error) {
    child.kill();
    throw error;
  } finally {
    clearTimeout(deadline);
  }
}

async function main() {
  if (process.argv.length !== 2) throw new Error('Usage: node tools/create-full-backup.mjs');
  const result = await createFullBackup();
  console.log(
    JSON.stringify(
      {
        status: 'verified',
        file: result.file,
        manifestFile: result.manifestFile,
        sizeBytes: result.size,
        entries: result.entries,
        keyId: result.keyId,
      },
      null,
      2
    )
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
