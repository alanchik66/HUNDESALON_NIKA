import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const roots = [
  'package.json',
  'package-lock.json',
  '.dev.vars.example',
  'wrangler.toml',
  'workers/wrangler.toml',
  'functions',
  'assets/js',
  'config',
  'docs',
  'README.md',
];
const forbidden = [
  { pattern: /\bresend\b/i, label: 'legacy provider reference' },
  { pattern: /RESEND_[A-Z0-9_]+/i, label: 'legacy RESEND_* variable' },
];

const collectFiles = (relativePath) => {
  const absolutePath = join(root, relativePath);
  if (!existsSync(absolutePath)) return [];
  const stat = statSync(absolutePath);
  if (stat.isFile()) return [relativePath];
  return readdirSync(absolutePath, { withFileTypes: true }).flatMap((entry) =>
    collectFiles(join(relativePath, entry.name)),
  );
};

const candidates = roots.flatMap(collectFiles).filter((file) =>
  /\.(json|md|mjs|js|toml|example)$/.test(file) || file.endsWith('.vars.example'),
);
const findings = [];

for (const relativePath of candidates) {
  const content = readFileSync(join(root, relativePath), 'utf8');
  for (const rule of forbidden) {
    if (rule.pattern.test(content)) findings.push(`${relativePath}: ${rule.label}`);
  }
}

if (findings.length) {
  console.error('Email provider check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Email provider check passed: SendPulse is the only configured email transport.');
