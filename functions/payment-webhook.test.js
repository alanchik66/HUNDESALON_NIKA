import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldRetryPaymentNotifications } from './payment-webhook.js';

test('retries when every attempted channel soft-fails', () => {
  assert.equal(
    shouldRetryPaymentNotifications([
      { status: 'fulfilled', value: { ok: false, status: 503 } },
      { status: 'fulfilled', value: { ok: false, skipped: true } },
      { status: 'fulfilled', value: { ok: false, skipped: true } },
    ]),
    true
  );
});

test('does not retry when at least one channel delivered', () => {
  assert.equal(
    shouldRetryPaymentNotifications([
      { status: 'fulfilled', value: { ok: true, status: 200 } },
      { status: 'fulfilled', value: { ok: false, status: 500 } },
      { status: 'fulfilled', value: { ok: false, skipped: true } },
    ]),
    false
  );
});

test('does not retry when every channel is unconfigured/skipped', () => {
  assert.equal(
    shouldRetryPaymentNotifications([
      { status: 'fulfilled', value: { ok: false, skipped: true } },
      { status: 'fulfilled', value: { ok: false, skipped: true } },
      { status: 'fulfilled', value: { ok: false, skipped: true } },
    ]),
    false
  );
});

test('retries when settled promises reject', () => {
  assert.equal(
    shouldRetryPaymentNotifications([
      { status: 'rejected', reason: new Error('network') },
      { status: 'fulfilled', value: { ok: false, skipped: true } },
    ]),
    true
  );
});
