import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const window = { PricePageCatalog: {} };
vm.runInNewContext(readFileSync(new URL('../assets/js/price-booking.js', import.meta.url), 'utf8'), { window });
const score = (label, query) => window.PriceBookingCatalog.breedSearchScore(label, query, 'ru');

for (const [label, query] of [
  ['Немецкая овчарка', 'авчарка'],
  ['Немецкая овчарка', 'овчрака'],
  ['Бивер-йоркширский терьер', 'бивер'],
  ['Бивер-йоркширский терьер', 'йорк'],
  ['Бивер-йоркширский терьер', 'йорк бивер'],
  ['Русский той-терьер', 'той'],
  ['Русский той-терьер', 'терьер'],
  ['Русский той-терьер', 'той терер'],
]) {
  test(`${query} finds ${label}`, () => assert.ok(Number.isFinite(score(label, query))));
}
test('unrelated queries do not match', () => assert.equal(score('Немецкая овчарка', 'пудель'), Infinity));
test('exact matches rank before typos', () => assert.ok(score('Немецкая овчарка', 'овчарка') < score('Немецкая овчарка', 'авчарка')));
