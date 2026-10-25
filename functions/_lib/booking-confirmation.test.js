import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BOOKING_CONFIRM_TTL_SECONDS,
  buildBookingConfirmationUrl,
  verifyBookingConfirmationToken,
} from './booking-confirmation.js';

const env = { TELEGRAM_WEBHOOK_SECRET: 'a'.repeat(48) };
const requestId = '12345678-1234-4123-8123-123456789abc';
const now = Date.UTC(2030, 0, 1);

test('builds and verifies a short-lived booking confirmation URL', async () => {
  const value = await buildBookingConfirmationUrl(env, 'https://hundesalon-nika.com/sendmail', requestId, now);
  const url = new URL(value);
  const verified = await verifyBookingConfirmationToken(env, url.searchParams, now);
  assert.equal(url.origin, 'https://hundesalon-nika.com');
  assert.equal(url.pathname, '/api/booking-confirm');
  assert.equal(verified.ok, true);
  assert.equal(verified.requestId, requestId);
  assert.equal(Number(url.searchParams.get('expires')), Math.floor(now / 1000) + BOOKING_CONFIRM_TTL_SECONDS);
});

test('rejects tampered and expired confirmation links', async () => {
  const tampered = new URL(await buildBookingConfirmationUrl(env, 'https://hundesalon-nika.com', requestId, now));
  tampered.searchParams.set('id', '22345678-1234-4123-8123-123456789abc');
  assert.equal((await verifyBookingConfirmationToken(env, tampered.searchParams, now)).ok, false);

  const expired = new URL(await buildBookingConfirmationUrl(env, 'https://hundesalon-nika.com', requestId, now));
  assert.equal(
    (await verifyBookingConfirmationToken(env, expired.searchParams, now + (BOOKING_CONFIRM_TTL_SECONDS + 1) * 1000))
      .ok,
    false
  );
  assert.equal(await buildBookingConfirmationUrl({}, 'https://hundesalon-nika.com', requestId, now), '');
  assert.equal(await buildBookingConfirmationUrl(env, 'https://example.com', requestId, now), '');
});
