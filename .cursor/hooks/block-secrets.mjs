#!/usr/bin/env node
/**
 * Lean Cursor hook: block reading/shelling secrets (.dev.vars, .env, keys).
 * stdin JSON → stdout { permission: allow|deny|ask }
 */
import fs from 'node:fs';

const SECRET_RE =
  /(^|[\s"'`\\/])(\.dev\.vars|\.env(?:\.[^\s"'`\\/]*)?|\.secrets(?:[\\/][^\s"'`]*)?)(?=$|[\s"'`\\/])|(^|[\s"'`\\/])[^\s"'`\\/]+\.(pem|key|p12|pfx)(?=$|[\s"'`\\/])/i;
const DANGEROUS_SHELL_RE =
  /\b(format\s+|diskpart\b|Remove-Item\s+[^\n]*\$env:USERPROFILE|rm\s+-rf\s+\/\s*$)/i;
/** Cross-session stompers — deny unless user explicitly ordered in THIS chat (agent must not). */
const CROSS_SESSION_SHELL_RE =
  /\bgit\s+reset\s+--hard\b|\bgit\s+clean\s+-[a-zA-Z]*f|\bgit\s+push\s+[^\n]*--force\b|\bgit\s+push\s+[^\n]*-f\b|\bgit\s+checkout\s+--force\b|\bgit\s+restore\s+--source=HEAD\s+--\s+\.\b/i;

let raw = '';
try {
  raw = fs.readFileSync(0, 'utf8');
} catch {
  raw = '';
}

let payload = {};
try {
  payload = raw ? JSON.parse(raw) : {};
} catch {
  payload = {};
}

const command = String(payload.command || payload.cmd || '');
const filePath = String(
  payload.filePath ||
    payload.path ||
    payload.uri ||
    payload.file ||
    payload.target ||
    ''
);
const hay = `${command}\n${filePath}`;

function out(obj) {
  process.stdout.write(JSON.stringify(obj));
}

if (SECRET_RE.test(hay) || SECRET_RE.test(filePath) || /^\.dev\.vars$/i.test(filePath.trim()) || /^\.env(\.|$)/i.test(filePath.trim())) {
  out({
    permission: 'deny',
    user_message:
      'Blocked: secrets path (.dev.vars / .env / keys). Do not read or shell secrets.',
  });
  process.exit(0);
}

if (command && DANGEROUS_SHELL_RE.test(command)) {
  out({
    permission: 'deny',
    user_message: 'Blocked: destructive disk/home wipe command.',
  });
  process.exit(0);
}

if (command && CROSS_SESSION_SHELL_RE.test(command)) {
  out({
    permission: 'deny',
    user_message:
      'Blocked: cross-session git stomper (reset --hard / clean -f / force-push). Use a worktree or get an explicit user order in this chat.',
  });
  process.exit(0);
}

out({ permission: 'allow' });
