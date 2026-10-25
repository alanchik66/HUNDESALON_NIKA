import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequestGet } from './booking-availability.js';

globalThis.caches = { default: { match: async () => null, put: async () => {} } };

const availability = date =>
  onRequestGet({ request: new Request(`https://hundesalon-nika.com/booking-availability?date=${date}`), env: {} });

test('booking horizon follows the salon date at local midnight in winter and summer', async t => {
  for (const [instant, yesterday, today, lastDay, tooLate] of [
    ['2026-01-01T23:30:00Z', '2026-01-01', '2026-01-02', '2026-04-02', '2026-04-03'],
    ['2026-07-01T22:30:00Z', '2026-07-01', '2026-07-02', '2026-09-30', '2026-10-01'],
  ]) {
    t.mock.timers.enable({ apis: ['Date'], now: Date.parse(instant) });
    assert.equal((await availability(yesterday)).status, 400);
    assert.equal((await availability(today)).status, 200);
    assert.equal((await availability(lastDay)).status, 200);
    assert.equal((await availability(tooLate)).status, 400);
    t.mock.timers.reset();
  }
});

test('availability rejects invalid dates and untrusted browser origins before provider work', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-02-01T12:00:00Z') });
  for (const date of ['2026-02-30', '2026-2-02', 'invalid']) {
    assert.equal((await availability(date)).status, 400);
  }
  const response = await onRequestGet({
    request: new Request('https://hundesalon-nika.com/booking-availability?date=2026-02-02', {
      headers: { Origin: 'https://example.invalid' },
    }),
    env: {},
  });
  assert.equal(response.status, 403);
});
