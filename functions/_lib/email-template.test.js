import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildBrandedEmail, MASTER_EMAIL_TEMPLATE } from './email-template.js';

test('email artwork exists as compact high-density PNG assets', () => {
  let totalBytes = 0;
  for (const name of ['logo', 'whatsapp', 'telegram', 'viber', 'phone', 'facebook', 'mail', 'social-links']) {
    const image = readFileSync(new URL(`../../assets/images/email/${name}.png`, import.meta.url));
    assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', name);
    const limit = name === 'logo' ? 144 : 64;
    assert.ok(image.readUInt32BE(16) > 0 && image.readUInt32BE(16) <= limit, name);
    assert.ok(image.readUInt32BE(20) > 0 && image.readUInt32BE(20) <= limit, name);
    totalBytes += image.length;
  }
  assert.ok(totalBytes < 150000, 'Email artwork must stay below the combined image budget');
});

test('buildBrandedEmail renders a branded, escaped and linkified email shell', () => {
  const html = buildBrandedEmail({
    lang: 'ru',
    title: 'Заявка <важная>',
    bodyText: 'Спасибо за обращение.\n\nhttps://example.com/booking?a=1&b=2',
  });

  assert.match(html, /<!doctype html>/i);
  assert.match(html, /Premium pet care|Премиальный уход/);
  assert.match(html, /HUNDESALON_NIKA/);
  assert.match(html, /href="https:\/\/example\.com\/booking\?a=1&amp;b=2"/);
  assert.match(html, /&lt;важная&gt;/);
  assert.doesNotMatch(html, /<важная>/);
  assert.match(html, /background-color:#07150d/);
  assert.match(html, /background-color:#c6a15b/);
  assert.doesNotMatch(html, /height:3px;font-size:0;line-height:0;background-color:#c6a15b/);
  assert.match(html, /width="72" height="72" alt="HUNDESALON_NIKA"/);
  assert.match(html, /href="https:\/\/hundesalon-nika\.com"[^>]*>HUNDESALON_NIKA<\/a>/);
  assert.doesNotMatch(html, />hundesalon-nika\.com<\/a>/);
  assert.match(html, /@keyframes emailNavRefraction/);
  assert.match(html, /border-radius:7px/);
  assert.match(html, /border-radius:11px/);
  assert.match(html, /class="brand-cell"/);
  assert.match(html, /class="nav-cell"/);
  assert.match(html, /href="https:\/\/hundesalon-nika\.com\/ru\/prays-list\.html"/);
  assert.match(html, />ПРАЙС-ЛИСТ<\/a>/);
  assert.match(html, /href="https:\/\/hundesalon-nika\.com\/ru\/galereya\.html"/);
  assert.match(html, />ОНЛАЙН ЗАКАЗ<\/a>/);
  assert.match(html, /class="site-footer"/);
  assert.match(html, /ВСЕ СОЦСЕТИ/);
  assert.match(html, /Конфиденциальность/);
  assert.match(html, /https:\/\/hundesalon-nika\.pages\.dev\/assets\/images\/email\/whatsapp\.png/);
  assert.match(html, /https:\/\/hundesalon-nika\.pages\.dev\/assets\/images\/email\/logo\.png/);
  assert.match(html, /@media \(prefers-color-scheme: light\)/);
});

test('buildBrandedEmail falls back to German for an unknown locale', () => {
  const html = buildBrandedEmail({ lang: 'xx', title: 'Test', bodyText: 'Body' });

  assert.match(html, /lang="de"/);
  assert.match(html, /Premium-Fellpflege in Leipzig/);
  assert.match(html, /Website öffnen/);
});

test('master email standard includes every active business alias and strict sender roles', () => {
  assert.deepEqual(MASTER_EMAIL_TEMPLATE.mailboxes, [
    'admin@hundesalon-nika.com',
    'booking@hundesalon-nika.com',
    'contact@hundesalon-nika.com',
    'info@hundesalon-nika.com',
    'noreply@hundesalon-nika.com',
    'support@hundesalon-nika.com',
  ]);
  assert.deepEqual(MASTER_EMAIL_TEMPLATE.senderRules.landlord, {
    from: 'info@hundesalon-nika.com',
    replyTo: 'info@hundesalon-nika.com',
  });
  assert.deepEqual(MASTER_EMAIL_TEMPLATE.senderRules.automated, {
    from: 'info@hundesalon-nika.com',
    replyTo: 'info@hundesalon-nika.com',
  });
});

for (const lang of ['de', 'en', 'ru', 'uk']) {
  test(`email header stays left aligned without website-only controls: ${lang}`, () => {
    const html = buildBrandedEmail({ lang, title: 'Test', bodyText: 'Body' });
    assert.doesNotMatch(html, /language-control|theme-control|theme-toggle|globe-language|sunrise/);
    assert.doesNotMatch(html, /display:block !important; width:100% !important; text-align:center/);
    assert.match(html, /class="brand-cell" width="84"/);
    assert.match(html, /class="nav-cell"/);
    assert.match(html, /class="header-navigation"/);
    assert.match(html, /padding:0 0 16px/);
    assert.doesNotMatch(html, /max-width:680px/);
  });
}
