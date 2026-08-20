import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBrandedEmail } from './email-template.js';

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
});

test('buildBrandedEmail falls back to German for an unknown locale', () => {
  const html = buildBrandedEmail({ lang: 'xx', title: 'Test', bodyText: 'Body' });

  assert.match(html, /lang="de"/);
  assert.match(html, /Premium-Fellpflege in Leipzig/);
  assert.match(html, /Website öffnen/);
});
