#!/usr/bin/env node
/**
 * Bing Webmaster JSON URL Submission API. IndexNow remains the primary signal;
 * this tool verifies and uses the account-bound API credential when configured.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getBingApiKey, logBingApiNotConfigured } from './lib/bing-api.mjs';
import { SITE_URL } from './lib/bing-wmt.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultListPath = path.join(root, 'tools', 'bing-submit-urls.txt');
const defaultStatePath = path.join(root, '.bing-url-api-state.json');
const endpointBase = 'https://ssl.bing.com/webmaster/api.svc/json/SubmitUrlbatch';

export function classifyBingApiFailure(status, responseText = '') {
  let payload = null;
  try {
    payload = JSON.parse(responseText);
  } catch {
    // Bing sometimes returns plain text or HTML on gateway failures.
  }

  const errorCode = Number(payload?.ErrorCode ?? payload?.d?.ErrorCode);
  const remoteMessage = String(payload?.Message ?? payload?.d?.Message ?? responseText).trim();

  if (errorCode === 3 || /invalid\s*api\s*key|invalidapikey/i.test(remoteMessage)) {
    return {
      code: 'BING_INVALID_API_KEY',
      message:
        'Bing URL API rejected BING_WEBMASTER_API_KEY (InvalidApiKey). ' +
        'The credential is stale, revoked, or belongs to another Webmaster account. ' +
        'Use Settings -> API access or run: npm run bing:api:setup -- --generate',
    };
  }

  if (status === 401 || status === 403) {
    return {
      code: 'BING_API_UNAUTHORIZED',
      message: `Bing URL API authorization failed (HTTP ${status}). Verify the account and API credential.`,
    };
  }

  if (status === 429) {
    return {
      code: 'BING_API_RATE_LIMITED',
      message: 'Bing URL API rate limit reached (HTTP 429). Retry after the server-provided delay.',
    };
  }

  const quotaMatch = remoteMessage.match(/quota remaining for today:\s*(\d+)\s*,\s*submitted:\s*(\d+)/i);
  if (quotaMatch) {
    return {
      code: 'BING_API_DAILY_QUOTA_EXCEEDED',
      quotaRemaining: Number(quotaMatch[1]),
      submitted: Number(quotaMatch[2]),
      message:
        `Bing URL API daily quota would be exceeded: ${quotaMatch[1]} remaining, ` +
        `${quotaMatch[2]} submitted in this request.`,
    };
  }

  const safeRemote = remoteMessage.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '[REDACTED]').slice(0, 300);
  return {
    code: 'BING_API_REQUEST_FAILED',
    message: `Bing URL API request failed (HTTP ${status})${safeRemote ? `: ${safeRemote}` : '.'}`,
  };
}

export async function submitBingUrls({
  apiKey,
  siteUrl,
  urlList,
  batchSize = 500,
  fetchImpl = fetch,
  onBatch = () => {},
}) {
  if (!apiKey) throw new TypeError('apiKey is required');
  if (!siteUrl) throw new TypeError('siteUrl is required');
  if (!Array.isArray(urlList) || !urlList.length) throw new TypeError('urlList must not be empty');
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500) {
    throw new RangeError('batchSize must be an integer between 1 and 500');
  }

  const endpoint = `${endpointBase}?apikey=${encodeURIComponent(apiKey)}`;
  let submitted = 0;

  for (let offset = 0; offset < urlList.length; offset += batchSize) {
    const batch = urlList.slice(offset, offset + batchSize);
    let response;
    try {
      response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ siteUrl, urlList: batch }),
      });
    } catch (cause) {
      const error = new Error(`Bing URL API network request failed: ${cause.message}`, { cause });
      error.code = 'BING_API_NETWORK_ERROR';
      throw error;
    }

    const responseText = await response.text();
    if (!response.ok) {
      const failure = classifyBingApiFailure(response.status, responseText);
      const error = new Error(failure.message);
      error.code = failure.code;
      error.status = response.status;
      error.batch = offset / batchSize + 1;
      error.quotaRemaining = failure.quotaRemaining;
      error.submitted = failure.submitted;
      throw error;
    }

    submitted += batch.length;
    onBatch({
      batch: offset / batchSize + 1,
      count: batch.length,
      status: response.status,
      urls: batch,
    });
  }

  return { submitted, batches: Math.ceil(urlList.length / batchSize) };
}

export function filterBingSubmissionUrls(values, { siteUrl }) {
  const expectedHost = new URL(siteUrl).hostname.toLowerCase();
  const urls = [];
  const seen = new Set();
  const skipped = { invalid: 0, duplicate: 0, otherHost: 0, nonPage: 0 };

  for (const value of values) {
    let url;
    try {
      url = new URL(String(value || '').trim());
    } catch {
      skipped.invalid += 1;
      continue;
    }

    if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== expectedHost) {
      skipped.otherHost += 1;
      continue;
    }

    const leaf = url.pathname.split('/').filter(Boolean).at(-1) || '';
    if (leaf.includes('.')) {
      skipped.nonPage += 1;
      continue;
    }

    url.hash = '';
    const normalized = url.href;
    if (seen.has(normalized)) {
      skipped.duplicate += 1;
      continue;
    }
    seen.add(normalized);
    urls.push(normalized);
  }

  return { urls, skipped };
}

export function bingUrlListDigest(urlList) {
  return createHash('sha256').update(urlList.join('\n')).digest('hex');
}

export function planBingUrlSubmission({
  urlList,
  state,
  siteUrl,
  keyFingerprint,
  day,
  dailyLimit = 100,
  force = false,
}) {
  const sourceDigest = bingUrlListDigest(urlList);
  const sameSource =
    !force &&
    state?.version === 1 &&
    state.siteUrl === siteUrl &&
    state.keyFingerprint === keyFingerprint &&
    state.sourceDigest === sourceDigest;
  const nextOffset = sameSource ? Math.min(Number(state.nextOffset) || 0, urlList.length) : 0;
  const submittedToday = sameSource && state.day === day ? Number(state.submittedToday) || 0 : 0;
  const capacity = Math.max(0, dailyLimit - submittedToday);
  const selected = urlList.slice(nextOffset, nextOffset + capacity);

  return {
    sourceDigest,
    nextOffset,
    submittedToday,
    selected,
    complete: nextOffset >= urlList.length,
    deferred: Math.max(0, urlList.length - nextOffset - selected.length),
  };
}

function readState(statePath) {
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeState(statePath, state) {
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
}

function readUrlList(listPath, siteUrl) {
  if (!fs.existsSync(listPath)) {
    throw new Error(`Missing ${path.relative(root, listPath)}. Run npm run seo:indexnow first.`);
  }

  const values = fs
    .readFileSync(listPath, 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const filtered = filterBingSubmissionUrls(values, { siteUrl });
  if (!filtered.urls.length) throw new Error('No canonical HTML URLs remain after filtering.');
  return filtered;
}

async function main() {
  const apiKey = getBingApiKey();
  if (!apiKey) {
    logBingApiNotConfigured({ verbose: process.argv.includes('--verbose') });
    return;
  }

  const { urls: urlList, skipped } = readUrlList(defaultListPath, SITE_URL);
  console.log(
    `Bing URL API prepared ${urlList.length} canonical HTML URLs ` +
    `(skipped: ${skipped.otherHost} other-host, ${skipped.nonPage} non-page, ` +
    `${skipped.duplicate} duplicate, ${skipped.invalid} invalid).`
  );

  const keyFingerprint = createHash('sha256').update(apiKey).digest('hex').slice(0, 12);
  const day = new Date().toISOString().slice(0, 10);
  const dailyLimit = Number(process.env.BING_URL_API_DAILY_LIMIT || 100);
  const plan = planBingUrlSubmission({
    urlList,
    state: readState(defaultStatePath),
    siteUrl: SITE_URL,
    keyFingerprint,
    day,
    dailyLimit,
    force: process.argv.includes('--force'),
  });

  if (plan.complete) {
    console.log('Bing URL API: current canonical URL list was already submitted; duplicate call skipped.');
    return;
  }
  if (!plan.selected.length) {
    console.log(`Bing URL API: daily limit ${dailyLimit} reached; ${plan.deferred} URLs remain queued.`);
    return;
  }

  let submittedThisRun = 0;
  const persistProgress = ({ urls, status, quotaRemaining }) => {
    submittedThisRun += urls.length;
    writeState(defaultStatePath, {
      version: 1,
      siteUrl: SITE_URL,
      keyFingerprint,
      sourceDigest: plan.sourceDigest,
      nextOffset: plan.nextOffset + submittedThisRun,
      day,
      submittedToday: plan.submittedToday + submittedThisRun,
      lastStatus: status,
      lastQuotaRemaining: quotaRemaining,
      lastSuccessAt: new Date().toISOString(),
    });
  };

  const submit = selected => submitBingUrls({
    apiKey,
    siteUrl: SITE_URL,
    urlList: selected,
    onBatch: ({ batch, count, status, urls }) => {
      persistProgress({ urls, status });
      console.log(`Bing URL API accepted ${count} URLs (batch ${batch}). HTTP ${status}`);
    },
  });

  try {
    await submit(plan.selected);
  } catch (error) {
    if (error.code !== 'BING_API_DAILY_QUOTA_EXCEEDED') throw error;
    const remaining = Math.max(0, Number(error.quotaRemaining) || 0);
    if (!remaining) {
      writeState(defaultStatePath, {
        version: 1,
        siteUrl: SITE_URL,
        keyFingerprint,
        sourceDigest: plan.sourceDigest,
        nextOffset: plan.nextOffset,
        day,
        submittedToday: dailyLimit,
        lastStatus: error.status,
        lastQuotaRemaining: 0,
        lastAttemptAt: new Date().toISOString(),
      });
      console.log(`Bing URL API: server quota exhausted; ${urlList.length - plan.nextOffset} URLs remain queued.`);
      return;
    }

    console.log(`Bing URL API: retrying ${remaining} URLs allowed by the server quota.`);
    await submit(plan.selected.slice(0, remaining));
  }

  const remaining = Math.max(0, urlList.length - plan.nextOffset - submittedThisRun);
  console.log(
    `Done. Submitted ${submittedThisRun} URLs to Bing Webmaster API` +
    `${remaining ? `; ${remaining} remain queued.` : '.'}`
  );
}

const isDirectRun = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isDirectRun) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
