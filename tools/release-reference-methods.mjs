/** Review upstream methods without installing or executing upstream code. */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const owner = 'haraldalder-vibemogger';
export const profile = 'https://github.com/' + owner;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, 'config', 'release-reference-methods.json');

export function validateReferenceManifest(manifest) {
  const errors = [];
  if (manifest?.schemaVersion !== 1 || manifest.profile !== profile) errors.push('Invalid reference profile/schema.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(manifest?.reviewedAt || '')) errors.push('A review date is required.');
  if (!Array.isArray(manifest?.repositories) || !manifest.repositories.length) return [...errors, 'No reviewed repositories.'];
  const seen = new Set();
  for (const repo of manifest.repositories) {
    if (!/^[A-Za-z0-9_.-]+$/.test(repo.name || '') || seen.has(repo.name)) errors.push('Invalid or duplicate repository name.');
    seen.add(repo.name);
    if (!/^[a-f0-9]{40}$/.test(repo.sha || '')) errors.push('Missing pinned SHA: ' + repo.name);
    if (!repo.source?.startsWith(profile + '/' + repo.name + '/blob/' + repo.sha + '/')) errors.push('Unpinned source: ' + repo.name);
    if (repo.status !== 'adapted' || !repo.method?.trim()) errors.push('Unreviewed method: ' + repo.name);
    if (!Array.isArray(repo.commands) || !Array.isArray(repo.exclusions) || !repo.exclusions.length) errors.push('Missing integration boundaries: ' + repo.name);
  }
  return errors;
}

export function compareReferenceCatalog(manifest, discovered) {
  const problems = validateReferenceManifest(manifest);
  if (problems.length) throw new Error(problems.join(' '));
  if (!Array.isArray(discovered)) throw new Error('Repository discovery is incomplete.');
  const reviewed = new Map(manifest.repositories.map(repo => [repo.name, repo]));
  const seen = new Set();
  const repositories = discovered.map(repo => {
    if (!/^[A-Za-z0-9_.-]+$/.test(repo.name || '') || !/^[a-f0-9]{40}$/.test(repo.sha || '') || seen.has(repo.name)) {
      throw new Error('Incomplete or duplicate discovered repository.');
    }
    seen.add(repo.name);
    const previous = reviewed.get(repo.name);
    return { ...repo, reviewedSha: previous?.sha || null, status: !previous ? 'new' : previous.sha === repo.sha ? 'reviewed' : 'changed' };
  });
  for (const previous of reviewed.values()) {
    if (!seen.has(previous.name)) repositories.push({ name: previous.name, sha: null, reviewedSha: previous.sha, status: 'missing' });
  }
  return { upToDate: repositories.every(repo => repo.status === 'reviewed'), repositories };
}

async function githubJson(url, fetchImpl) {
  const response = await fetchImpl(url, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'HUNDESALON-NIKA-release-reference-review' },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('GitHub discovery returned HTTP ' + response.status + '; required upstream review is incomplete.');
  return response.json();
}

export async function discoverReferences(manifest, { fetchImpl = fetch } = {}) {
  const errors = validateReferenceManifest(manifest);
  if (errors.length) throw new Error(errors.join(' '));
  const catalog = [];
  let complete = false;
  for (let page = 1; page <= 10; page += 1) {
    const data = await githubJson('https://api.github.com/users/' + owner + '/repos?type=owner&per_page=100&sort=full_name&page=' + page, fetchImpl);
    if (!Array.isArray(data)) throw new Error('Invalid GitHub repository catalog.');
    for (const repo of data) {
      if (repo.owner?.login !== owner || !/^[A-Za-z0-9_.-]+$/.test(repo.name || '') || !repo.default_branch) {
        throw new Error('Unexpected repository ownership or branch.');
      }
      catalog.push(repo);
    }
    if (data.length < 100) { complete = true; break; }
  }
  if (!complete) throw new Error('Repository pagination limit reached; discovery is incomplete.');
  const discovered = [];
  for (let offset = 0; offset < catalog.length; offset += 4) {
    const batch = await Promise.all(catalog.slice(offset, offset + 4).map(async repo => {
      const head = await githubJson('https://api.github.com/repos/' + owner + '/' + repo.name + '/commits/' + encodeURIComponent(repo.default_branch), fetchImpl);
      return { name: repo.name, sha: head.sha, branch: repo.default_branch, archived: Boolean(repo.archived) };
    }));
    discovered.push(...batch);
  }
  return compareReferenceCatalog(manifest, discovered);
}

async function main() {
  const mode = process.argv[2] || '--check';
  if (!['--check', '--discover'].includes(mode) || process.argv.length > 3) throw new Error('Usage: node tools/release-reference-methods.mjs [--check|--discover]');
  const bytes = readFileSync(manifestPath);
  const manifest = JSON.parse(bytes);
  const errors = validateReferenceManifest(manifest);
  if (errors.length) throw new Error(errors.join(' '));
  if (mode === '--check') {
    console.log('Reviewed release methods: ' + manifest.repositories.length + ' pinned repositories; no upstream code executed.');
    return;
  }
  const result = await discoverReferences(manifest);
  const report = {
    generatedAt: new Date().toISOString(), profile,
    manifestSha256: createHash('sha256').update(bytes).digest('hex'),
    ...result,
  };
  const output = path.join(root, 'output', 'release-references', 'latest.json');
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ upToDate: result.upToDate, repositories: result.repositories.map(({ name, status }) => ({ name, status })), report: path.relative(root, output) }));
  if (!result.upToDate) {
    console.error('New, changed or missing upstream repositories require review before updating the pinned manifest. No source files were changed.');
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
