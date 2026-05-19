#!/usr/bin/env node
/**
 * Full project backup: single uncompressed POSIX tar archive.
 * Usage: node tools/create-full-backup.mjs
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const projectDir = path.resolve(import.meta.dirname, '..');
const parentDir = path.dirname(projectDir);
const projectName = path.basename(projectDir);
const backupDir = path.join(parentDir, 'backups');
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const archiveName = `${projectName}_FULL_BACKUP_${stamp}.tar`;
const archivePath = path.join(backupDir, archiveName);
const manifestPath = path.join(backupDir, `${projectName}_FULL_BACKUP_${stamp}.manifest.txt`);

const excludes = [
  `${projectName}/node_modules`,
  `${projectName}/dist`,
  `${projectName}/backups`,
  `${projectName}/.wrangler`,
  `${projectName}/test-results`,
  `${projectName}/.playwright-cli`,
];

fs.mkdirSync(backupDir, { recursive: true });

const excludeArgs = excludes.flatMap((item) => ['--exclude', item]);
const tarCmd = ['tar', '-cf', archivePath, ...excludeArgs, projectName];
execSync(tarCmd.join(' '), { cwd: parentDir, stdio: 'inherit' });

const listing = execSync(`tar -tf "${archivePath}"`, { encoding: 'utf8' });
const entryCount = listing.trim().split('\n').filter(Boolean).length;
const sizeBytes = fs.statSync(archivePath).size;

const manifest = [
  `Backup created: ${new Date().toISOString()}`,
  `Archive: ${archivePath}`,
  'Format: POSIX tar, uncompressed (plain tar, no gzip)',
  `Root folder in archive: ${projectName}/`,
  `Entries: ${entryCount}`,
  `Size bytes: ${sizeBytes}`,
  `Size MB: ${(sizeBytes / (1024 * 1024)).toFixed(2)}`,
  'Excluded (regenerable): node_modules, dist, backups, .wrangler, test-results, .playwright-cli',
  'Included: source, assets, .git, configs, tools, functions, locales, 3d-weather dist-widget, docs',
  '',
  'Verify: tar -tf "<archive>" | head',
].join('\n');

fs.writeFileSync(manifestPath, `${manifest}\n`, 'utf8');

console.log(`\nBackup OK: ${archivePath}`);
console.log(`Manifest: ${manifestPath}`);
console.log(`Size: ${(sizeBytes / (1024 * 1024)).toFixed(2)} MB, ${entryCount} entries`);
