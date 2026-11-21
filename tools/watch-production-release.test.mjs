import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { watchProductionRelease } from './lib/production-release-watch.mjs';
import { prepareProductionRelease, PRODUCTION_ORIGIN, RELEASE_LOCALES, verifyProductionRelease } from './lib/production-release-verification.mjs';

const COMMIT = 'a'.repeat(40);
const STAMP = '20261104-prod-aaaaaaa-1234abcd';
const ID = 123456;
const RUN_URL = `https://github.com/alanchik66/HUNDESALON_NIKA/actions/runs/${ID}`;
const API_RUN = `repos/alanchik66/HUNDESALON_NIKA/actions/runs/${ID}`;
const DIGEST = `sha256:${'b'.repeat(64)}`;

function fixture(t, {
  patchRun, downloadFailure = false, alterArtifact, canonicalStatus, differentReceipt = false,
  reusedBuild = false, changeArtifacts, patchOriginalAttempt, patchOriginalBuild,
} = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'nika-release-watch-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, 'reviewed');
  for (const name of ['config', 'assets/css', 'assets/js', ...RELEASE_LOCALES]) mkdirSync(path.join(source, name), { recursive: true });
  writeFileSync(path.join(source, 'config/deploy-asset-version.txt'), STAMP);
  writeFileSync(path.join(source, 'assets/css/app.css'), 'body{color:white}');
  writeFileSync(path.join(source, 'assets/js/app.js'), 'console.log("reviewed");');
  for (const locale of RELEASE_LOCALES) writeFileSync(path.join(source, locale, 'index.html'),
    `<html lang="${locale}"><link rel="canonical" href="${PRODUCTION_ORIGIN}/${locale}/"><link rel="icon" href="/favicon.ico">` +
    `<link rel="stylesheet" href="/assets/css/app.css?v=${STAMP}"><script src="/assets/js/app.js?v=${STAMP}"></script></html>`);
  const manifest = prepareProductionRelease({ directory: source, commit: COMMIT });
  const calls = [];
  const requests = [];
  const logs = [];
  let views = 0;
  const day = reusedBuild ? '04' : '05';
  const iso = (hour, date = day) => `2026-11-${date}T${hour}Z`;
  const build = {
    name: 'Validate and build', status: 'completed', conclusion: 'success',
    startedAt: iso('12:00:00'), completedAt: iso('12:10:00'),
    steps: [{ name: 'Preserve the exact tested production bundle', status: 'completed', conclusion: 'success',
      startedAt: iso('12:09:00'), completedAt: iso('12:09:30') }],
  };
  const completed = { databaseId: ID, headSha: COMMIT, url: RUN_URL, attempt: 2, event: 'push', headBranch: 'main',
    startedAt: iso('11:59:00', '05'), status: 'completed', conclusion: 'success',
    jobs: [build, { name: 'Build and deploy (Pages host; canonical watcher pending)', conclusion: 'success' }] };
  const originalAttempt = {
    id: ID, run_attempt: 1, head_sha: COMMIT, head_branch: 'main', event: 'push', status: 'completed',
    run_started_at: iso('11:59:00', '04'), ...patchOriginalAttempt,
  };
  const originalBuild = {
    name: build.name, run_id: ID, head_sha: COMMIT, run_attempt: 1, status: build.status, conclusion: build.conclusion,
    started_at: build.startedAt, completed_at: build.completedAt,
    steps: build.steps.map(({ startedAt, completedAt, ...step }) => ({ ...step, started_at: startedAt, completed_at: completedAt })),
    ...patchOriginalBuild,
  };
  const artifactName = `production-dist-${COMMIT}-${reusedBuild ? 1 : 2}`;
  const artifact = { name: artifactName, id: 315, digest: DIGEST, expired: false, created_at: iso('12:09:15'),
    workflow_run: { id: ID, head_sha: COMMIT, head_branch: 'main' } };
  const artifacts = changeArtifacts ? changeArtifacts(artifact) : [artifact];
  const run = (command, args) => {
    assert.equal(command, 'gh');
    calls.push(args);
    let result;
    if (args[0] === 'api') {
      if (args[1] === `${API_RUN}/artifacts?per_page=100`) result = { total_count: artifacts.length, artifacts };
      else if (args[1] === `${API_RUN}/attempts/1`) result = originalAttempt;
      else if (args[1] === `${API_RUN}/attempts/1/jobs?per_page=100`) result = { total_count: 1, jobs: [originalBuild] };
      else assert.fail(`Unexpected API endpoint: ${args[1]}`);
      return { status: 0, stdout: JSON.stringify(result) };
    }
    assert.deepEqual(args.slice(-2), ['--repo', 'alanchik66/HUNDESALON_NIKA']);
    switch (args[1]) {
      case 'list': result = [{ databaseId: ID, headSha: COMMIT, url: RUN_URL }]; break;
      case 'watch': break;
      case 'view': result = { ...completed, ...patchRun?.(++views) }; break;
      case 'download': {
        if (downloadFailure) return { status: 1, stderr: 'Exact artifact unavailable' };
        assert.equal(args[args.indexOf('--name') + 1], artifactName);
        const destination = args[args.indexOf('--dir') + 1];
        assert.ok(destination.startsWith(path.join(root, 'output', 'release-receipts', `${COMMIT}-${ID}-2-`)));
        cpSync(source, destination, { recursive: true });
        alterArtifact?.(destination);
        break;
      }
      default: assert.fail(`Unexpected gh operation: ${args[1]}`);
    }
    return { status: 0, stdout: result === undefined ? '' : JSON.stringify(result) };
  };
  const verifyPublished = options => {
    assert.deepEqual(Object.keys(options).sort(), ['commit', 'manifest', 'requiredAssets']);
    assert.deepEqual(options.requiredAssets, []);
    assert.equal(options.commit, COMMIT);
    assert.deepEqual(options.manifest, manifest);
    return verifyProductionRelease({ ...options, attempts: 1, fetcher: async input => {
      const url = new URL(input);
      requests.push(url.href);
      assert.equal(url.origin, PRODUCTION_ORIGIN);
      if (canonicalStatus) return new Response('Unavailable', { status: canonicalStatus, headers: { 'Content-Type': 'text/html' } });
      if (url.pathname === '/config/release-manifest.json') {
        const served = structuredClone(manifest);
        if (differentReceipt) served.assets[0].sha256 = 'f'.repeat(64);
        return Response.json(served);
      }
      if (url.pathname === '/config/deploy-asset-version.txt') return new Response(STAMP);
      if (url.pathname === '/') return new Response(null, { status: 302, headers: { Location: '/de/' } });
      const file = url.pathname.endsWith('/') ? `${url.pathname}index.html` : url.pathname;
      const type = file.endsWith('.html') ? 'text/html' : file.endsWith('.css') ? 'text/css' : 'application/javascript';
      return new Response(readFileSync(path.join(source, file)), { headers: { 'Content-Type': type } });
    } });
  };
  return { options: { root, commit: COMMIT, run, verifyPublished,
    resolveAssets: (projectRoot, runtimeRoot) => { assert.equal(projectRoot, root); assert.ok(runtimeRoot.startsWith(path.join(root, 'output', 'release-receipts'))); return []; },
    log: value => logs.push(value) }, calls, requests, logs, manifest };
}

