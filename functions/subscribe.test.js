import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequest, subscriptionPersisted } from './subscribe.js';

test('subscriptionPersisted requires sheet, admin, or Teams — not welcome mail alone', () => {
  assert.equal(subscriptionPersisted({ sheetResult: { ok: true }, adminResult: { ok: false }, teamsResult: { skipped: true } }), true);
  assert.equal(subscriptionPersisted({ sheetResult: { skipped: true }, adminResult: { ok: true }, teamsResult: { skipped: true } }), true);
  assert.equal(subscriptionPersisted({ sheetResult: { ok: false }, adminResult: { ok: false }, teamsResult: { ok: true } }), true);
  assert.equal(
    subscriptionPersisted({
      sheetResult: { ok: false, skipped: true },
      adminResult: { ok: false, skipped: true },
      teamsResult: { ok: false, skipped: true },
    }),
    false
  );
});

test('subscribe returns 503 when every salon-facing channel soft-fails', async () => {
  const originalCaches = globalThis.caches;
  globalThis.caches = {
    default: {
      match: async () => null,
      put: async () => {},
    },
  };

  try {
    const response = await onRequest({
      request: new Request('https://hundesalon-nika.com/subscribe', {
        method: 'POST',
        headers: { Origin: 'https://hundesalon-nika.com', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'guest@example.com',
          lang: 'de',
          newsletter_consent: 'on',
          page: '/de/',
        }),
      }),
      env: {
        // Force soft-skip: no sheet, no Resend, no Teams.
        ADMIN_NOTIFICATION_EMAILS: '',
      },
    });

    assert.equal(response.status, 503);
  } finally {
    globalThis.caches = originalCaches;
  }
});
