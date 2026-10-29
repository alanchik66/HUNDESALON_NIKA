/** Wait for the pushed revision's CI deployment and verify its public asset stamp. */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const commit = process.argv[2];
if (!/^[a-f0-9]{40}$/.test(commit || '')) throw new Error('Pass the full reviewed commit SHA.');
const repo = 'alanchik66/HUNDESALON_NIKA';
function gh(args, inherit = false) {
  const result = spawnSync('gh', [...args, '--repo', repo], {
    cwd: root,
    encoding: 'utf8',
    stdio: inherit ? 'inherit' : 'pipe',
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    throw new Error(result.error?.message || result.stderr?.trim() || 'GitHub workflow did not succeed.');
  }
  return inherit ? null : JSON.parse(result.stdout);
}

let run;
for (let attempt = 0; attempt < 20; attempt++) {
  const runs = gh([
    'run',
    'list',
    '--workflow',
    'ci.yml',
    '--branch',
    'main',
    '--event',
    'push',
    '--commit',
    commit,
    '--limit',
    '5',
    '--json',
    'databaseId,headSha,url',
  ]);
  run = runs.find(item => item.headSha === commit && Number.isSafeInteger(item.databaseId));
  if (run) break;
  await setTimeout(3000);
}
if (!run) throw new Error('No push workflow for this commit; inspect GitHub before a manual deployment.');
console.log(`Production workflow: ${run.url}`);
gh(['run', 'watch', String(run.databaseId), '--exit-status', '--interval', '10'], true);
const completed = gh(['run', 'view', String(run.databaseId), '--json', 'headSha,conclusion,jobs']);
if (
  completed.headSha !== commit ||
  completed.conclusion !== 'success' ||
  !completed.jobs.some(job => /Build and deploy/.test(job.name) && job.conclusion === 'success')
) {
  throw new Error('The expected production deployment job did not succeed.');
}
const response = await fetch(`https://hundesalon-nika.com/config/deploy-asset-version.txt?commit=${commit}`, {
  cache: 'no-store',
  signal: AbortSignal.timeout(20000),
});
const stamp = (await response.text()).trim();
const stampCommit = stamp.match(/^\d{8}-prod-([a-f0-9]{7,40})-[a-f0-9]{8}$/)?.[1];
if (!response.ok || !stampCommit || !commit.startsWith(stampCommit)) {
  throw new Error('Production asset stamp does not match the pushed revision.');
}
console.log(JSON.stringify({ commit, run: run.url, stamp, verified: true }));
