/** Read every Git source/asset fully and record coverage; never delete duplicates. */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'output', 'repository-audit', 'latest.json');
const hash = buffer => createHash('sha256').update(buffer).digest('hex');
function git(args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr.trim());
  return result.stdout;
}

const tracked = new Set(git(['ls-files', '-z']).split('\0').filter(Boolean));
const candidates = [
  ...new Set(git(['ls-files', '-co', '--exclude-standard', '-z']).split('\0').filter(Boolean)),
].sort();
const decoder = new TextDecoder('utf-8', { fatal: true });
const files = [];
const errors = [];
const duplicates = new Map();
for (const name of candidates) {
  const absolute = path.resolve(root, name);
  try {
    if (!absolute.startsWith(`${root}${path.sep}`)) throw new Error('Path escapes repository');
    const stat = lstatSync(absolute);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Expected a regular repository file');
    const bytes = readFileSync(absolute);
    const sha256 = hash(bytes);
    let lines = null;
    if (!bytes.includes(0)) {
      try {
        lines = decoder.decode(bytes).split('\n').length;
      } catch {
        /* Binary asset. */
      }
    }
    const category =
      /(?:^|\/)(?:dist-widget|vendor)\//.test(name) || /\.map$/.test(name)
        ? 'generated-or-vendor'
        : /^(?:tools|docs|knowledge|\.github)\//.test(name)
          ? 'development-or-documentation'
          : 'site';
    files.push({ path: name, tracked: tracked.has(name), bytes: bytes.length, sha256, lines, category });
    if (bytes.length) {
      const group = duplicates.get(sha256) || [];
      group.push(name);
      duplicates.set(sha256, group);
    }
  } catch (error) {
    errors.push({ path: name, message: error.message });
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  head: git(['rev-parse', 'HEAD']).trim(),
  scope: 'Tracked and non-ignored untracked files; dependencies, secrets and local caches stay outside Git scope.',
  coverage: 'Complete byte reads and UTF-8 line counts are automated coverage, not a claim of manual semantic review.',
  treeSha256: hash(Buffer.from(files.map(file => `${file.path}\0${file.sha256}\n`).join(''))),
  summary: {
    candidates: candidates.length,
    read: files.length,
    bytes: files.reduce((total, file) => total + file.bytes, 0),
    textFiles: files.filter(file => file.lines !== null).length,
    textLines: files.reduce((total, file) => total + (file.lines || 0), 0),
    unreadable: errors.length,
  },
  files,
  identicalFiles: [...duplicates.values()].filter(group => group.length > 1),
  errors,
};
mkdirSync(path.dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ ...report.summary, treeSha256: report.treeSha256, report: path.relative(root, output) }));
if (errors.length) {
  console.error(JSON.stringify(errors));
  process.exitCode = 1;
}
