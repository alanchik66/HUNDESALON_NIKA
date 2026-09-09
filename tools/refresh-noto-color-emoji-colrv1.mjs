import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targetDirectory = path.join(root, 'assets', 'fonts', 'noto-color-emoji');
const googleFontsBase =
  'https://fonts.gstatic.com/s/notocoloremoji/v40/Yq6P-KqIXTD0t4D9z1ESnKM3-HpFabsE4tq3luCC7p-aXxcn';
const licenseUrl =
  'https://raw.githubusercontent.com/googlefonts/noto-emoji/8998f5dd683424a73e2314a8c1f1e359c19e8742/fonts/LICENSE';

await mkdir(targetDirectory, { recursive: true });

for (let index = 0; index < 10; index += 1) {
  const response = await fetch(`${googleFontsBase}.${index}.woff2`);
  if (!response.ok) throw new Error(`Noto Color Emoji subset ${index} download failed (HTTP ${response.status}).`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length < 10_000 || String.fromCharCode(...bytes.slice(0, 4)) !== 'wOF2') {
    throw new Error(`Noto Color Emoji subset ${index} failed WOFF2 validation.`);
  }
  await writeFile(path.join(targetDirectory, `noto-color-emoji-${index}-400-normal.woff2`), bytes);
}

const licenseResponse = await fetch(licenseUrl);
const license = await licenseResponse.text();
if (!licenseResponse.ok || !license.includes('SIL OPEN FONT LICENSE')) {
  throw new Error(`Noto Color Emoji license download failed (HTTP ${licenseResponse.status}).`);
}
await writeFile(path.join(targetDirectory, 'LICENSE.txt'), license, 'utf8');

console.log('Refreshed official Noto Color Emoji COLRv1 subsets and OFL-1.1 license.');
