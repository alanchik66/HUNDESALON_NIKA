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

function fixture(t, { patchRun, downloadFailure = false, alterArtifact, canonicalStatus, differentReceipt = false } = {}) {
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
  const completed = { databaseId: ID, headSha: COMMIT, url: RUN_URL, attempt: 2, event: 'push', headBranch: 'main',
    status: 'completed', conclusion: 'success', jobs: [{ name: 'Build and deploy (Pages host; canonical watcher pending)', conclusion: 'success' }] };
  const run = (command, args) => {
    assert.equal(command, 'gh');
    calls.push(args);
    assert.deepEqual(args.slice(-2), ['--repo', 'alanchik66/HUNDESALON_NIKA']);
    let result;
    switch (args[1]) {
      case 'list': result = [{ databaseId: ID, headSha: COMMIT, url: RUN_URL }]; break;
      case 'watch': break;
      case 'view': result = { ...completed, ...patchRun?.(++views) }; break;
      case 'download': {
        if (downloadFailure) return { status: 1, stderr: 'Exact artifact unavailable' };
        assert.equal(args[args.indexOf('--name') + 1], `production-dist-${COMMIT}-2`);
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
    assert.deepEqual(Object.keys(options).sort(), ['commit', 'manifest']);
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
  return { options: { root, commit: COMMIT, run, verifyPublished, log: value => logs.push(value) }, calls, requests, logs, manifest };
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
  assert.equal(result.assets, 2);
  assert.deepEqual(JSON.parse(readFileSync(result.receipt, 'utf8')), f.manifest);
  assert.ok(f.logs.some(line => line.includes(result.receipt)));
  assert.ok(f.logs.some(line => line.includes(RUN_URL)));
  assert.deepEqual(f.calls.map(args => args[1]), ['list', 'watch', 'view', 'download', 'view']);
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
