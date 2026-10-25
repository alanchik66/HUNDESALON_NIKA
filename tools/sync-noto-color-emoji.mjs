import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targetCssPath = path.join(root, 'assets', 'css', 'noto-color-emoji.css');
const targetFontDirectory = path.join(root, 'assets', 'fonts', 'noto-color-emoji');
const targetCss = await readFile(targetCssPath, 'utf8');
const woff2Files = [...targetCss.matchAll(/noto-color-emoji-(\d+)-400-normal\.woff2/g)].map(
  match => `noto-color-emoji-${match[1]}-400-normal.woff2`
);

if (new Set(woff2Files).size !== 10) {
  throw new Error(`Expected 10 subset WOFF2 files, found ${new Set(woff2Files).size}.`);
}

for (const fileName of new Set(woff2Files)) {
  const file = await stat(path.join(targetFontDirectory, fileName));
  if (file.size < 10_000) throw new Error(`${fileName} is unexpectedly small.`);
}

const license = await readFile(path.join(targetFontDirectory, 'LICENSE.txt'), 'utf8');
if (!license.includes('SIL OPEN FONT LICENSE')) throw new Error('Noto Color Emoji OFL-1.1 license is missing.');

console.log(`Verified Noto Color Emoji COLRv1: ${new Set(woff2Files).size} WOFF2 subsets and OFL-1.1 license.`);
