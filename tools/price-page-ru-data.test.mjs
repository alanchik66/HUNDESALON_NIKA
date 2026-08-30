import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceFiles = ['assets/js/price-page-data.js', 'assets/js/price-page-ru-data.js'];
const expectedCategoryIds = [
  'ru-small-growing-coat',
  'ru-poodles-bichons',
  'ru-spitz',
  'ru-spaniels',
  'ru-wire-coat',
  'ru-short-coat',
  'ru-large-dogs',
  'ru-cats-grooming',
  'ru-small-animals',
  'ru-additional-services',
  'ru-important-information',
];
const expectedCatalogHash = '2933d291b5ec1727b1ac75c82ff587529c3750d64e7c3e02db486b0b1458af26';

const loadRussianCatalog = () => {
  const context = vm.createContext({ window: {} });
  for (const relativePath of sourceFiles) {
    const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
    vm.runInContext(source, context, { filename: relativePath });
  }
  return JSON.parse(JSON.stringify(context.window.PricePageCatalog.categoriesByLocale.ru));
};

test('Russian price catalog keeps its public output stable', () => {
  const categories = loadRussianCatalog();
  const serialized = JSON.stringify(categories);
  const digest = createHash('sha256').update(serialized).digest('hex');

  assert.deepEqual(
    categories.map(category => category.id),
    expectedCategoryIds
  );
  assert.equal(
    categories.some(category => Object.hasOwn(category, 'sizeGroups')),
    false
  );
  assert.equal(digest, expectedCatalogHash, `Russian price catalog snapshot changed: ${digest}`);
});
