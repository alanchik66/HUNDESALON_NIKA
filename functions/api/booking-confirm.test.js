import test from 'node:test';
import assert from 'node:assert/strict';

import { buildBookingConfirmationUrl } from '../_lib/booking-confirmation.js';
import { onRequest } from './booking-confirm.js';

globalThis.caches = { default: { match: async () => null, put: async () => {} } };

const requestId = '12345678-1234-4123-8123-123456789abc';
const eventId = `booking${requestId.replace(/-/g, '')}`;
const env = {
  TELEGRAM_WEBHOOK_SECRET: 'a'.repeat(48),
  GOOGLE_OAUTH_ACCESS_TOKEN: 'access-token',
  GOOGLE_CALENDAR_ID: 'calendar@example.com',
  SHEET_ID: 'sheet-id',
};

test('rejects an unsigned booking confirmation request without contacting Google', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => assert.fail('Google must not be contacted');
  try {
    const response = await onRequest({
      request: new Request('https://hundesalon-nika.com/api/booking-confirm?id=invalid'),
      env,
    });
    assert.equal(response.status, 403);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('opening a signed admin-email link only displays the confirmation button', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => assert.fail('Google must not be contacted by a link preview');
  try {
    const signedUrl = await buildBookingConfirmationUrl(env, 'https://hundesalon-nika.com', requestId);
    const response = await onRequest({
      request: new Request(signedUrl, { headers: { 'CF-Connecting-IP': crypto.randomUUID() } }),
      env,
    });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /<form method="post" action="\/api\/booking-confirm">/);
    assert.match(html, /Запись подтвердить/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('submitting the signed admin-email form confirms the matching pending booking', async () => {
  const originalFetch = globalThis.fetch;
  const row = Array(34).fill('');
  Object.assign(row, {
    3: 'Test Customer',
    6: 'Komplettpflege',
    7: '2030-01-02',
    8: '10:00',
    28: requestId,
    29: 'pending',
    32: '2030-01-02T10:00:00',
    33: '2030-01-02T12:00:00',
  });
  const calendarEvent = {
    id: eventId,
    status: 'confirmed',
    created: '2030-01-01T00:00:00Z',
    start: { dateTime: '2030-01-02T10:00:00+01:00' },
    end: { dateTime: '2030-01-02T12:00:00+01:00' },
    extendedProperties: { private: { bookingRequestId: requestId } },
  };
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.includes('/values/bookings!A1%3AAH')) return Response.json({ values: [[], row] });
    if (target.endsWith(`/events/${eventId}`)) return Response.json({}, { status: 404 });
    if (target.endsWith('/calendar/v3/freeBusy')) {
      return Response.json({ calendars: { 'calendar@example.com': { busy: [] } } });
    }
    if (target.endsWith('/events') && options.method === 'POST') return Response.json(calendarEvent);
    if (target.includes('/events?')) return Response.json({ items: [calendarEvent] });
    if (target.includes('/values/bookings!AD2%3AAF2')) return Response.json({ updatedRange: 'bookings!AD2:AF2' });
    throw new Error(`Unexpected fetch: ${target}`);
  };

  try {
    const signedUrl = await buildBookingConfirmationUrl(env, 'https://hundesalon-nika.com', requestId);
    const signed = new URL(signedUrl);
    const response = await onRequest({
      request: new Request('https://hundesalon-nika.com/api/booking-confirm', {
        method: 'POST',
        headers: {
          'CF-Connecting-IP': crypto.randomUUID(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: signed.searchParams.toString(),
      }),
      env,
    });
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Запись подтверждена/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a transport failure after email confirmation asks for a safe retry instead of claiming Calendar was unchanged', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('gateway timeout');
  };
  try {
    const gatewayEnv = { ...env, GOOGLE_APPS_SCRIPT_WEBHOOK_URL: 'https://script.google.com/test' };
    const signedUrl = await buildBookingConfirmationUrl(gatewayEnv, 'https://hundesalon-nika.com', requestId);
    const signed = new URL(signedUrl);
    const response = await onRequest({
      request: new Request('https://hundesalon-nika.com/api/booking-confirm', {
        method: 'POST',
        headers: {
          'CF-Connecting-IP': crypto.randomUUID(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: signed.searchParams.toString(),
      }),
      env: gatewayEnv,
    });
    assert.equal(response.status, 503);
    assert.match(await response.text(), /Событие могло быть создано/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
