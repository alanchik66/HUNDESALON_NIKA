import { mkdirSync, writeFileSync } from 'node:fs';
import { buildBrandedEmail } from '../functions/_lib/email-template.js';

const destination = new URL('../.wrangler/email-preview/', import.meta.url);
mkdirSync(destination, { recursive: true });
for (const lang of ['de', 'en', 'ru', 'uk']) {
  writeFileSync(new URL(`${lang}.html`, destination), buildBrandedEmail({
    lang,
    title: 'HUNDESALON NIKA — QA',
    bodyText: 'QA-NIKA: проверка оформления письма.\nLayout verification only.',
  }).replace('https://hundesalon-nika.com/assets/images/brand/logo.png', '/assets/images/brand/logo.png'));
}
console.log('Generated four local email previews in .wrangler/email-preview.');
const logo = await fetch('https://hundesalon-nika.com/assets/images/brand/logo.png');
console.log({ logoStatus: logo.status, logoType: logo.headers.get('content-type') });
