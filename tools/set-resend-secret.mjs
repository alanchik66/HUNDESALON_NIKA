#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const PROJECT_NAME = process.env.CLOUDFLARE_PROJECT_NAME || 'hundesalon-nika';
const DEV_VARS_PATH = '.dev.vars';

const args = process.argv.slice(2);
const flags = new Set(args.filter(arg => arg.startsWith('--')));
const positional = args.filter(arg => !arg.startsWith('--'));

const wantsPages = flags.has('--pages') || flags.has('--all');
const wantsLocal = flags.has('--local') || flags.has('--all') || !wantsPages;

function readStdinIfPiped() {
  try {
    if (process.stdin.isTTY) return '';
    return fs.readFileSync(0, 'utf8').trim();
  } catch {
    return '';
  }
}

function redact(value) {
  return String(value || '').replace(/re_[A-Za-z0-9_-]+/g, 're_<redacted>');
}

const resendKey = String(process.env.RESEND_API_KEY || positional[0] || readStdinIfPiped()).trim();

if (!resendKey) {
  console.error('RESEND_API_KEY is missing.');
  console.error('Use one of:');
  console.error('  $env:RESEND_API_KEY="re_..."; npm run resend:set-local');
  console.error('  $env:RESEND_API_KEY="re_..."; npm run resend:set-pages');
  console.error('  "re_..." | npm run resend:set-local');
  process.exit(2);
}

if (!/^re_[A-Za-z0-9_-]{10,}$/.test(resendKey)) {
  console.error('RESEND_API_KEY must look like a Resend API key: re_...');
  process.exit(2);
}

function upsertDevVar(name, value) {
  const existing = fs.existsSync(DEV_VARS_PATH)
    ? fs.readFileSync(DEV_VARS_PATH, 'utf8')
    : '# Local only - never commit.\n';
  const lines = existing.split(/\r?\n/);
  let replaced = false;

  for (let i = 0; i < lines.length; i += 1) {
    if (new RegExp(`^\\s*${name}\\s*=`).test(lines[i])) {
      lines[i] = `${name}=${value}`;
      replaced = true;
    }
  }

  if (!replaced) {
    if (lines.length && lines[lines.length - 1] !== '') lines.push('');
    lines.push(`${name}=${value}`);
  }

  fs.writeFileSync(DEV_VARS_PATH, `${lines.join('\n').replace(/\n*$/, '')}\n`, 'utf8');
}

if (wantsLocal) {
  upsertDevVar('RESEND_API_KEY', resendKey);
  console.log('Saved RESEND_API_KEY to .dev.vars (gitignored).');
}

if (wantsPages) {
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(
    npx,
    ['wrangler', 'pages', 'secret', 'put', 'RESEND_API_KEY', '--project-name', PROJECT_NAME],
    {
      input: `${resendKey}\n`,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    }
  );

  const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
  if (output) console.log(redact(output));

  if (result.status !== 0) {
    console.error('');
    console.error('Cloudflare Pages secret was not updated.');
    console.error('Use a token with Account > Cloudflare Pages > Edit, or run wrangler login.');
    process.exit(result.status || 1);
  }

  console.log(`Saved RESEND_API_KEY to Cloudflare Pages project "${PROJECT_NAME}".`);
}
