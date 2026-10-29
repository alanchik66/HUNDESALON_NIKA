import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const destination = new URL('../assets/images/email/', import.meta.url);
await mkdir(destination, { recursive: true });
for (const name of ['logo', 'whatsapp', 'telegram', 'viber', 'phone', 'facebook', 'mail', 'social-links']) {
  const source = new URL(`../assets/images/${name === 'logo' ? 'brand' : 'icons'}/${name}.png`, import.meta.url);
  const original = await readFile(source);
  const size = name === 'logo' ? 144 : 64;
  const image = await sharp(original)
    .resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(new URL(`${name}.png`, destination), image);
  console.log(`${name}: ${original.length} -> ${image.length} bytes`);
}
