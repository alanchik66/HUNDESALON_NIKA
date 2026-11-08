import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { deployPages } from './deploy-pages.mjs';

const commit = 'a'.repeat(40);
const fixture = ({ branch = 'main', dirty = false, failure, activeAt = 0, changedAt = 0, stampMismatch = false,
  originHead = commit, remoteHead = commit, invalidRuns = false, publicMismatch = false, uploadFailure = false } = {}) => {
  const calls = [];
  let states = 0;
  let authenticated = 0;
  let uploaded = 0;
  let publishedChecks = 0;
  const dependencies = {
    run(command, args, options) {
      calls.push({ command, args, options });
      const key = args.join(' ');
      if (command === 'git') {
        if (key === 'branch --show-current') { states += 1; return { status: 0, stdout: branch }; }
        if (key.startsWith('status ')) return { status: 0, stdout: dirty ? ' M tracked.js' : '' };
        if (key === 'rev-parse HEAD') return { status: 0, stdout: changedAt && states >= changedAt ? 'b'.repeat(40) : commit };
        if (key === 'rev-parse refs/remotes/origin/main') return { status: 0, stdout: originHead };
        if (key === 'remote get-url origin') return { status: 0, stdout: 'https://github.com/example/site.git' };
      }
      if (command === 'gh') return { status: failure === 'github' ? 1 : 0,
        stdout: JSON.stringify(key.includes('/commits/main') ? { sha: remoteHead }
          : { workflow_runs: invalidRuns ? null : activeAt && states >= activeAt ? [{ id: 1 }] : [] }) };
      if (args[0].endsWith('run-npm-quiet.mjs')) return { status: failure === 'qa' ? 1 : 0 };
      if (args[0].endsWith('check-code-scanning.mjs')) {
        assert.equal(options.env.GITHUB_SHA, commit);
        assert.equal(options.env.GITHUB_REF, 'refs/heads/main');
        assert.equal(options.env.GITHUB_REPOSITORY, 'example/site');
        return { status: failure === 'security' ? 1 : 0 };
      }
      throw new Error('Unexpected fixture command.');
    },
    resolveAssets: (root, directory) => {
      assert.equal(directory, path.join(root, 'dist'), 'manual coverage must use the built artifact stamp');
      return ['/weather.mjs?v=reviewed'];
    },
    prepareRelease: ({ commit: expected, extraAssets }) => {
      assert.deepEqual(extraAssets, ['/weather.mjs?v=reviewed']);
      return { commit: expected, stamp: 'stamp' };
    },
    verifyArtifact: ({ requiredAssets }) => {
      assert.deepEqual(requiredAssets, ['/weather.mjs?v=reviewed']);
      if (stampMismatch) throw new Error('Artifact asset stamp mismatch.');
    },
    authenticate: async () => { authenticated += 1; return { token: '', mode: 'fixture' }; },
    upload: args => { uploaded += 1; calls.push({ upload: args }); return { status: uploadFailure ? 1 : 0 }; },
    verifyPublished: async ({ commit: expected, manifest, requiredAssets }) => {
      publishedChecks += 1;
      assert.equal(uploaded, 1);
      assert.equal(expected, commit);
      assert.equal(manifest.commit, commit);
      assert.deepEqual(requiredAssets, ['/weather.mjs?v=reviewed']);
      if (publicMismatch) throw new Error('Public release digest mismatch.');
    },
  };
  return { dependencies, calls, counts: () => ({ authenticated, uploaded }), publishedChecks: () => publishedChecks };
};

test('manual fallback gates the exact main revision before credentials and uploads a verified artifact', async () => {
  const f = fixture();
  assert.equal(await deployPages(['--branch', 'main', '--commit-dirty=false'], f.dependencies), 0);
  assert.deepEqual(f.counts(), { authenticated: 1, uploaded: 1 });
  assert.equal(f.publishedChecks(), 1);
  assert.ok(f.calls.some(call => call.args?.includes('qa:max')));
  assert.ok(f.calls.some(call => call.args?.[0]?.endsWith('check-code-scanning.mjs')));
  const args = f.calls.find(call => call.upload).upload;
  assert.deepEqual(args.slice(-5), ['--branch', 'main', '--commit-hash', commit, '--commit-dirty=false']);
  assert.ok(f.calls.filter(call => call.command === 'gh').every(call => call.args.includes('GET')));
});

test('manual upload is not reported successful until the expected public release passes verification', async () => {
  const mismatch = fixture({ publicMismatch: true });
  assert.equal(await deployPages([], mismatch.dependencies), 1);
  assert.deepEqual(mismatch.counts(), { authenticated: 1, uploaded: 1 });
  assert.equal(mismatch.publishedChecks(), 1);
  const failedUpload = fixture({ uploadFailure: true });
  assert.equal(await deployPages([], failedUpload.dependencies), 1);
  assert.equal(failedUpload.publishedChecks(), 0);
});

test('dirty trees, other branches, failed gates, stale artifacts and CI races block before credentials', async () => {
  for (const options of [{ dirty: true }, { branch: 'feature' }, { failure: 'qa' }, { failure: 'security' },
    { stampMismatch: true }, { activeAt: 1 }, { activeAt: 2 }, { changedAt: 2 }, { originHead: 'b'.repeat(40) },
    { remoteHead: 'b'.repeat(40) }, { failure: 'github' }, { invalidRuns: true }]) {
    const f = fixture(options);
    assert.equal(await deployPages([], f.dependencies), 1, JSON.stringify(options));
    assert.deepEqual(f.counts(), { authenticated: 0, uploaded: 0 });
  }
});

test('a revision or CI change during authentication cannot reach the upload', async () => {
  for (const options of [{ activeAt: 3 }, { changedAt: 3 }]) {
    const f = fixture(options);
    assert.equal(await deployPages([], f.dependencies), 1);
    assert.deepEqual(f.counts(), { authenticated: 1, uploaded: 0 });
  }
});

test('dirty and revision override arguments never reach a command or credential lookup', async () => {
  for (const args of [['--commit-dirty=true'], ['--branch', 'preview'], ['--commit-hash', commit],
    ['--project-name', 'other'], ['--branch=main=other'], ['--branch=main', '--branch=main']]) {
    const f = fixture();
    assert.equal(await deployPages(args, f.dependencies), 1);
    assert.equal(f.calls.length, 0);
    assert.deepEqual(f.counts(), { authenticated: 0, uploaded: 0 });
  }
});
