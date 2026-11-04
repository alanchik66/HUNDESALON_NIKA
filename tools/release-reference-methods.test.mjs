import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compareReferenceCatalog, discoverReferences, validateReferenceManifest } from './release-reference-methods.mjs';

const manifest = JSON.parse(readFileSync(new URL('../config/release-reference-methods.json', import.meta.url)));
const existing = manifest.repositories.map(({ name, sha }) => ({ name, sha }));
const response = (body, status = 200) => ({ ok: status === 200, status, json: async () => body });

test('the reviewed catalog is pinned without assuming a permanent repository count', () => {
  assert.deepEqual(validateReferenceManifest(manifest), []);
  assert.equal(compareReferenceCatalog(manifest, existing).upToDate, true);
  const extra = { ...manifest.repositories[0], name: 'another-reviewed-method', source: manifest.profile + '/another-reviewed-method/blob/' + manifest.repositories[0].sha + '/README.md' };
  const expanded = { ...manifest, repositories: [...manifest.repositories, extra] };
  assert.equal(compareReferenceCatalog(expanded, [...existing, { name: extra.name, sha: extra.sha }]).upToDate, true);
});

test('new, changed and removed repositories require review instead of silently becoming trusted', () => {
  const input = existing.slice(1).map(repo => ({ ...repo }));
  input[0].sha = '1'.repeat(40);
  input.push({ name: 'new-tool', sha: '2'.repeat(40) });
  const before = JSON.stringify(manifest);
  const result = compareReferenceCatalog(manifest, input);
  assert.equal(result.upToDate, false);
  assert.equal(result.repositories.find(repo => repo.name === existing[0].name).status, 'missing');
  assert.equal(result.repositories.find(repo => repo.name === input[0].name).status, 'changed');
  assert.equal(result.repositories.find(repo => repo.name === 'new-tool').status, 'new');
  assert.equal(JSON.stringify(manifest), before);
});

test('missing pins, wrong provenance and duplicate records fail the manifest check', () => {
  const copy = structuredClone(manifest);
  copy.repositories[0].sha = 'main';
  copy.repositories[0].source = 'https://example.com/README.md';
  copy.repositories.push(copy.repositories[1]);
  assert.ok(validateReferenceManifest(copy).length >= 3);
  assert.throws(() => compareReferenceCatalog(copy, existing));
  assert.throws(() => compareReferenceCatalog(manifest, [{ name: 'incomplete' }]), /Incomplete/);
});

test('discovery follows default branches and sends no credentials or executable upstream content', async () => {
  const calls = [];
  const result = await discoverReferences(manifest, {
    fetchImpl: async (url, options) => {
      calls.push(url);
      assert.equal(options.headers.Authorization, undefined);
      assert.ok(options.signal);
      if (url.includes('/users/')) return response(existing.map(repo => ({ ...repo, owner: { login: 'haraldalder-vibemogger' }, default_branch: 'release/main' })));
      assert.ok(url.endsWith('/commits/release%2Fmain'));
      const name = url.split('/')[5];
      return response({ sha: existing.find(repo => repo.name === name).sha });
    },
  });
  assert.equal(result.upToDate, true);
  assert.equal(calls.length, existing.length + 1);
});

test('network failure, wrong ownership and incomplete pagination cannot be reported as passing', async () => {
  await assert.rejects(discoverReferences(manifest, { fetchImpl: async () => response({}, 403) }), /incomplete/);
  await assert.rejects(discoverReferences(manifest, { fetchImpl: async () => response([{ name: 'x', owner: { login: 'other' }, default_branch: 'main' }]) }), /ownership/);
  let pages = 0;
  await assert.rejects(discoverReferences(manifest, {
    fetchImpl: async () => { pages += 1; return response(Array.from({ length: 100 }, (_, i) => ({ name: 'repo-' + i, owner: { login: 'haraldalder-vibemogger' }, default_branch: 'main' }))); },
  }), /pagination limit/);
  assert.equal(pages, 10);
});
