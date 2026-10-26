import assert from 'node:assert/strict';
import test from 'node:test';
import { assessCodeScanning, readGitHubList } from './check-code-scanning.mjs';

const commit = 'a'.repeat(40),
  ref = 'refs/heads/main';
const analyses = ['CodeQL', 'Semgrep OSS'].map(name => ({ tool: { name }, commit_sha: commit, ref, error: '' }));

test('deployment requires both scanners for the exact commit and ref, with zero open findings', () => {
  const assess = input => assessCodeScanning({ analyses, alerts: [], commit, ref, ...input }).state;
  assert.equal(assess({}), 'ready');
  assert.equal(assess({ analyses: analyses.slice(0, 1) }), 'pending');
  assert.equal(assess({ commit: 'b'.repeat(40) }), 'pending');
  assert.equal(assess({ ref: 'refs/heads/other' }), 'pending');
  assert.equal(assess({ analyses: analyses.map(item => ({ ...item, error: 'analysis failed' })) }), 'blocked');
  assert.equal(assess({ alerts: [{ state: 'open', number: 1 }] }), 'blocked');
  assert.equal(assess({ alerts: [{ state: 'dismissed' }, { state: 'fixed' }] }), 'ready');
  assert.equal(assess({ alerts: [{}] }), 'blocked');
  assert.equal(assess({ analyses: null }), 'blocked');
  assert.equal(assess({ commit: undefined }), 'blocked');
  assert.equal(assess({ ref: undefined }), 'blocked');
});

test('pagination never forwards the GitHub credential to another origin', async () => {
  let calls = 0;
  await assert.rejects(
    readGitHubList('https://api.github.com/repos/owner/site/code-scanning/alerts', 'fixture', async () => {
      calls++;
      return new Response('[]', { headers: { Link: '<https://evil.invalid/page>; rel="next"' } });
    }),
    /outside GitHub/
  );
  assert.equal(calls, 1);
  let historyReads = 0;
  await readGitHubList(
    'https://api.github.com/repos/owner/site/code-scanning/analyses',
    'fixture',
    async () => {
      historyReads++;
      return new Response('[]', { headers: { Link: '<https://api.github.com/older>; rel="next"' } });
    },
    { firstPageOnly: true }
  );
  assert.equal(historyReads, 1);
  await assert.rejects(
    readGitHubList(
      'https://api.github.com/repos/owner/site/code-scanning/alerts',
      'fixture',
      async () => new Response('{}')
    ),
    /invalid list/
  );
  await assert.rejects(
    readGitHubList(
      'https://api.github.com/repos/owner/site/code-scanning/alerts',
      'fixture',
      async () => new Response('{}', { status: 403 })
    ),
    /HTTP 403/
  );
});
