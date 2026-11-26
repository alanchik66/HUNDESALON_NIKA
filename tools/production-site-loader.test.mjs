import assert from 'node:assert/strict';
import test from 'node:test';
import { stripOwnedSiteLoaderMarkup } from './lib/production-site-loader.mjs';

test('owned loader cleanup removes legacy and duplicate loader entries', () => {
  const original = [
    '<main>content</main>',
    '<div id="preloader">\n  <div class="loader"></div>\n</div>',
    '<link rel="stylesheet" href="../assets/css/site-loader.css?v=old">',
    '<script src="../assets/js/paw-loader-scene.js?v=old"></script>',
    '<script src="../assets/js/site-loader.js?v=old"></script>',
    '<script src="/assets/js/site-loader.js"></script>',
  ].join('\n');
  assert.equal(stripOwnedSiteLoaderMarkup(original).trim(), '<main>content</main>');
});

test('owned loader cleanup reaches entries reconstituted by an earlier removal', () => {
  const nested =
    '<scrip<script src="../assets/js/site-loader.js"></script>t src="../assets/js/paw-loader-scene.js"></script>';
  assert.equal(stripOwnedSiteLoaderMarkup(nested), '');
});

test('owned loader cleanup handles canonical case and quote variants', () => {
  const original =
    "<LINK href='/assets/css/site-loader.css?v=1' rel='stylesheet'>\n<SCRIPT src='/assets/js/paw-loader-scene.js'></SCRIPT>\n<SCRIPT src='/assets/js/site-loader.js'></SCRIPT>";
  assert.equal(stripOwnedSiteLoaderMarkup(original), '');
});

test('owned loader cleanup preserves other authored markup exactly', () => {
  const original =
    '<!doctype html>\n<head><script src="/assets/js/main.js"></script></head>\n<body><div id="preloader" class="custom">kept</div><script>window.example = true;</script></body>';
  assert.equal(stripOwnedSiteLoaderMarkup(original), original);
});

test('owned loader cleanup is stable for documents already processed', () => {
  const original = '<head><link href="/assets/css/site-loader.css?v=old"></head><body>content</body>';
  const cleaned = stripOwnedSiteLoaderMarkup(original);
  assert.equal(stripOwnedSiteLoaderMarkup(cleaned), cleaned);
});
