import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shouldWrite = process.argv.includes('--write');
const onlyName = process.argv.find(argument => argument.startsWith('--only='))?.slice('--only='.length) || '';
const onlyNames = onlyName.split(',').filter(Boolean);

const assets = [
  ['assets/images/icons/instagram.png', 'assets/images/icons/instagram.webp', 256],
  ['assets/images/icons/whatsapp.png', 'assets/images/icons/whatsapp.webp', 256],
  ['assets/images/icons/globe-language.png', 'assets/images/icons/globe-language.webp', 256],
  ['assets/images/brand/logo.png', 'assets/images/brand/logo-ui.webp', 320],
  ['assets/images/icons/viber.png', 'assets/images/icons/viber.webp', 256],
  ['assets/images/icons/chevron-down.png', 'assets/images/icons/chevron-down.webp', 96],
  ['assets/images/icons/currency-euro.png', 'assets/images/icons/currency-euro.webp', 128],
  ['assets/images/icons/youtube.png', 'assets/images/icons/youtube.webp', 256],
  ['assets/images/icons/sunrise.png', 'assets/images/icons/sunrise.webp', 256],
  ['assets/images/icons/social-links.png', 'assets/images/icons/social-links.webp', 256],
  ['assets/images/icons/phone.png', 'assets/images/icons/phone.webp', 256],
  ['assets/images/icons/books_alt1.png', 'assets/images/icons/books_alt1.webp', 256],
  ['assets/images/icons/telegram.png', 'assets/images/icons/telegram.webp', 256],
  ['assets/images/icons/mail.png', 'assets/images/icons/mail.webp', 256],
  ['assets/images/icons/home.png', 'assets/images/icons/home.webp', 192],
  ['assets/images/icons/spotify.png', 'assets/images/icons/spotify.webp', 192],
  ['assets/images/icons/apple-music.png', 'assets/images/icons/apple-music.webp', 192],
];

const selectedAssets = onlyNames.length
  ? assets.filter(([sourceRelative]) => onlyNames.some(name => sourceRelative.endsWith(name)))
  : assets;
if (!selectedAssets.length) throw new Error(`Unknown UI image: ${onlyName}`);

const results = [];
for (const [sourceRelative, targetRelative, maxDimension] of selectedAssets) {
  const source = path.join(root, sourceRelative);
  const target = path.join(root, targetRelative);
  const sourceStats = await fs.stat(source);
  const metadata = await sharp(source).metadata();

  if (shouldWrite) {
    await sharp(source)
      .resize({
        width: maxDimension,
        height: maxDimension,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({
        quality: 92,
        alphaQuality: 100,
        smartSubsample: true,
        effort: 6,
      })
      .toFile(target);
  }

  let targetStats = shouldWrite ? await fs.stat(target) : null;
  let targetMetadata = null;
  if (targetStats && targetStats.size >= sourceStats.size) {
    await fs.rm(target);
    targetStats = null;
  } else if (targetStats) {
    targetMetadata = await sharp(target).metadata();
  }
  results.push({
    source: sourceRelative,
    target: targetStats ? targetRelative : sourceRelative,
    sourceBytes: sourceStats.size,
    targetBytes: targetStats?.size || null,
    sourceDimensions: `${metadata.width}x${metadata.height}`,
    targetDimensions: targetMetadata ? `${targetMetadata.width}x${targetMetadata.height}` : null,
  });
}

const totals = results.reduce(
  (summary, item) => ({
    sourceBytes: summary.sourceBytes + item.sourceBytes,
    targetBytes: summary.targetBytes + (item.targetBytes || 0),
  }),
  { sourceBytes: 0, targetBytes: 0 }
);

console.log(JSON.stringify({ ok: true, written: shouldWrite, totals, results }, null, 2));
