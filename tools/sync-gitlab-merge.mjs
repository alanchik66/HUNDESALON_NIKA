/**
 * Open or merge GitLab MR: sync/gitlab-main -> main (uses git credential for gitlab.com).
 */
import { execSync } from 'node:child_process';

const PROJECT = 'hundesalon-nika%2Fhundesalon-nika';
const SOURCE = 'sync/gitlab-main';
const TARGET = 'main';

function gitlabToken() {
  const fromEnv = process.env.GITLAB_TOKEN?.trim() || process.env.GL_TOKEN?.trim();
  if (fromEnv) return fromEnv;

  const input = 'protocol=https\nhost=gitlab.com\n\n';
  const out = execSync('git credential fill', { input, encoding: 'utf8' });
  const password = out.match(/^password=(.+)$/m)?.[1]?.trim();
  if (!password) {
    throw new Error(
      'Set GITLAB_TOKEN (project/group PAT with api scope) or configure git credentials for gitlab.com'
    );
  }
  if (password.startsWith('glpat-') === false && password.length < 20) {
    console.warn(
      'Warning: git credential token may be OAuth (mcp/ai_workflows only). Use GITLAB_TOKEN with api scope.'
    );
  }
  return password;
}

async function api(token, pathname, init = {}) {
  const response = await fetch(`https://gitlab.com/api/v4${pathname}`, {
    ...init,
    headers: {
      'PRIVATE-TOKEN': token,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { message: text };
  }
  if (!response.ok) {
    throw new Error(
      `GitLab API ${pathname} ${response.status}: ${payload.message || JSON.stringify(payload)}`
    );
  }
  return payload;
}

const token = gitlabToken();

let mrs = await api(
  token,
  `/projects/${PROJECT}/merge_requests?state=opened&source_branch=${encodeURIComponent(SOURCE)}&target_branch=${TARGET}`
);

let mr = mrs[0];
if (!mr) {
  mr = await api(token, `/projects/${PROJECT}/merge_requests`, {
    method: 'POST',
    body: JSON.stringify({
      source_branch: SOURCE,
      target_branch: TARGET,
      title: 'sync: align GitLab main with GitHub',
      description:
        'Automated sync from GitHub canonical `main`. Merges `sync/gitlab-main` into protected `main` for GitLab CI.',
      remove_source_branch: false,
    }),
  });
  console.log(`Created MR !${mr.iid}: ${mr.web_url}`);
} else {
  console.log(`Using open MR !${mr.iid}: ${mr.web_url}`);
}

if (mr.merge_status === 'cannot_be_merged' || mr.has_conflicts) {
  console.error(`MR !${mr.iid} has conflicts. Resolve in GitLab UI or rebase sync/gitlab-main onto gitlab/main.`);
  process.exit(2);
}

if (mr.state === 'merged') {
  console.log(`MR !${mr.iid} already merged.`);
  process.exit(0);
}

const merged = await api(token, `/projects/${PROJECT}/merge_requests/${mr.iid}/merge`, {
  method: 'PUT',
  body: JSON.stringify({ merge_when_pipeline_succeeds: false, should_remove_source_branch: false }),
});

console.log(`Merged MR !${merged.iid} (${merged.merge_commit_sha || merged.sha}).`);
console.log(`GitLab main: https://gitlab.com/hundesalon-nika/hundesalon-nika/-/tree/main`);
