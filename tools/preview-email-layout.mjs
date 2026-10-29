import { mkdirSync, writeFileSync } from 'node:fs';
import { buildBrandedEmail } from '../functions/_lib/email-template.js';

const destination = new URL('../.wrangler/email-preview/', import.meta.url);
mkdirSync(destination, { recursive: true });
for (const lang of ['de', 'en', 'ru', 'uk']) {
  writeFileSync(new URL(`${lang}.html`, destination), buildBrandedEmail({
    lang,
    title: 'HUNDESALON NIKA — QA',
    bodyText: 'QA-NIKA: проверка оформления письма.\nLayout verification only.',
  }));
}
console.log('Generated four local email previews in .wrangler/email-preview.');
const logo = await fetch('https://hundesalon-nika.pages.dev/assets/images/email/logo.png');
const logoType = logo.headers.get('content-type') || '';
const resourcePolicy = logo.headers.get('cross-origin-resource-policy');
console.log({ logoStatus: logo.status, logoType, resourcePolicy });
if (!logo.ok || !logoType.startsWith('image/') || resourcePolicy !== 'cross-origin') {
  throw new Error('The public email logo is not available for external embedding');
}
