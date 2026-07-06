/**
 * Workload Identity Federation for remote agents (GitHub Actions, CI) — no SA JSON keys.
 * npm run google:setup-wif
 */
import { spawnSync } from 'node:child_process';

const PROJECT_ID = 'hundesalon-nika-shell-2026';
const PROJECT_NUMBER = '786632946547';
const POOL_ID = 'ai-agents-pool';
const PROVIDER_ID = 'github-hundesalon';
const SERVICE_ACCOUNT = `ai-agents-admin@${PROJECT_ID}.iam.gserviceaccount.com`;
const REPO = 'alanchik66/HUNDESALON_NIKA';
const LOCATION = 'global';

function run(args, { ignoreError = false, useUserAccount = false } = {}) {
  const env = { ...process.env };
  if (useUserAccount) delete env.CLOUDSDK_AUTH_IMPERSONATE_SERVICE_ACCOUNT;
  const result = spawnSync('gcloud', args, { encoding: 'utf8', shell: process.platform === 'win32', env });
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
  if (result.status !== 0 && !ignoreError) {
    const detail = output || `exit ${result.status}`;
    if (/already exists|ALREADY_EXISTS/i.test(detail)) return { ok: true, output: detail, existed: true };
    throw new Error(`gcloud ${args.join(' ')}\n${detail}`);
  }
  return { ok: true, output, existed: /already exists|ALREADY_EXISTS/i.test(output) };
}

function main() {
  console.log('Setting up Workload Identity Federation for remote agents...\n');

  run([
    'iam', 'workload-identity-pools', 'create', POOL_ID,
    '--project', PROJECT_ID,
    '--location', LOCATION,
    '--display-name', 'HUNDESALON AI Agents Pool',
  ], { ignoreError: true, useUserAccount: true });

  run([
    'iam', 'workload-identity-pools', 'providers', 'create-oidc', PROVIDER_ID,
    '--project', PROJECT_ID,
    '--location', LOCATION,
    '--workload-identity-pool', POOL_ID,
    '--display-name', 'GitHub HUNDESALON_NIKA',
    '--issuer-uri', 'https://token.actions.githubusercontent.com',
    '--attribute-mapping', 'google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref',
    '--attribute-condition', `assertion.repository=='${REPO}'`,
  ], { ignoreError: true, useUserAccount: true });

  const principal = `principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/${LOCATION}/workloadIdentityPools/${POOL_ID}/attribute.repository/${REPO}`;

  run([
    'iam', 'service-accounts', 'add-iam-policy-binding', SERVICE_ACCOUNT,
    '--project', PROJECT_ID,
    '--role', 'roles/iam.workloadIdentityUser',
    '--member', principal,
  ], { ignoreError: true });

  const providerName = `projects/${PROJECT_NUMBER}/locations/${LOCATION}/workloadIdentityPools/${POOL_ID}/providers/${PROVIDER_ID}`;

  console.log('WIF ready.\n');
  console.log(`  Pool:     ${POOL_ID}`);
  console.log(`  Provider: ${PROVIDER_ID}`);
  console.log(`  SA:       ${SERVICE_ACCOUNT}`);
  console.log(`  Repo:     ${REPO}`);
  console.log(`  Provider resource name:\n    ${providerName}\n`);
  console.log('GitHub Actions usage (example):');
  console.log('  - permissions: id-token: write');
  console.log('  - google-github-actions/auth@v2 with workload_identity_provider + service_account');
  console.log('');
  console.log('Devin / other remote agents: run GCP commands via Cloud Shell impersonation,');
  console.log('  or use this WIF provider from OIDC-capable CI.');
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
