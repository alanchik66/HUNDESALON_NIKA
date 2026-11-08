import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { validateReleaseManifest, verifyProductionArtifact, verifyProductionRelease, resolveWeatherReleaseAssets } from './production-release-verification.mjs';

const REPOSITORY = 'alanchik66/HUNDESALON_NIKA';
const runUrl = id => `https://github.com/${REPOSITORY}/actions/runs/${id}`;

function runCommand(command, args, options) {
  return spawnSync(command, args, { ...options, encoding: 'utf8', windowsHide: true, shell: false });
}

function receiptDirectory(root, commit, run) {
  const directory = path.join(root, 'output', 'release-receipts');
  mkdirSync(directory, { recursive: true });
  return mkdtempSync(path.join(directory, `${commit}-${run.databaseId}-${run.attempt}-`));
}

function validateRun(run, { commit, id, attempt }) {
  if (run?.databaseId !== id || run.headSha !== commit || run.url !== runUrl(id) ||
      run.event !== 'push' || run.headBranch !== 'main' || run.status !== 'completed' ||
      run.conclusion !== 'success' || !Number.isSafeInteger(run.attempt) || run.attempt < 1 ||
      (attempt !== undefined && run.attempt !== attempt) ||
      !Array.isArray(run.jobs) || !run.jobs.some(job => /Build and deploy/u.test(job.name) && job.conclusion === 'success')) {
    throw new Error('The expected production deployment run/attempt did not succeed.');
  }
  return run;
}

export async function watchProductionRelease({
  commit, root, run = runCommand, pause = sleep, createReceiptDirectory = receiptDirectory,
  verifyArtifact = verifyProductionArtifact, verifyPublished = verifyProductionRelease, log = console.log,
  resolveAssets = resolveWeatherReleaseAssets,
}) {
  if (!/^[a-f0-9]{40}$/u.test(commit || '')) throw new Error('Pass the full reviewed commit SHA.');
  const gh = (args, { json = false, inherit = false } = {}) => {
    const result = run('gh', [...args, '--repo', REPOSITORY], { cwd: root, stdio: inherit ? 'inherit' : 'pipe' });
    if (result?.error || result?.status !== 0) throw new Error(result?.error?.message || result?.stderr?.trim() || 'GitHub release command failed.');
    return json ? JSON.parse(result.stdout) : undefined;
  };

  let selected;
  for (let attempt = 0; attempt < 20; attempt++) {
    const runs = gh(['run', 'list', '--workflow', 'ci.yml', '--branch', 'main', '--event', 'push', '--commit', commit,
      '--limit', '5', '--json', 'databaseId,headSha,url'], { json: true });
    if (!Array.isArray(runs)) throw new Error('Invalid GitHub workflow list.');
    selected = runs.find(item => item.headSha === commit && Number.isSafeInteger(item.databaseId) && item.databaseId > 0);
    if (selected) break;
    await pause(3000);
  }
  if (!selected || selected.url !== runUrl(selected.databaseId)) throw new Error('No matching push workflow; inspect GitHub before a manual deployment.');
  log(`Production workflow: ${selected.url}`);
  gh(['run', 'watch', String(selected.databaseId), '--exit-status', '--interval', '10'], { inherit: true });
  const inspectRun = () => gh(['run', 'view', String(selected.databaseId), '--json',
    'attempt,databaseId,event,headBranch,headSha,status,conclusion,jobs,url'], { json: true });
  const completed = validateRun(inspectRun(), { commit, id: selected.databaseId });
  const artifact = `production-dist-${commit}-${completed.attempt}`;
  const directory = createReceiptDirectory(root, commit, completed);
  gh(['run', 'download', String(completed.databaseId), '--name', artifact, '--dir', directory]);
  validateRun(inspectRun(), { commit, id: completed.databaseId, attempt: completed.attempt });

  const receipt = path.join(directory, 'config', 'release-manifest.json');
  const requiredAssets = resolveAssets(root, directory);
  const manifest = validateReleaseManifest(JSON.parse(readFileSync(receipt, 'utf8')), { commit, requiredAssets });
  verifyArtifact({ directory, manifest, commit, stamp: manifest.stamp, requiredAssets });
  log(`Exact CI receipt: ${receipt}`);
  // No baseUrl override: release completion always checks the canonical company domain.
  const verification = await verifyPublished({ commit, manifest, requiredAssets });
  return { ...verification, verificationScope: 'canonical-domain', canonicalDomainVerified: true,
    run: completed.url, runAttempt: completed.attempt, artifact, receipt };
}
