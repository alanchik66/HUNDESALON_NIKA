/**
 * Integrity check: AI routing kernel is wired into every host entry point.
 * Fails if routing is missing, duplicated as a conflicting dialect, or GSC account drifts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function mustMention(relativePath, needle, label = needle) {
  assert(exists(relativePath), `Missing required AI file: ${relativePath}`);
  if (!exists(relativePath)) return;
  const text = read(relativePath);
  assert(text.includes(needle), `${relativePath} must reference ${label}`);
}

const requiredFiles = [
  'docs/agents-routing.md',
  'docs/agents-master.md',
  'docs/agents-playbook.md',
  'AGENTS.md',
  'CLAUDE.md',
  'GEMINI.md',
  '.github/copilot-instructions.md',
  '.github/agents/hundesalon-professional.agent.md',
  '.cursor/rules/00-routing-kernel.mdc',
  '.cursor/rules/40-agent-routing.mdc',
];

for (const file of requiredFiles) {
  assert(exists(file), `Missing required AI routing file: ${file}`);
}

const kernelNeedle = 'docs/agents-routing.md';
const entryPoints = [
  'AGENTS.md',
  'CLAUDE.md',
  'GEMINI.md',
  'docs/agents-playbook.md',
  'docs/agents-master.md',
  '.github/copilot-instructions.md',
  '.github/agents/hundesalon-professional.agent.md',
  '.cursor/rules/00-routing-kernel.mdc',
  '.cursor/rules/40-agent-routing.mdc',
];

for (const file of entryPoints) {
  mustMention(file, kernelNeedle, 'the routing kernel path');
}

if (exists('docs/agents-routing.md')) {
  const kernel = read('docs/agents-routing.md');
  for (const phrase of [
    'Repository detection',
    'Workspace detection',
    'Environment detection',
    'Startup workflow',
    'Decision pipeline',
    'Conflict resolution',
    'Monorepo',
  ]) {
    assert(kernel.toLowerCase().includes(phrase.toLowerCase()), `Routing kernel missing section cue: ${phrase}`);
  }
  assert(
    kernel.includes('alanchik66/HUNDESALON_NIKA'),
    'Routing kernel must pin the GitHub repository identity'
  );
  assert(
    kernel.includes('hundesalon-nika-website'),
    'Routing kernel must pin package.json name'
  );
}

if (exists('.cursor/rules/00-routing-kernel.mdc')) {
  const rule = read('.cursor/rules/00-routing-kernel.mdc');
  assert(rule.includes('alwaysApply: true'), '00-routing-kernel.mdc must be alwaysApply');
  assert(rule.includes('Startup'), '00-routing-kernel.mdc must encode startup workflow');
  assert(rule.includes('Decision pipeline'), '00-routing-kernel.mdc must encode decision pipeline');
}

if (exists('.cursor/rules/40-agent-routing.mdc')) {
  const taskRouting = read('.cursor/rules/40-agent-routing.mdc');
  assert(
    taskRouting.includes('ryndenko1982@gmail.com'),
    '40-agent-routing.mdc GSC account must be ryndenko1982@gmail.com'
  );
  assert(
    !taskRouting.includes('GSC → `snaiper1984@gmail.com`'),
    '40-agent-routing.mdc must not list snaiper Gmail as GSC owner'
  );
  assert(
    taskRouting.includes('00-routing-kernel') || taskRouting.includes('Prerequisite'),
    '40-agent-routing.mdc must defer to the routing kernel'
  );
}

if (exists('docs/agents-master.md')) {
  const master = read('docs/agents-master.md');
  assert(
    master.includes('Routing is not optional') || master.includes('AI Routing Kernel'),
    'agents-master.md must bind to the routing kernel at the top'
  );
  assert(
    master.includes('139.1 Instruction conflict order'),
    'agents-master.md must integrate instruction conflict order into §139'
  );
  assert(
    master.includes('Every task begins with the Routing Kernel'),
    'agents-master.md operational workflow must start with routing'
  );
}

if (exists('package.json')) {
  const pkg = JSON.parse(read('package.json'));
  assert(pkg.name === 'hundesalon-nika-website', 'package.json name drift');
  assert(
    pkg.scripts && pkg.scripts['check:agents-routing'],
    'package.json must expose check:agents-routing'
  );
}

if (failures.length) {
  console.error('check:agents-routing FAILED:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log('check:agents-routing OK — routing kernel wired across AI entry points.');
