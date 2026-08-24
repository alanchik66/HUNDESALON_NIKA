import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBrandedEmail, MASTER_EMAIL_TEMPLATE } from './email-template.js';

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
  assert.match(html, /width="96" height="96" alt="HUNDESALON_NIKA"/);
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
  assert.match(html, /raw\.githubusercontent\.com\/alanchik66\/HUNDESALON_NIKA\/main\/assets\/images\/icons\/whatsapp\.png/);
  assert.match(html, /id="nika-email-theme" type="checkbox"/);
  assert.match(html, /for="nika-email-theme"/);
  assert.match(html, /@media \(prefers-color-scheme: light\)/);
  assert.match(html, /\.theme-toggle:checked \+ \.email-bg/);
  assert.match(html, /class="language-control" href="https:\/\/hundesalon-nika\.com\/ru\/"/);
  assert.match(html, /assets\/images\/icons\/globe-language\.webp/);
  assert.match(html, /assets\/images\/icons\/sunrise\.webp/);
  assert.match(html, /class="control-icon"[^>]*width="25" height="25"/);
  assert.match(html, /class="control-icon theme-icon" src="https:\/\/hundesalon-nika\.com\/assets\/images\/icons\/sunrise\.webp"/);
  assert.match(html, /class="header-tools"/);
});

test('buildBrandedEmail falls back to German for an unknown locale', () => {
  const html = buildBrandedEmail({ lang: 'xx', title: 'Test', bodyText: 'Body' });

  assert.match(html, /lang="de"/);
  assert.match(html, /Premium-Fellpflege in Leipzig/);
  assert.match(html, /Website öffnen/);
  assert.match(html, /href="https:\/\/hundesalon-nika\.com\/de\/" title="Sprache wechseln"/);
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
    from: 'noreply@hundesalon-nika.com',
    replyTo: 'support@hundesalon-nika.com',
  });
});
