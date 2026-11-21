import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { validateReleaseManifest, verifyProductionArtifact, verifyProductionRelease, resolveWeatherReleaseAssets } from './production-release-verification.mjs';

const REPOSITORY = 'alanchik66/HUNDESALON_NIKA';
const runUrl = id => `https://github.com/${REPOSITORY}/actions/runs/${id}`;
const BUILD_JOB = 'Validate and build';
const UPLOAD_STEP = 'Preserve the exact tested production bundle';

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

function buildUploadWindow(jobs) {
  const builds = jobs?.filter(job => job.name === BUILD_JOB);
  const build = builds?.length === 1 ? builds[0] : undefined;
  const uploads = Array.isArray(build?.steps) ? build.steps.filter(step => step.name === UPLOAD_STEP) : [];
  const upload = uploads.length === 1 ? uploads[0] : undefined;
  const successful = entry => entry?.status === 'completed' && entry.conclusion === 'success';
  if (!successful(build) || !successful(upload)) throw new Error('The exact build artifact upload did not succeed.');
  const times = [build.startedAt ?? build.started_at, upload.startedAt ?? upload.started_at,
    upload.completedAt ?? upload.completed_at, build.completedAt ?? build.completed_at].map(value => Date.parse(value));
  if (times.some((time, index) => !Number.isFinite(time) || (index > 0 && time < times[index - 1]))) {
    throw new Error('Invalid build artifact upload timestamps.');
  }
  return { build, times };
}

function selectArtifact(gh, completed, commit) {
  const runPath = `repos/${REPOSITORY}/actions/runs/${completed.databaseId}`;
  const { times } = buildUploadWindow(completed.jobs);
  const [buildStarted, uploadStarted, uploadCompleted] = times;
  const attemptStarted = Date.parse(completed.startedAt);
  if (!Number.isFinite(attemptStarted)) throw new Error('Invalid completed run attempt timestamp.');
  // GitHub includes reused jobs in a new attempt, but their execution times stay unchanged.
  const reusedBuild = buildStarted < attemptStarted;
  const prefix = `production-dist-${commit}-`;
  const listed = gh(['api', `${runPath}/artifacts?per_page=100`], { json: true });
  if (!Array.isArray(listed?.artifacts) || listed.total_count !== listed.artifacts.length) {
    throw new Error('The exact run artifact list could not be inspected completely.');
  }
  const matches = listed.artifacts.filter(artifact => {
    if (!artifact.name?.startsWith(prefix)) return false;
    const suffix = artifact.name.slice(prefix.length);
    const attempt = Number(suffix);
    if (!Number.isSafeInteger(attempt) || String(attempt) !== suffix || attempt < 1) return false;
    if (!reusedBuild) return attempt === completed.attempt;
    const created = Date.parse(artifact.created_at);
    return attempt < completed.attempt && created >= uploadStarted && created <= uploadCompleted;
  });
  const artifact = matches.length === 1 ? matches[0] : undefined;
  const created = Date.parse(artifact?.created_at);
  if (!artifact || !Number.isSafeInteger(artifact.id) || artifact.id < 1 || artifact.expired !== false ||
      artifact.workflow_run?.id !== completed.databaseId || artifact.workflow_run.head_sha !== commit ||
      artifact.workflow_run.head_branch !== 'main' || !/^sha256:[a-f0-9]{64}$/u.test(artifact.digest) ||
      !Number.isFinite(created) || created < uploadStarted || created > uploadCompleted) {
    throw new Error('The exact artifact from the successful build upload is unavailable.');
  }
  const artifactAttempt = Number(artifact.name.slice(prefix.length));
  if (reusedBuild) {
    const prior = gh(['api', `${runPath}/attempts/${artifactAttempt}`], { json: true });
    const jobs = gh(['api', `${runPath}/attempts/${artifactAttempt}/jobs?per_page=100`], { json: true });
    const priorStarted = Date.parse(prior?.run_started_at);
    if (prior?.id !== completed.databaseId || prior?.run_attempt !== artifactAttempt || prior.head_sha !== commit ||
        prior.head_branch !== 'main' || prior.event !== 'push' || prior.status !== 'completed' ||
        !Number.isFinite(priorStarted) || priorStarted > buildStarted ||
        !Array.isArray(jobs?.jobs) || jobs.total_count !== jobs.jobs.length) {
      throw new Error('The original build attempt could not be verified.');
    }
    const original = buildUploadWindow(jobs.jobs);
    if (original.build.run_id !== completed.databaseId || original.build.head_sha !== commit ||
        original.build.run_attempt !== artifactAttempt || original.times.some((time, index) => time !== times[index])) {
      throw new Error('The original build upload does not match the reused build.');
    }
  }
  return { name: artifact.name, id: artifact.id, digest: artifact.digest, attempt: artifactAttempt };
}

export async function watchProductionRelease({
  commit, root, run = runCommand, pause = sleep, createReceiptDirectory = receiptDirectory,
  verifyArtifact = verifyProductionArtifact, verifyPublished = verifyProductionRelease, log = console.log,
  resolveAssets = resolveWeatherReleaseAssets,
}) {
  if (!/^[a-f0-9]{40}$/u.test(commit || '')) throw new Error('Pass the full reviewed commit SHA.');
  const gh = (args, { json = false, inherit = false } = {}) => {
    const commandArgs = args[0] === 'api' ? args : [...args, '--repo', REPOSITORY];
    const result = run('gh', commandArgs, { cwd: root, stdio: inherit ? 'inherit' : 'pipe' });
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
    'attempt,databaseId,event,headBranch,headSha,status,conclusion,startedAt,jobs,url'], { json: true });
  const completed = validateRun(inspectRun(), { commit, id: selected.databaseId });
  const artifact = selectArtifact(gh, completed, commit);
  const directory = createReceiptDirectory(root, commit, completed);
  gh(['run', 'download', String(completed.databaseId), '--name', artifact.name, '--dir', directory]);
  validateRun(inspectRun(), { commit, id: completed.databaseId, attempt: completed.attempt });

  const receipt = path.join(directory, 'config', 'release-manifest.json');
  const requiredAssets = resolveAssets(root, directory);
  const manifest = validateReleaseManifest(JSON.parse(readFileSync(receipt, 'utf8')), { commit, requiredAssets });
  verifyArtifact({ directory, manifest, commit, stamp: manifest.stamp, requiredAssets });
  log(`Exact CI receipt: ${receipt}`);
  // No baseUrl override: release completion always checks the canonical company domain.
  const verification = await verifyPublished({ commit, manifest, requiredAssets });
  return { ...verification, verificationScope: 'canonical-domain', canonicalDomainVerified: true,
    run: completed.url, runAttempt: completed.attempt, artifact: artifact.name, artifactId: artifact.id,
    artifactAttempt: artifact.attempt, artifactDigest: artifact.digest, receipt };
}
