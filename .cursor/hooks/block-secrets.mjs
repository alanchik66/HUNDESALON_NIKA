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

out({ permission: 'allow' });
