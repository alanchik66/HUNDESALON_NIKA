import test from 'node:test';
import assert from 'node:assert/strict';
import { publishedProducts, normalizeBasket, basketSubtotal } from '../assets/js/shop-model.js';

const product = {
  id: 'test-care',
  published: true,
  available: true,
  category: 'wash',
  pets: ['dog'],
  name: { de: 'Pflege', en: 'Care', ru: 'Уход', uk: 'Догляд' },
  image: '/assets/images/test.webp',
  priceCents: 1299,
};

test('catalogue rejects incomplete, duplicate and unsafe product records', () => {
  assert.deepEqual(
    publishedProducts([
      product,
      product,
      { ...product, id: 'bad', image: 'https://untrusted.invalid/item.png' },
      { ...product, id: 'draft', published: false },
      { ...product, id: 'negative', priceCents: -1 },
      { ...product, id: 'missing-language', name: { de: 'Pflege' } },
    ]),
    [product]
  );
});

test('basket discards unknown or unavailable items and never trusts stored prices', () => {
  const basket = normalizeBasket(
    [
      { id: 'test-care', quantity: 2, priceCents: 1 },
      { id: 'unknown', quantity: 3 },
      { id: 'out-of-stock', quantity: 1 },
      { id: 'test-care', quantity: -1 },
      null,
    ],
    [product, { ...product, id: 'out-of-stock', available: false }]
  );
  assert.deepEqual(basket, [{ id: 'test-care', quantity: 2 }]);
  assert.equal(basketSubtotal(basket, [product]), 2598);
});

test('basket merges duplicates, caps quantities and handles corrupt storage', () => {
  assert.deepEqual(
    normalizeBasket(
      [
        { id: 'test-care', quantity: 98 },
        { id: 'test-care', quantity: 5 },
      ],
      [product]
    ),
    [{ id: 'test-care', quantity: 99 }]
  );
  assert.deepEqual(normalizeBasket({ id: 'test-care' }, [product]), []);
  assert.deepEqual(normalizeBasket([{ id: 'test-care', quantity: 1.5 }], [product]), []);
  assert.deepEqual(normalizeBasket([{ id: 'test-care', quantity: 1 }], []), []);
});
