import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const UNICODE_EMOJI_VERSION = '17.0';
const SOURCE_URL = `https://www.unicode.org/Public/${UNICODE_EMOJI_VERSION}.0/emoji/emoji-test.txt`;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = path.join(ROOT, 'assets', 'data', `emoji-${UNICODE_EMOJI_VERSION}.json`);

const response = await fetch(SOURCE_URL);
if (!response.ok) throw new Error(`Unicode emoji download failed: ${response.status}`);

const groups = [];
let currentGroup = null;
let currentSubgroup = '';

for (const line of (await response.text()).split(/\r?\n/)) {
  if (line.startsWith('# group: ')) {
    currentGroup = { name: line.slice(9).trim(), emoji: [] };
    groups.push(currentGroup);
    continue;
  }
  if (line.startsWith('# subgroup: ')) {
    currentSubgroup = line.slice(12).trim();
    continue;
  }
  if (!currentGroup || !line.includes('; fully-qualified')) continue;

  const match = line.match(/^([0-9A-F ]+)\s*;\s*fully-qualified\s*#\s*(\S+)\s+E[\d.]+\s+(.+)$/u);
  if (!match) continue;
  currentGroup.emoji.push({
    value: match[2],
    name: match[3].trim(),
    subgroup: currentSubgroup,
  });
}

const payload = {
  version: UNICODE_EMOJI_VERSION,
  source: SOURCE_URL,
  generatedAt: new Date().toISOString(),
  count: groups.reduce((sum, group) => sum + group.emoji.length, 0),
  groups,
};

await mkdir(path.dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify(payload)}\n`, 'utf8');
console.log(`Generated ${payload.count} emoji in ${path.relative(ROOT, OUTPUT)}`);