test('the exact successful run artifact is locally verified before canonical completion', async t => {
  const f = fixture(t);
  const result = await watchProductionRelease(f.options);
  assert.equal(result.canonicalDomainVerified, true);
  assert.equal(result.verificationScope, 'canonical-domain');
  assert.equal(result.baseUrl, PRODUCTION_ORIGIN);
  assert.equal(result.verified, true);
  assert.equal(result.run, RUN_URL);
  assert.equal(result.runAttempt, 2);
  assert.equal(result.artifactAttempt, 2);
  assert.equal(result.artifactId, 315);
  assert.equal(result.artifactDigest, DIGEST);
  assert.equal(result.assets, 2);
  assert.deepEqual(JSON.parse(readFileSync(result.receipt, 'utf8')), f.manifest);
  assert.ok(f.logs.some(line => line.includes(result.receipt)));
  assert.ok(f.logs.some(line => line.includes(RUN_URL)));
  assert.deepEqual(f.calls.map(args => args[0] === 'api' ? 'api' : args[1]), ['list', 'watch', 'view', 'api', 'download', 'view']);
});

test('a deploy-only rerun uses the exact artifact of its proven reused build', async t => {
  const f = fixture(t, { reusedBuild: true });
  const result = await watchProductionRelease(f.options);
  assert.equal(result.runAttempt, 2);
  assert.equal(result.artifactAttempt, 1);
  assert.equal(result.artifact, `production-dist-${COMMIT}-1`);
  assert.deepEqual(f.calls.filter(args => args[0] === 'api').map(args => args[1]), [
    `${API_RUN}/artifacts?per_page=100`, `${API_RUN}/attempts/1`, `${API_RUN}/attempts/1/jobs?per_page=100`,
  ]);
  assert.equal(result.canonicalDomainVerified, true);
});

