import assert from 'node:assert/strict';
import test from 'node:test';
import { extractBingApiKey } from './lib/bing-api-access.mjs';
import {
  classifyBingApiFailure,
  filterBingSubmissionUrls,
  planBingUrlSubmission,
  submitBingUrls,
} from './bing-url-submit.mjs';

test('classifies Bing ErrorCode 3 as an invalid API key', () => {
  const failure = classifyBingApiFailure(
    400,
    JSON.stringify({ ErrorCode: 3, Message: 'ERROR!!! InvalidApiKey' })
  );

  assert.equal(failure.code, 'BING_INVALID_API_KEY');
  assert.match(failure.message, /InvalidApiKey/);
});

test('accepts both current 32-hex and legacy UUID Bing key formats', () => {
  assert.equal(extractBingApiKey('a'.repeat(32)), 'a'.repeat(32));
  assert.equal(
    extractBingApiKey('00000000-0000-0000-0000-000000000000'),
    '00000000-0000-0000-0000-000000000000'
  );
});

test('submits no more than 500 URLs per batch', async () => {
  const requests = [];
  const urlList = Array.from({ length: 501 }, (_, index) => `https://example.com/page-${index + 1}`);

  const result = await submitBingUrls({
    apiKey: '00000000-0000-0000-0000-000000000000',
    siteUrl: 'https://example.com/',
    urlList,
    fetchImpl: async (_url, options) => {
      requests.push(JSON.parse(options.body));
      return { ok: true, status: 200, text: async () => '{"d":null}' };
    },
  });

  assert.equal(result.submitted, 501);
  assert.equal(result.batches, 2);
  assert.deepEqual(requests.map(request => request.urlList.length), [500, 1]);
});

test('keeps only canonical HTML pages for the verified property', () => {
  const filtered = filterBingSubmissionUrls(
    [
      'https://hundesalon-nika.com/de/',
      'https://hundesalon-nika.com/de/prays-list',
      'https://hundesalon-nika.com/de/prays-list',
      'https://www.hundesalon-nika.com/de/',
      'https://hundesalon-nika.com/assets/images/logo.png',
      'not-a-url',
    ],
    { siteUrl: 'https://hundesalon-nika.com/' }
  );

  assert.deepEqual(filtered.urls, [
    'https://hundesalon-nika.com/de/',
    'https://hundesalon-nika.com/de/prays-list',
  ]);
  assert.deepEqual(filtered.skipped, {
    invalid: 1,
    duplicate: 1,
    otherHost: 1,
    nonPage: 1,
  });
});

test('classifies the Bing daily quota response', () => {
  const failure = classifyBingApiFailure(
    400,
    'ERROR!!! Quota remaining for today: 100, Submitted: 218'
  );

  assert.equal(failure.code, 'BING_API_DAILY_QUOTA_EXCEEDED');
  assert.equal(failure.quotaRemaining, 100);
  assert.equal(failure.submitted, 218);
});

test('continues a URL queue across daily quota windows', () => {
  const urlList = Array.from({ length: 120 }, (_, index) => `https://example.com/page-${index + 1}`);
  const first = planBingUrlSubmission({
    urlList,
    state: null,
    siteUrl: 'https://example.com/',
    keyFingerprint: 'fingerprint',
    day: '2026-09-01',
    dailyLimit: 100,
  });
  assert.equal(first.selected.length, 100);
  assert.equal(first.deferred, 20);

  const second = planBingUrlSubmission({
    urlList,
    state: {
      version: 1,
      siteUrl: 'https://example.com/',
      keyFingerprint: 'fingerprint',
      sourceDigest: first.sourceDigest,
      nextOffset: 100,
      day: '2026-09-01',
      submittedToday: 100,
    },
    siteUrl: 'https://example.com/',
    keyFingerprint: 'fingerprint',
    day: '2026-09-02',
    dailyLimit: 100,
  });
  assert.equal(second.nextOffset, 100);
  assert.equal(second.selected.length, 20);
  assert.equal(second.deferred, 0);
});

test('throws an actionable error without leaking the credential', async () => {
  const apiKey = '11111111-1111-1111-1111-111111111111';

  await assert.rejects(
    submitBingUrls({
      apiKey,
      siteUrl: 'https://example.com/',
      urlList: ['https://example.com/'],
      fetchImpl: async () => ({
        ok: false,
        status: 400,
        text: async () => '{"ErrorCode":3,"Message":"InvalidApiKey"}',
      }),
    }),
    error => {
      assert.equal(error.code, 'BING_INVALID_API_KEY');
      assert.doesNotMatch(error.message, new RegExp(apiKey));
      return true;
    }
  );
});
