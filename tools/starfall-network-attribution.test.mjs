import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import test from 'node:test';
import { attributeEntryNetworkErrors } from './lib/starfall-network-attribution.mjs';

const url = 'https://api.sunrise-sunset.org/json?lat=51.32&lng=12.41&date=2026-11-21&formatted=0&tzid=Europe%2FBerlin';
const documentUrl = 'http://127.0.0.1:12345/ru/';
const stack = 'fetchHeaderWeatherAstroDay@http://127.0.0.1:12345/assets/js/site-shell.js:7449:35';
function fixture() {
  return {
    entry: { errors: [`${url} due to access control checks.`], rawPageErrors: [{ name: 'Fetch API cannot load https', message: `${url} due to access control checks.`, stack, at: 1000 }] },
    network: { engine: 'webkit', requests: [], nativeEvents: [{ kind: 'fetch-call', url, documentUrl, stack, wall: 980 }] },
  };
}

test('known caught clock reporter is qualified narrowly and raw evidence remains intact', () => {
  const { entry, network } = fixture();
  const originalRaw = structuredClone(entry.rawPageErrors);
  attributeEntryNetworkErrors(entry, network);
  assert.equal(entry.unclassifiedErrors.length, 0);
  assert.deepEqual(entry.rawPageErrors, originalRaw);
  assert.equal(entry.errors.length, 1);
  assert.equal(entry.pageErrorAttribution.handledNetwork[0].networkObservation, 'pre-network/no-event');
  assert.equal(entry.pageErrorAttribution.handledNetwork[0].cause, 'UNATTRIBUTED');
});

test('the exact same-origin current-clock endpoint has the same narrow qualification', () => {
  const { entry, network } = fixture();
  const current = `${new URL(documentUrl).origin}/api/weather?latitude=51.32&longitude=12.41&timezone=auto&lang=ru`;
  network.nativeEvents[0].url = current;
  entry.rawPageErrors[0].message = `${current} due to access control checks.`;
  attributeEntryNetworkErrors(entry, network);
  assert.equal(entry.unclassifiedErrors.length, 0);
  assert.match(entry.pageErrorAttribution.handledNetwork[0].consumer, /try\/catch/);
});

for (const [name, change] of [
  ['late initiation', value => { value.network.nativeEvents[0].wall = 899; }],
  ['missing raw stack', value => { value.entry.rawPageErrors[0].stack = ''; }],
  ['unrelated raw owner', value => { value.entry.rawPageErrors[0].stack = 'at unrelated.js:1'; }],
  ['unrelated initiation owner', value => { value.network.nativeEvents[0].stack = 'at unrelated.js:1'; }],
  ['unknown URL', value => { value.network.nativeEvents[0].url = url.replace('api.sunrise-sunset.org', 'example.com'); }],
  ['changed query', value => { value.network.nativeEvents[0].url += '&unexpected=1'; }],
  ['native ErrorEvent', value => { value.network.nativeEvents.push({ kind: 'error', documentUrl, message: 'actual exception' }); }],
  ['native unhandled rejection', value => { value.network.nativeEvents.push({ kind: 'unhandledrejection', documentUrl, message: 'actual rejection' }); }],
  ['late native failure in another document', value => { value.network.nativeEvents.push({ kind: 'error', documentUrl: `${documentUrl}other`, message: 'late actual exception' }); }],
  ['other engine', value => { value.network.engine = 'chromium'; }],
]) test(`${name} remains a failure`, () => {
  const value = fixture();
  change(value);
  attributeEntryNetworkErrors(value.entry, value.network);
  assert.ok(value.entry.unclassifiedErrors.length > 0);
});

test('existing captured WebKit entries are reviewed deterministically without rewriting raw browser evidence', t => {
  const source = new URL('../output/playwright/starfall/entries-webkit/results.json', import.meta.url);
  if (!existsSync(source)) return t.skip('local browser receipt is not part of a fresh checkout');
  const receipt = JSON.parse(readFileSync(source, 'utf8'));
  const raw = receipt.browsers.flatMap(browser => browser.cases.map(entry => JSON.stringify(entry.rawPageErrors || [])));
  for (const browser of receipt.browsers) {
    for (const entry of browser.cases) attributeEntryNetworkErrors(entry, entry.network);
    browser.originalStatus = browser.status;
    browser.status = browser.cases.every(entry => entry.status === 'passed' && entry.unclassifiedErrors.length === 0) && browser.errors.length === 0 ? 'passed' : 'failed';
  }
  assert.deepEqual(receipt.browsers.flatMap(browser => browser.cases.map(entry => JSON.stringify(entry.rawPageErrors || []))), raw);
  receipt.classificationReview = { source: source.pathname, sourceGeneratedAt: receipt.generatedAt, reviewedAt: new Date().toISOString(),
    scope: 'Deterministic replay of existing browser evidence with negative-tested narrow qualification. No browser rerun and no changed raw records.',
    summary: receipt.browsers.map(browser => ({ engine: browser.engine, status: browser.status, cases: browser.cases.map(entry => ({
      scenario: entry.scenario, rawPageErrors: entry.rawPageErrors?.length || 0,
      qualifiedKnownNetwork: entry.pageErrorAttribution.handledNetwork.length,
      preNetworkNoEvent: entry.pageErrorAttribution.handledNetwork.filter(error => error.networkObservation === 'pre-network/no-event').length,
      unknown: entry.pageErrorAttribution.unknown.length, nativeErrorEvents: entry.pageErrorAttribution.nativeErrorEvents,
      nativeUnhandledRejections: entry.pageErrorAttribution.nativeUnhandledRejections,
    })) })) };
  writeFileSync(new URL('./attribution-review.json', source), JSON.stringify(receipt, null, 2));
  assert.equal(receipt.browsers.every(browser => browser.status === 'passed'), true);
});
