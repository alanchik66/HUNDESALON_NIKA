import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(projectRoot, 'assets', 'js', 'animal-breed-photo-data.js');
const outputDirectory = path.join(projectRoot, 'test-results', 'animal-breed-photos');
const columns = 4;
const rows = 4;
const cardWidth = 360;
const cardHeight = 280;
const imageWidth = 320;
const imageHeight = 205;

const escapeXml = value => String(value || '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const context = vm.createContext({ window: {} });
vm.runInContext(await fs.readFile(manifestPath, 'utf8'), context, { filename: manifestPath });
const entries = Object.entries(context.window.AnimalBreedPhotoData.entriesByKey)
  .map(([key, entry]) => ({ key, ...entry }))
  .sort((left, right) => (
    left.kind.localeCompare(right.kind)
    || left.name.localeCompare(right.name, 'en', { sensitivity: 'base' })
    || left.key.localeCompare(right.key)
  ));

await fs.mkdir(outputDirectory, { recursive: true });
const pages = Math.ceil(entries.length / (columns * rows));

for (let page = 0; page < pages; page += 1) {
  const pageEntries = entries.slice(page * columns * rows, (page + 1) * columns * rows);
  const composites = [];

  for (const [index, entry] of pageEntries.entries()) {
    const x = (index % columns) * cardWidth;
    const y = Math.floor(index / columns) * cardHeight;
    const photoPath = path.join(projectRoot, entry.localAsset.replace(/^\//, ''));
    const photo = await sharp(photoPath)
      .resize({ width: imageWidth, height: imageHeight, fit: 'contain', background: '#f4efe3' })
      .webp({ quality: 82 })
      .toBuffer();
    const ordinal = page * columns * rows + index + 1;
    const label = Buffer.from(`
      <svg width="${cardWidth}" height="${cardHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#101915" stroke="#9b7b2f"/>
        <text x="18" y="229" fill="#f4df9b" font-family="Arial, sans-serif" font-size="17" font-weight="700">
          ${ordinal}. ${escapeXml(entry.name.slice(0, 37))}
        </text>
        <text x="18" y="253" fill="#d9d6cb" font-family="Arial, sans-serif" font-size="13">
          ${escapeXml(entry.kind)} · ${escapeXml(entry.exactness)}
        </text>
        <text x="18" y="272" fill="#9ea9a2" font-family="Arial, sans-serif" font-size="11">
          ${escapeXml(entry.key.slice(0, 54))}
        </text>
      </svg>
    `);
    composites.push({ input: label, left: x, top: y });
    composites.push({ input: photo, left: x + 20, top: y + 12 });
  }

  const outputPath = path.join(outputDirectory, `contact-${String(page + 1).padStart(2, '0')}.webp`);
  await sharp({
    create: {
      width: columns * cardWidth,
      height: rows * cardHeight,
      channels: 3,
      background: '#07100c',
    },
  }).composite(composites).webp({ quality: 84 }).toFile(outputPath);
}

await fs.writeFile(
  path.join(outputDirectory, 'index.json'),
  `${JSON.stringify({ entries: entries.length, pages, columns, rows }, null, 2)}\n`,
  'utf8'
);
console.log(`Animal photo contact sheets: ${entries.length} entries across ${pages} pages in ${outputDirectory}`);
