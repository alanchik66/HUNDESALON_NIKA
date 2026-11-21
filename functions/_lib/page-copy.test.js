import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { annotatePage } from '../../tools/lib/page-copy-build.mjs';
import { copyFields, renderPageCopy, validPageCopyValue, PAGE_LABELS } from './page-copy.js';

test('localised public pages expose editorial titles and copy without rewriting links and markup', async () => {
  for (const locale of ['de', 'en', 'ru', 'uk']) {
    for (const slug of PAGE_LABELS.keys()) {
      const file = new URL('../../' + locale + '/' + slug + '.html', import.meta.url);
      const marked = annotatePage(await readFile(file, 'utf8'));
      const fields = copyFields(marked);
      assert.equal(fields[0].id, 'title');
      // The price catalogue hero is generated from its localised JS data during the production build.
      if (slug !== 'prays-list')
        assert.ok(
          fields.some(field => field.kind === 'heading'),
          locale + '/' + slug
        );
      assert.equal(new Set(fields.map(field => field.id)).size, fields.length);
    }
  }
});

test('copy edits preserve anchors and formatting, escape user text, and keep unrelated paragraphs stable', () => {
  const source =
    '<title>Salon</title><main><h1><em>Welcome</em></h1><p>See <a href="/map">our map</a>.</p>' +
    '<p>Dogs &amp; cats</p><form><p>Form</p></form><footer><p>Footer</p></footer></main>';
  const marked = annotatePage(source);
  const fields = copyFields(marked);
  const field = fields.find(f => f.original === 'our map');
  assert.ok(field);
  assert.deepEqual(
    fields.map(f => f.original),
    ['Salon', 'Welcome', 'See', '/map', 'our map', 'Dogs & cats']
  );
  assert.equal(
    copyFields(annotatePage('<p>Earlier story</p>' + source)).find(f => f.original === 'our map').id,
    field.id
  );
  const result = renderPageCopy(marked, { [field.id]: '<new> & link', title: 'Other <title>' });
  assert.match(result, /<a [^>]*href="\/map">&lt;new&gt; &amp; link<\/a>/);
  assert.ok(result.includes('<title>Other &lt;title&gt;</title>'));
  assert.ok(result.includes('<form><p>Form</p></form><footer><p>Footer</p></footer>'));
});

test('editorial fields include SEO, accessible media, lists, captions, tables and safe link destinations', () => {
  const source =
    '<!doctype html><head><title>Salon</title>' +
    '<meta name="twitter:description" content="Social"><meta name="description" content="Search">' +
    '<meta property="og:description" content="Share"><link rel="canonical" href="/ru/sample"></head>' +
    '<body><header><a href="/before">Menu</a></header><main>' +
    '<section><figcaption>Our work</figcaption><img src="/assets/dog.jpg" alt="A dog &amp; its owner">' +
    '<img src="/assets/decoration.webp" aria-hidden="true" alt="Decoration">' +
    '<ul><li>Wait at reception</li></ul><table><caption>Opening hours</caption>' +
    '<tr><th>Friday</th><td>10</td></tr></table><span class="card-label">Detail</span>' +
    '<button type="button"><strong>Show more</strong></button>' +
    '<a href="https://example.org/map?a=1&amp;b=2">Map</a>' +
    '<a href="onlayn-bronirovanie.html">Appointment</a><a data-route="pricing" href="/prices">Route</a>' +
    '<form><button type="submit">Send</button><a href="/cancel">Cancel</a></form>' +
    '</section></main><footer><a href="/support">Footer link</a></footer></body>';
  const marked = annotatePage(source);
  const fields = copyFields(marked);
  const description = fields.find(field => field.kind === 'description');
  const image = fields.find(field => field.kind === 'image-alt');
  const link = fields.find(field => field.kind === 'link');
  assert.equal(description.original, 'Search');
  assert.equal(description.group, 'seo');
  assert.equal(description.maxLength, 320);
  assert.equal(fields.filter(field => field.kind === 'description').length, 1);
  assert.equal(image.original, 'A dog & its owner');
  assert.equal(link.original, 'https://example.org/map?a=1&b=2');
  assert.deepEqual(fields.filter(field => field.kind === 'caption').map(field => field.original), ['Our work', 'Opening hours']);
  assert.deepEqual(fields.filter(field => field.kind === 'cell').map(field => field.original), ['Friday', '10']);
  assert.equal(fields.find(field => field.kind === 'list').original, 'Wait at reception');
  for (const label of ['Show more', 'Detail', 'Map']) {
    assert.ok(fields.some(field => field.kind === 'label' && field.original === label));
  }
  for (const protectedValue of ['/before', '/ru/sample', '/prices', '/support', '/cancel', 'Decoration', 'Send', 'onlayn-bronirovanie.html']) {
    assert.ok(!fields.some(field => field.original === protectedValue), protectedValue);
  }
  const next = renderPageCopy(marked, {
    [description.id]: 'Salon "NIKA" & care',
    [image.id]: 'A pet <dog> & "owner"',
    [link.id]: 'https://example.org/new?a=1&b=2',
  });
  assert.equal((next.match(/content="Salon &quot;NIKA&quot; &amp; care"/g) || []).length, 3);
  assert.match(next, /src="\/assets\/dog\.jpg" alt="A pet &lt;dog&gt; &amp; &quot;owner&quot;"/);
  assert.match(next, /href="https:\/\/example\.org\/new\?a=1&amp;b=2"/);
  assert.match(next, /<a data-route="pricing" href="\/prices">/);
  assert.match(next, /<link rel="canonical" href="\/ru\/sample">/);
  const editedSource = annotatePage(source.replace('Wait at reception', 'Please ring the bell'));
  assert.equal(copyFields(editedSource).find(field => field.kind === 'list').id, fields.find(field => field.kind === 'list').id);
});

test('link fields accept public destinations and reset; invalid overrides leave original markup', () => {
  const marked = annotatePage('<main><a href="/ru/kontakty">Visit the salon</a></main>');
  const field = copyFields(marked).find(candidate => candidate.kind === 'link');
  for (const valid of [
    '', '  ', '/ru/kontakty#address', 'blog/article', '#schedule', 'https://example.org/path?a=1&b=2',
    'mailto:info@example.org', 'tel:+49-341-123',
  ]) {
    assert.equal(validPageCopyValue(field, valid), true, valid);
  }
  for (const invalid of [
    '//example.org/path', 'http://example.org', 'https:///example.org', 'https://user:pass@example.org',
    '/admin/', '/api/admin/page', 'https://hundesalon-nika.com/admin', 'mailto:info@example.org?subject=test',
    'tel:bad', 'javascript:ignored', 'data:text/plain,ignored', 'https://example.org/%0a', 'https:\\example.org',
  ]) {
    assert.equal(validPageCopyValue(field, invalid), false, invalid);
    assert.equal(renderPageCopy(marked, { [field.id]: invalid }), marked);
  }
  assert.equal(validPageCopyValue({ kind: 'description' }, 'x'.repeat(321)), false);
  assert.equal(validPageCopyValue({ kind: 'toString' }, 'plain'), false);
  assert.equal(renderPageCopy(marked, { [field.id]: '  ' }), marked);
});
