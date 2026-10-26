import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout } from 'node:timers/promises';

const API_ORIGIN = 'https://api.github.com';
const REQUIRED_TOOLS = ['CodeQL', 'Semgrep OSS'];

export function assessCodeScanning({ analyses, alerts, commit, ref }) {
  if (!/^[0-9a-f]{40}$/i.test(commit || '') || typeof ref !== 'string' || !ref.startsWith('refs/')) {
    return { state: 'blocked', message: 'Invalid code scanning revision context.' };
  }
  if (
    !Array.isArray(analyses) ||
    !Array.isArray(alerts) ||
    alerts.some(alert => !['open', 'dismissed', 'fixed'].includes(alert?.state))
  ) {
    return { state: 'blocked', message: 'Invalid code scanning response.' };
  }
  const missing = [];
  for (const tool of REQUIRED_TOOLS) {
    const analysis = analyses.find(item => item.tool?.name === tool && item.commit_sha === commit && item.ref === ref);
    if (!analysis) missing.push(tool);
    else if (analysis.error) return { state: 'blocked', message: `${tool} analysis failed.` };
  }
  if (missing.length)
    return { state: 'pending', message: `Waiting for current-revision analyses: ${missing.join(', ')}.` };
  const open = alerts.filter(alert => alert.state === 'open');
  return open.length
    ? { state: 'blocked', message: `Review ${open.length} open code scanning alert(s) before deployment.` }
    : { state: 'ready', message: 'Current-revision CodeQL and Semgrep analyses passed; no open alerts.' };
}

export async function readGitHubList(url, token, fetcher = fetch, { firstPageOnly = false } = {}) {
  const result = [];
  for (let page = 0; url && page < 10; page++) {
    if (new URL(url).origin !== API_ORIGIN) throw new Error('Refusing a code scanning API link outside GitHub.');
    const response = await fetcher(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!response.ok) throw new Error(`Code scanning API returned HTTP ${response.status}.`);
    const data = await response.json().catch(() => {
      throw new Error('Code scanning API returned invalid JSON.');
    });
    if (!Array.isArray(data)) throw new Error('Code scanning API returned an invalid list.');
    result.push(...data);
    if (firstPageOnly) return result;
    url = response.headers.get('link')?.match(/<([^>]+)>;\s*rel="next"/)?.[1] || '';
  }
  if (url) throw new Error('Code scanning pagination exceeded the safety limit.');
  return result;
}

async function main() {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GH_TOKEN with code scanning read access is required.');
  const repo = process.env.GITHUB_REPOSITORY || 'alanchik66/HUNDESALON_NIKA';
  if (!/^[\w-]+\/[\w.-]+$/.test(repo) || /\/\.{1,2}$/.test(repo)) throw new Error('Invalid GitHub repository.');
  const commit = process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const ref = process.env.GITHUB_REF || 'refs/heads/main';
  const query = new URLSearchParams({ ref, per_page: '100' });
  for (let attempt = 0; attempt < 9; attempt++) {
    const [analyses, alerts] = await Promise.all([
      // The freshly uploaded commit must be among the latest analyses. Avoid reading years of history.
      readGitHubList(`${API_ORIGIN}/repos/${repo}/code-scanning/analyses?${query}`, token, fetch, {
        firstPageOnly: true,
      }),
      readGitHubList(`${API_ORIGIN}/repos/${repo}/code-scanning/alerts?state=open&${query}`, token),
    ]);
    const assessment = assessCodeScanning({ analyses, alerts, commit, ref });
    if (assessment.state === 'ready') {
      console.log(assessment.message);
      return;
    }
    if (assessment.state === 'blocked' || attempt === 8) throw new Error(assessment.message);
    await setTimeout(10000);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
