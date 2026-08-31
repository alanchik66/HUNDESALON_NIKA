import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../assets/js/reviews-page.js', import.meta.url), 'utf8');

function mountReview({ rating = 0, googleUrl = 'https://www.google.com/maps/', reducedMotion = false } = {}) {
  const handlers = new Map();
  const summary = { textContent: '' };
  const followup = { hidden: true, dataset: {}, scrollIntoView(options) { this.scrollOptions = options; } };
  const publicPanel = { hidden: true };
  const privatePanel = { hidden: true };
  const googleLink = { hidden: false, removeAttribute(name) { delete this[name]; } };
  const form = {
    querySelector: () => rating ? { value: String(rating) } : null,
    addEventListener: (name, handler) => handlers.set(name, handler),
  };
  const elements = {
    '[data-review-form]': form,
    '[data-review-rating-summary]': summary,
    '[data-review-followup]': followup,
    '[data-review-followup-public]': publicPanel,
    '[data-review-followup-private]': privatePanel,
  };
  const root = {
    dataset: { reviewGoogleUrl: googleUrl },
    querySelector: selector => elements[selector],
    querySelectorAll: () => [googleLink],
  };
  vm.runInNewContext(source, {
    document: { querySelector: () => root },
    window: { matchMedia: () => ({ matches: reducedMotion }) },
  });
  return { handlers, summary, followup, publicPanel, privatePanel, googleLink };
}

for (const rating of [1, 2, 3, 4, 5]) {
  test(`public and direct contact options remain available after a ${rating}-star review`, () => {
    const page = mountReview();
    assert.equal(page.followup.hidden, true);
    page.handlers.get('sendmail:success')({ detail: { values: { review_rating: String(rating) } } });
    assert.equal(page.followup.hidden, false);
    assert.equal(page.publicPanel.hidden, false);
    assert.equal(page.privatePanel.hidden, false);
    assert.equal(page.followup.dataset.reviewRating, String(rating));
    assert.equal(page.summary.textContent, '0 / 5');
  });
}

test('selected rating updates the summary without revealing delivery success', () => {
  const page = mountReview({ rating: 3 });
  page.handlers.get('change')({ target: { tagName: 'INPUT', name: 'review_rating' } });
  assert.equal(page.summary.textContent, '3 / 5');
  assert.equal(page.followup.hidden, true);
});

test('missing Google destination is hidden, not replaced with a fabricated link', () => {
  const page = mountReview({ googleUrl: '' });
  assert.equal(page.googleLink.hidden, true);
  assert.equal(page.googleLink.href, undefined);
});

test('follow-up respects reduced-motion preference', () => {
  const page = mountReview({ reducedMotion: true });
  page.handlers.get('sendmail:success')({ detail: { values: { review_rating: '1' } } });
  assert.equal(page.followup.scrollOptions.behavior, 'auto');
});

test('production build includes the universal review QR landing page', () => {
  const buildSource = readFileSync(new URL('./build-production.js', import.meta.url), 'utf8');
  assert.match(buildSource, /const copyEntries = \[[\s\S]*?'reviews\.html'/);
});

for (const locale of ['de', 'en', 'ru', 'uk']) {
  test(`${locale} review form matches sendmail required fields and disables generated drafts`, () => {
    const html = readFileSync(new URL(`../${locale}/reyting.html`, import.meta.url), 'utf8');
    assert.match(html, /<form[^>]+data-review-form[^>]+data-disable-draft="true"/);
    for (const field of ['name', 'email']) {
      assert.match(html, new RegExp(`<input[^>]+name="${field}"[^>]+required`));
    }
  });
}
