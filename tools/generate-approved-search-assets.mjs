import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const source = 'assets/images/ads/work/logo-from-card-crown-512.png';
const faviconDir = 'assets/images/brand/favicon';
const icons = [
  [16, 'favicon-16x16.png'],
  [32, 'favicon-32x32.png'],
  [48, 'favicon-48x48.png'],
  [64, 'favicon-64x64.png'],
  [96, 'favicon-96x96.png'],
  [128, 'favicon-128x128.png'],
  [180, 'apple-touch-icon.png'],
  [192, 'android-chrome-192x192.png'],
  [256, 'favicon-256x256.png'],
  [384, 'favicon-384x384.png'],
  [512, 'android-chrome-512x512.png'],
  [150, 'mstile-150x150.png'],
  [512, 'favicon-512x512.png'],
  [512, 'favicon-search-512.png'],
  [512, 'maskable-icon-512x512.png'],
];

fs.mkdirSync(faviconDir, { recursive: true });

for (const [size, name] of icons) {
  await sharp(source).resize(size, size, { fit: 'cover' }).png().toFile(path.join(faviconDir, name));
}

await sharp(source)
  .resize(512, 512, { fit: 'cover' })
  .png()
  .toFile('assets/images/brand/search-logo-clear-512.png');

const icoSizes = [16, 32, 48];
const pngs = await Promise.all(
  icoSizes.map(size => fs.promises.readFile(path.join(faviconDir, `favicon-${size}x${size}.png`)))
);
const header = Buffer.alloc(6 + 16 * pngs.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(pngs.length, 4);

let offset = header.length;
pngs.forEach((png, index) => {
  const size = icoSizes[index];
  const position = 6 + index * 16;
  header[position] = size;
  header[position + 1] = size;
  header.writeUInt16LE(1, position + 4);
  header.writeUInt16LE(32, position + 6);
  header.writeUInt32LE(png.length, position + 8);
  header.writeUInt32LE(offset, position + 12);
  offset += png.length;
});

const ico = Buffer.concat([header, ...pngs]);
fs.writeFileSync('favicon.ico', ico);
fs.writeFileSync(path.join(faviconDir, 'favicon.ico'), ico);

console.log('Generated search and PWA icons from the approved opaque logo.');
