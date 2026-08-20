/**
 * Periodic Bing Site Scan + Google Search Console watch.
 * One-shot (for Task Scheduler): npm run seo:watch
 * Long poll until Bing scan completes: npm run seo:watch:until-done
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { browserPidFile, launchTrackedBrowser, stopTrackedBrowser } from './lib/browser-launch.mjs';
import {
  analyzeBingFindings,
  extractBingSiteScanFindings,
  readBingSiteScanStatus,
} from './lib/bing-sitescan.mjs';
import { analyzeGscIndexing, readGscIndexing } from './lib/gsc-indexing.mjs';
import { sleep } from './lib/browser-cdp.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.BING_MAIL_EDGE_PORT || 9224);
const pollMs = Number(process.env.SEO_WATCH_POLL_MS || 30 * 60_000);
const maxWaitMs = Number(process.env.SEO_WATCH_MAX_WAIT_MS || 6 * 60 * 60_000);
const untilDone = process.argv.includes('--until-done');
const gscBrowser =
  process.argv.includes('--gsc-browser') || process.env.SEO_WATCH_GSC_BROWSER === '1';

const statePath = path.join(root, 'temp', 'seo-search-watch-state.json');
const reportPath = path.join(root, 'temp', 'seo-search-watch-report.json');
const pidFile = browserPidFile('hundesalon-nika-edge-debug');

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function acquireLock() {
  const lockPath = path.join(root, 'temp', 'seo-search-watch.lock');
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  if (fs.existsSync(lockPath)) {
    const age = Date.now() - fs.statSync(lockPath).mtimeMs;
    if (age < 20 * 60_000) return false;
    fs.unlinkSync(lockPath);
  }
  fs.writeFileSync(lockPath, `${process.pid}\n`);
  return true;
}

function releaseLock() {
  const lockPath = path.join(root, 'temp', 'seo-search-watch.lock');
  try {
    fs.unlinkSync(lockPath);
  } catch {
    /* ignore */
  }
}

async function cdpReady() {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(3000) });
    return response.ok;
  } catch {
    return false;
  }
}

function edgePath() {
  return [
    path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft/Edge/Application/msedge.exe'),
    path.join(process.env.ProgramFiles || '', 'Microsoft/Edge/Application/msedge.exe'),
  ].find(existsSync);
}

async function ensureCdp() {
  if (await cdpReady()) return true;
  const edge = edgePath();
  if (!edge) return false;

  const userDataDir = path.join(process.env.TEMP || '.', 'hundesalon-nika-edge-debug');
  stopTrackedBrowser(pidFile);
  launchTrackedBrowser(
    edge,
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      'https://www.bing.com/webmasters/sitescan?siteUrl=https%3A%2F%2Fhundesalon-nika.com%2F',
      'https://search.google.com/search-console?resource_id=sc-domain%3Ahundesalon-nika.com',
    ],
    pidFile
  );

  for (let i = 0; i < 40; i += 1) {
    if (await cdpReady()) {
      await sleep(5000);
      return true;
    }
    await sleep(500);
  }
  return false;
}

async function runGscLiveAudit() {
  return new Promise(resolve => {
    const child = spawn(process.execPath, ['tools/google-search-console-audit.js'], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    child.stdout.on('data', chunk => {
      stdout += chunk;
    });
    child.on('close', code => {
      const reportFile = path.join(root, 'tools', 'google-search-console-report.json');
      resolve({
        ok: code === 0,
        exitCode: code,
        report: readJson(reportFile, null),
        stdoutTail: stdout.slice(-1200),
      });
    });
  });
}

async function watchOnce(state) {
  const report = {
    at: new Date().toISOString(),
    bing: null,
    google: null,
    actions: [],
  };

  if (!(await ensureCdp())) {
    report.error = 'Edge CDP unavailable. Run: npm run bing:edge and sign in (mail.ru + gmail tabs).';
    return report;
  }

  report.bing = { status: await readBingSiteScanStatus({ port }) };

  if (report.bing.status.completed && !state.bingFindingsExtracted) {
    report.actions.push('extract_bing_findings');
    report.bing.findings = await extractBingSiteScanFindings({ port });
    report.bing.analysis = analyzeBingFindings(report.bing.findings);
    state.bingFindingsExtracted = true;
    state.bingCompletedAt = report.at;
  } else if (report.bing.status.completed && state.bingFindingsExtracted) {
    report.actions.push('bing_already_analyzed');
  } else if (report.bing.status.inProgress) {
    report.actions.push(`bing_${report.bing.status.status?.toLowerCase() || 'pending'}`);
  }

  report.google = {};

  if (gscBrowser) {
    try {
      report.google.browser = await readGscIndexing({ port, quick: true, waitMs: 5000 });
      report.google.analysis = analyzeGscIndexing(report.google.browser);
    } catch (error) {
      report.google.browserError = String(error.message);
    }
  } else {
    report.google.browserSkipped = 'Live audit only. For GSC UI: npm run seo:watch -- --gsc-browser';
  }

  report.google.liveAudit = await runGscLiveAudit();
  if (!report.google.analysis && report.google.liveAudit?.report) {
    const failures = report.google.liveAudit.report.failures || [];
    const warnings = report.google.liveAudit.report.warnings || [];
    report.google.analysis = {
      loginRequired: false,
      issueCount: failures.length + warnings.length,
      issues: [...failures, ...warnings].slice(0, 20).map(text => ({ source: 'live-audit', text })),
      recommendation:
        failures.length > 0
          ? 'Устранить ошибки live GSC audit (canonical, JSON-LD, robots, sitemap).'
          : 'Live GSC audit PASS — индексация и разметка в норме.',
    };
  }
  return report;
}

async function main() {
  if (!acquireLock()) {
    console.log('seo:watch already running — skip.');
    return;
  }

  try {
    await mainBody();
  } finally {
    releaseLock();
  }
}

async function mainBody() {
  const state = readJson(statePath, {
    createdAt: new Date().toISOString(),
    bingFindingsExtracted: false,
    checks: [],
  });

  const started = Date.now();
  let report = await watchOnce(state);

  while (
    untilDone &&
    report.bing?.status?.inProgress &&
    !report.bing?.status?.failed &&
    Date.now() - started < maxWaitMs
  ) {
    const elapsed = Math.round((Date.now() - started) / 60000);
    console.log(
      `Bing ${report.bing.status.status} (${report.bing.status.timeAgo || '—'}) — next check in ${pollMs / 60000}m (elapsed ${elapsed}m)…`
    );
    await sleep(pollMs);
    report = await watchOnce(state);
  }

  state.lastCheckAt = report.at;
  state.lastBingStatus = report.bing?.status?.status || null;
  state.lastGoogleIssueCount = report.google?.analysis?.issueCount ?? null;
  state.checks.push({
    at: report.at,
    bingStatus: state.lastBingStatus,
    bingCompleted: !!report.bing?.status?.completed,
    googleIssues: state.lastGoogleIssueCount,
  });
  state.checks = state.checks.slice(-50);

  writeJson(statePath, state);
  writeJson(reportPath, report);

  console.log(`Saved: ${path.relative(root, reportPath)}`);
  console.log(JSON.stringify(report, null, 2));

  if (report.bing?.status?.completed && report.bing?.analysis) {
    console.log('\n=== Bing findings summary ===');
    console.log(report.bing.analysis.recommendation);
  }
  if (report.google?.analysis && !report.google.analysis.loginRequired) {
    console.log('\n=== Google GSC summary ===');
    console.log(report.google.analysis.recommendation);
  }

  if (untilDone && report.bing?.status?.inProgress) process.exitCode = 3;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

