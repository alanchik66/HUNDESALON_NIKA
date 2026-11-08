import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { prepareProductionRelease, resolveWeatherReleaseAssets, verifyProductionArtifact } from './production-release-verification.mjs';

const activeStatuses = ['queued', 'in_progress', 'waiting', 'pending', 'requested'];
const deploymentWorkflows = ['ci.yml', 'cloudflare-pages.yml'];

export function runManualReleaseCommand(command, args, options) {
  return spawnSync(command, args, { encoding: 'utf8', shell: false, windowsHide: true, ...options });
}

function checked(run, command, args, options, label) {
  const result = run(command, args, options);
  if (result?.error || result?.status !== 0) throw new Error(`${label} failed; manual deployment is blocked.`);
  return String(result.stdout || '').trim();
}

export function validateManualReleaseArgs(argv) {
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const [name, inline] = argument.split('=', 2);
    if (!['--branch', '--commit-dirty'].includes(name) || seen.has(name) || argument.split('=').length > 2) {
      throw new Error('Manual deploy accepts only --branch main and --commit-dirty=false.');
    }
    seen.add(name);
    const value = inline ?? argv[++index];
    if ((name === '--branch' && value !== 'main') || (name === '--commit-dirty' && value !== 'false')) {
      throw new Error('Manual deploy requires main and --commit-dirty=false; revision overrides are forbidden.');
    }
  }
}

function repositoryFromRemote(remote) {
  let repository;
  if (remote.startsWith('git@github.com:')) repository = remote.slice('git@github.com:'.length);
  else {
    let url;
    try { url = new URL(remote); } catch { throw new Error('A GitHub origin remote is required.'); }
    if (!['https:', 'ssh:'].includes(url.protocol) || url.hostname !== 'github.com' || url.port || url.search || url.hash) {
      throw new Error('A GitHub origin remote is required.');
    }
    repository = url.pathname.slice(1);
  }
  repository = repository.replace(/\.git$/u, '');
  if (!/^[\w-]+\/[\w.-]+$/u.test(repository) || /\/\.{1,2}$/u.test(repository)) throw new Error('Invalid origin repository.');
  return repository;
}

export function assertManualReleaseState({ root, run = runManualReleaseCommand, commit }) {
  const options = { cwd: root };
  const git = args => checked(run, 'git', args, options, 'Git preflight');
  if (git(['branch', '--show-current']) !== 'main') throw new Error('Manual deploy requires the main branch.');
  if (git(['status', '--porcelain=v1', '--untracked-files=all'])) throw new Error('Manual deploy requires a clean worktree.');
  const head = git(['rev-parse', 'HEAD']);
  if (!/^[a-f0-9]{40}$/u.test(head) || (commit && head !== commit)) throw new Error('The reviewed HEAD changed.');
  if (git(['rev-parse', 'refs/remotes/origin/main']) !== head) throw new Error('HEAD must equal origin/main; fetch and review divergence separately.');
  const repository = repositoryFromRemote(git(['remote', 'get-url', 'origin']));
  const gh = endpoint => checked(run, 'gh', ['api', '--method', 'GET', endpoint], options, 'Read-only GitHub preflight');
  let remoteHead;
  try { remoteHead = JSON.parse(gh(`repos/${repository}/commits/main`)).sha; } catch { throw new Error('Could not verify the live origin/main revision.'); }
  if (remoteHead !== head) throw new Error('Live origin/main differs from the reviewed HEAD.');
  for (const workflow of deploymentWorkflows) {
    for (const status of activeStatuses) {
      let runs;
      try { runs = JSON.parse(gh(`repos/${repository}/actions/workflows/${workflow}/runs?status=${status}&per_page=1`)).workflow_runs; }
      catch { throw new Error('Could not verify the absence of an active deployment workflow.'); }
      if (!Array.isArray(runs)) throw new Error('Invalid active-workflow response.');
      if (runs.length) throw new Error('An active CI or Pages workflow blocks manual deployment.');
    }
  }
  return { commit: head, repository };
}

export function prepareManualRelease({ root, argv = [], run = runManualReleaseCommand,
  prepareRelease = prepareProductionRelease, verifyArtifact = verifyProductionArtifact,
  resolveAssets = resolveWeatherReleaseAssets }) {
  validateManualReleaseArgs(argv);
  const state = assertManualReleaseState({ root, run });
  checked(run, process.execPath, [path.join(root, 'tools', 'run-npm-quiet.mjs'), 'run', 'qa:max'],
    { cwd: root, stdio: 'inherit' }, 'qa:max');
  checked(run, process.execPath, [path.join(root, 'tools', 'check-code-scanning.mjs')], {
    cwd: root, stdio: 'inherit', env: { ...process.env, GITHUB_SHA: state.commit,
      GITHUB_REF: 'refs/heads/main', GITHUB_REPOSITORY: state.repository },
  }, 'Current-revision security gate');
  const directory = path.join(root, 'dist');
  const requiredAssets = resolveAssets(root, directory);
  const manifest = prepareRelease({ directory, commit: state.commit, extraAssets: requiredAssets });
  verifyArtifact({ directory, manifest, commit: state.commit, stamp: manifest.stamp, requiredAssets });
  assertManualReleaseState({ root, run, commit: state.commit });
  return { ...state, directory, manifest, stamp: manifest.stamp, requiredAssets };
}
