import assert from 'node:assert/strict';
import test from 'node:test';
import { renderPageMedia } from './public-site-settings.js';

test('page media uses the current language and the same-origin file route', () => {
  const photo = { id: 'photo', mime: 'image/png', title: 'Salon', alt: 'Our salon' };
  assert.match(renderPageMedia('de', [photo]), /<h2>Fotos und Videos<\/h2>/);
  const html = renderPageMedia('ru', [photo, { id: 'clip', mime: 'video/mp4', title: 'Video' }]);
  assert.match(html, /<h2>Фото и видео<\/h2>/);
  assert.match(html, /<img src="\/api\/site-media\?id=photo" loading="lazy" decoding="async" alt="Our salon">/);
  assert.match(html, /<video src="\/api\/site-media\?id=clip" controls playsinline preload="none" aria-label="Video">/);
  assert.equal(renderPageMedia('uk', []), '');
});

test('captions, descriptions and file IDs cannot change HTML attributes or markup', () => {
  const html = renderPageMedia('en', [{
    id: 'x&name=other', mime: 'image/png', title: '<b>Salon</b> & friends', alt: '" title="<example>',
  }]);
  assert.match(html, /id=x%26name%3Dother/);
  assert.match(html, /alt="&quot; title=&quot;&lt;example&gt;"/);
  assert.match(html, /<figcaption>&lt;b&gt;Salon&lt;\/b&gt; &amp; friends<\/figcaption>/);
});

test('the gallery renders independent photo and video blocks in the current language', () => {
  const photo = { id: 'photo', mime: 'image/webp', title: 'Photo', alt: 'A groomed dog' };
  const video = { id: 'video', mime: 'video/mp4', title: 'Clip' };
  const html = renderPageMedia('uk', [video, photo], 'galereya');
  const [photos, videos] = html.split('</section>');
  assert.match(photos, /id="gallery-photos".*<h2>Фото галереї<\/h2>.*<img/);
  assert.doesNotMatch(photos, /<video/);
  assert.match(videos, /id="gallery-videos".*<h2>Відео галереї<\/h2>.*<video/);
  assert.doesNotMatch(videos, /<img/);
  assert.doesNotMatch(renderPageMedia('en', [photo], 'galereya'), /gallery-videos/);
});

test('documents have localized download lists and never become image or video elements', () => {
  const file = { id: 'abc&next=bad', mime: 'application/pdf', title: '<Прайс>' };
  for (const [locale, heading] of Object.entries({ de: 'Dokumente', en: 'Documents', ru: 'Документы', uk: 'Документи' })) {
    const html = renderPageMedia(locale, [file], 'galereya');
    assert.match(html, new RegExp(`<h2>${heading}</h2>`));
    assert.match(html, /href="\/api\/site-media\?id=abc%26next%3Dbad" download>&lt;Прайс&gt;<\/a>/);
    assert.doesNotMatch(html, /<(img|video)\b/);
  }
});