test('a rebuilt current attempt cannot silently use an older artifact', async t => {
  const f = fixture(t, { changeArtifacts: artifact => [{ ...artifact, name: `production-dist-${COMMIT}-1` }] });
  await assert.rejects(watchProductionRelease(f.options), /exact artifact.*unavailable/i);
  assert.ok(!f.calls.some(args => args[1] === 'download'));
  assert.equal(f.requests.length, 0);
});

test('an earlier artifact needs the same run, build and successful upload window', async t => {
  const cases = [
    { changeArtifacts: artifact => [{ ...artifact, expired: true }] },
    { changeArtifacts: artifact => [{ ...artifact, digest: null }] },
    { changeArtifacts: artifact => [{ ...artifact, workflow_run: { ...artifact.workflow_run, id: ID + 1 } }] },
    { changeArtifacts: artifact => [{ ...artifact, created_at: '2026-11-04T12:08:59Z' }] },
    { changeArtifacts: artifact => [artifact, { ...artifact, id: 316 }] },
    { patchOriginalAttempt: { head_sha: 'b'.repeat(40) } },
    { patchOriginalBuild: { completed_at: '2026-11-04T12:10:01Z' } },
    { patchOriginalBuild: { run_attempt: 2 } },
  ];
  for (const patch of cases) {
    const f = fixture(t, { reusedBuild: true, ...patch });
    await assert.rejects(watchProductionRelease(f.options), /exact artifact|original build/i);
    assert.ok(!f.calls.some(args => args[1] === 'download'));
    assert.equal(f.requests.length, 0);
  }
});

test('green CI followed by canonical HTTP 403 fails the full release', async t => {
  const f = fixture(t, { canonicalStatus: 403 });
  await assert.rejects(watchProductionRelease(f.options), /HTTP 403/u);
  assert.ok(f.calls.some(args => args[1] === 'download'));
  assert.equal(f.requests.length, 1);
  assert.ok(!f.logs.some(line => line.includes('canonicalDomainVerified')));
});

test('a different canonical receipt with the same full commit fails completion', async t => {
  const f = fixture(t, { differentReceipt: true });
  await assert.rejects(watchProductionRelease(f.options), /Published manifest differs from the validated artifact/u);
  assert.equal(f.requests.length, 1);
});

test('failed CI never downloads an artifact or checks the canonical site', async t => {
  const f = fixture(t, { patchRun: () => ({ conclusion: 'failure' }) });
  await assert.rejects(watchProductionRelease(f.options), /run\/attempt did not succeed/u);
  assert.ok(!f.calls.some(args => args[1] === 'download'));
  assert.equal(f.requests.length, 0);
});

test('mismatched run identities and a changed attempt fail before canonical verification', async t => {
  for (const patch of [{ databaseId: ID + 1 }, { headSha: 'b'.repeat(40) }, { attempt: 0 },
    { event: 'workflow_dispatch' }, { headBranch: 'other' }, { url: `${RUN_URL}/unexpected` }]) {
    const f = fixture(t, { patchRun: () => patch });
    await assert.rejects(watchProductionRelease(f.options), /run\/attempt did not succeed/u);
    assert.ok(!f.calls.some(args => args[1] === 'download'));
    assert.equal(f.requests.length, 0);
  }
  const f = fixture(t, { patchRun: view => view === 2 ? { attempt: 3 } : {} });
  await assert.rejects(watchProductionRelease(f.options), /run\/attempt did not succeed/u);
  assert.ok(f.calls.some(args => args[1] === 'download'));
  assert.equal(f.requests.length, 0);
});

test('a missing exact artifact cannot fall back to another artifact or the public receipt', async t => {
  const f = fixture(t, { downloadFailure: true });
  await assert.rejects(watchProductionRelease(f.options), /Exact artifact unavailable/u);
  assert.equal(f.calls.filter(args => args[1] === 'download').length, 1);
  assert.equal(f.requests.length, 0);
});

test('changed artifact bytes fail before any canonical request', async t => {
  const f = fixture(t, { alterArtifact: directory => writeFileSync(path.join(directory, 'assets/js/app.js'), 'changed') });
  await assert.rejects(watchProductionRelease(f.options), /Artifact digest mismatch/u);
  assert.equal(f.requests.length, 0);
});

test('the watcher rejects missing generated vendor coverage before canonical requests', async t => {
  const f = fixture(t);
  f.options.resolveAssets = () => [`/3d-weather-codrops-main/dist-widget/vendor.mjs?v=${STAMP}`];
  await assert.rejects(watchProductionRelease(f.options), /missing required release asset/iu);
  assert.equal(f.requests.length, 0);
});
