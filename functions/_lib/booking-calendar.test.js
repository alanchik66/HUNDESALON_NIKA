import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

import { confirmGoogleBooking } from './booking-calendar.js';

const requestId = '12345678-1234-4123-8123-123456789abc';
const eventId = `booking${requestId.replace(/-/g, '')}`;
const env = {
  GOOGLE_OAUTH_ACCESS_TOKEN: 'access-token',
  GOOGLE_CALENDAR_ID: 'calendar@example.com',
  SHEET_ID: 'sheet-id',
};

function bookingRow({ status = 'pending', confirmedAt = '', existingEventId = '' } = {}) {
  const row = Array(34).fill('');
  Object.assign(row, {
    3: 'Test Customer',
    4: 'customer@example.com',
    5: '+49 341 000000',
    6: 'Komplettpflege',
    7: '2030-01-02',
    8: '10:00',
    9: 'https://1drv.ms/i/photo',
    11: 'Please call',
    13: 'Nika',
    15: 'Pudel',
    28: requestId,
    29: status,
    30: confirmedAt,
    31: existingEventId,
    32: '2030-01-02T10:00:00',
    33: '2030-01-02T12:00:00',
  });
  return row;
}

function calendarEvent() {
  return {
    id: eventId,
    status: 'confirmed',
    created: '2030-01-01T00:00:00Z',
    start: { dateTime: '2030-01-02T10:00:00+01:00' },
    end: { dateTime: '2030-01-02T12:00:00+01:00' },
    extendedProperties: { private: { bookingRequestId: requestId } },
  };
}

test('creates one deterministic confirmed calendar event and updates the booking row', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    calls.push({ target, options });
    if (target.includes('/values/bookings!A1%3AAH')) return Response.json({ values: [[], bookingRow()] });
    if (target.endsWith(`/events/${eventId}`)) return Response.json({}, { status: 404 });
    if (target.endsWith('/calendar/v3/freeBusy')) {
      return Response.json({ calendars: { 'calendar@example.com': { busy: [] } } });
    }
    if (target.endsWith('/events') && options.method === 'POST') return Response.json(calendarEvent());
    if (target.includes('/events?')) return Response.json({ items: [calendarEvent()] });
    if (target.includes('/values/bookings!AD2%3AAF2')) return Response.json({ updatedRange: 'bookings!AD2:AF2' });
    throw new Error(`Unexpected fetch: ${target}`);
  };

  try {
    const result = await confirmGoogleBooking(env, requestId);
    assert.equal(result.ok, true);
    assert.equal(result.eventId, eventId);
    const calendarCall = calls.find(
      call => call.target.includes('/calendar/v3/calendars/') && call.options.method === 'POST'
    );
    const event = JSON.parse(calendarCall.options.body);
    assert.equal(event.id, eventId);
    assert.equal(event.status, 'confirmed');
    assert.equal(event.visibility, 'private');
    assert.equal(event.extendedProperties.private.bookingRequestId, requestId);
    const sheetCall = calls.find(call => call.target.includes('/values/bookings!AD2%3AAF2'));
    assert.deepEqual(JSON.parse(sheetCall.options.body).values[0].slice(0, 1), ['confirmed']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('returns an already confirmed booking without creating or updating anything', async () => {
  const originalFetch = globalThis.fetch;
  let writeCalls = 0;
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.includes('/values/bookings!A1%3AAH')) {
      return Response.json({ values: [[], bookingRow({ status: 'confirmed', existingEventId: eventId })] });
    }
    if (options.method === 'POST' || options.method === 'PUT') writeCalls += 1;
    throw new Error(`Unexpected fetch: ${target}`);
  };

  try {
    const result = await confirmGoogleBooking(env, requestId);
    assert.equal(result.ok, true);
    assert.equal(result.deduplicated, true);
    assert.equal(writeCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('recovers an event created by a concurrent confirmation without creating a duplicate', async () => {
  const originalFetch = globalThis.fetch;
  let calendarPosts = 0;
  let eventReads = 0;
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.includes('/values/bookings!A1%3AAH')) return Response.json({ values: [[], bookingRow()] });
    if (target.endsWith(`/events/${eventId}`)) {
      eventReads += 1;
      return eventReads === 1 ? Response.json({}, { status: 404 }) : Response.json(calendarEvent());
    }
    if (target.endsWith('/calendar/v3/freeBusy')) {
      return Response.json({ calendars: { 'calendar@example.com': { busy: [] } } });
    }
    if (target.endsWith('/events') && options.method === 'POST') {
      calendarPosts += 1;
      return Response.json({ error: { code: 409 } }, { status: 409 });
    }
    if (target.includes('/events?')) return Response.json({ items: [calendarEvent()] });
    if (target.includes('/values/bookings!AD2%3AAF2')) return Response.json({ updatedRange: 'bookings!AD2:AF2' });
    throw new Error(`Unexpected fetch: ${target}`);
  };

  try {
    const result = await confirmGoogleBooking(env, requestId);
    assert.equal(result.ok, true);
    assert.equal(result.deduplicated, true);
    assert.equal(calendarPosts, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('arbitrates a recovered deterministic event and removes only that event when a manual event overlaps', async () => {
  const originalFetch = globalThis.fetch;
  const deleted = [];
  let sheetUpdates = 0;
  const manualEvent = {
    id: 'manual-event',
    created: '2031-01-01T00:00:00Z',
    status: 'confirmed',
    start: { dateTime: '2030-01-02T10:30:00+01:00' },
    end: { dateTime: '2030-01-02T11:00:00+01:00' },
  };
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.includes('/values/bookings!A1%3AAH')) return Response.json({ values: [[], bookingRow()] });
    if (target.endsWith(`/events/${eventId}`) && options.method === 'DELETE') {
      deleted.push(target);
      return new Response(null, { status: 204 });
    }
    if (target.endsWith(`/events/${eventId}`)) return Response.json(calendarEvent());
    if (target.includes('/events?')) return Response.json({ items: [calendarEvent(), manualEvent] });
    if (target.includes('/values/bookings!AD2%3AAF2')) {
      sheetUpdates += 1;
      return Response.json({ updatedRange: 'bookings!AD2:AF2' });
    }
    throw new Error(`Unexpected fetch: ${target}`);
  };

  try {
    const result = await confirmGoogleBooking(env, requestId);
    assert.deepEqual(result, { ok: false, reason: 'slot_conflict' });
    assert.equal(deleted.length, 1);
    assert.ok(deleted[0].endsWith(`/events/${eventId}`));
    assert.equal(sheetUpdates, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

for (const [label, mutationResponse] of [
  ['server error', Response.json({}, { status: 500 })],
  ['malformed success', Response.json({ id: 'unexpected-event' })],
]) {
  test(`reconciles a calendar create ${label} before confirming the Sheet`, async () => {
    const originalFetch = globalThis.fetch;
    let eventReads = 0;
    globalThis.fetch = async (url, options = {}) => {
      const target = String(url);
      if (target.includes('/values/bookings!A1%3AAH')) return Response.json({ values: [[], bookingRow()] });
      if (target.endsWith(`/events/${eventId}`)) {
        eventReads += 1;
        return eventReads === 1 ? Response.json({}, { status: 404 }) : Response.json(calendarEvent());
      }
      if (target.endsWith('/calendar/v3/freeBusy')) {
        return Response.json({ calendars: { 'calendar@example.com': { busy: [] } } });
      }
      if (target.endsWith('/events') && options.method === 'POST') return mutationResponse.clone();
      if (target.includes('/events?')) return Response.json({ items: [calendarEvent()] });
      if (target.includes('/values/bookings!AD2%3AAF2')) {
        return Response.json({ updatedRange: 'bookings!AD2:AF2' });
      }
      throw new Error(`Unexpected fetch: ${target}`);
    };

    try {
      const result = await confirmGoogleBooking(env, requestId);
      assert.equal(result.ok, true);
      assert.equal(result.deduplicated, true);
      assert.equal(eventReads, 2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
}

test('keeps a calendar create server error pending when deterministic reconciliation finds no event', async () => {
  const originalFetch = globalThis.fetch;
  let eventReads = 0;
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.includes('/values/bookings!A1%3AAH')) return Response.json({ values: [[], bookingRow()] });
    if (target.endsWith(`/events/${eventId}`)) {
      eventReads += 1;
      return Response.json({}, { status: 404 });
    }
    if (target.endsWith('/calendar/v3/freeBusy')) {
      return Response.json({ calendars: { 'calendar@example.com': { busy: [] } } });
    }
    if (target.endsWith('/events') && options.method === 'POST') return Response.json({}, { status: 500 });
    throw new Error(`Unexpected fetch: ${target}`);
  };

  try {
    const result = await confirmGoogleBooking(env, requestId);
    assert.deepEqual(result, { ok: false, reason: 'confirmation_pending', partial: true });
    assert.equal(eventReads, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('does not confirm a rejected booking', async () => {
  const originalFetch = globalThis.fetch;
  let calendarCalls = 0;
  globalThis.fetch = async url => {
    const target = String(url);
    if (target.includes('/values/bookings!A1%3AAH')) {
      return Response.json({ values: [[], bookingRow({ status: 'rejected' })] });
    }
    calendarCalls += 1;
    throw new Error(`Unexpected fetch: ${target}`);
  };
  try {
    const result = await confirmGoogleBooking(env, requestId);
    assert.deepEqual(result, { ok: false, reason: 'invalid_state' });
    assert.equal(calendarCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('does not create an event when the requested slot is already busy', async () => {
  const originalFetch = globalThis.fetch;
  let calendarPosts = 0;
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.includes('/values/bookings!A1%3AAH')) return Response.json({ values: [[], bookingRow()] });
    if (target.endsWith(`/events/${eventId}`)) return Response.json({}, { status: 404 });
    if (target.endsWith('/calendar/v3/freeBusy')) {
      return Response.json({
        calendars: {
          'calendar@example.com': { busy: [{ start: '2030-01-02T09:00:00Z', end: '2030-01-02T11:00:00Z' }] },
        },
      });
    }
    if (target.endsWith('/events') && options.method === 'POST') calendarPosts += 1;
    throw new Error(`Unexpected fetch: ${target}`);
  };
  try {
    const result = await confirmGoogleBooking(env, requestId);
    assert.deepEqual(result, { ok: false, reason: 'slot_conflict' });
    assert.equal(calendarPosts, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

for (const gatewayResponse of [Response.json({}, { status: 200 }), Response.json({}, { status: 500 })]) {
  test(`fails closed when the configured Apps Script gateway returns ${gatewayResponse.status}`, async () => {
    const originalFetch = globalThis.fetch;
    const targets = [];
    globalThis.fetch = async url => {
      targets.push(String(url));
      return gatewayResponse.clone();
    };
    try {
      const result = await confirmGoogleBooking(
        { ...env, GOOGLE_APPS_SCRIPT_WEBHOOK_URL: 'https://script.google.com/test' },
        requestId
      );
      assert.deepEqual(result, { ok: false, reason: 'confirmation_pending', partial: true });
      assert.deepEqual(targets, ['https://script.google.com/test']);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
}

test('treats a configured Apps Script transport failure as an uncertain confirmation without direct fallback', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error('gateway timeout');
  };
  try {
    const result = await confirmGoogleBooking(
      { ...env, GOOGLE_APPS_SCRIPT_WEBHOOK_URL: 'https://script.google.com/test' },
      requestId
    );
    assert.deepEqual(result, { ok: false, reason: 'confirmation_pending', partial: true });
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('accepts an atomic Apps Script confirmation when SHEET_ID lives only in Script Properties', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    assert.equal(String(url), 'https://script.google.com/test');
    return Response.json({ success: true, eventId, booking: { name: 'Test Customer' } });
  };
  try {
    const result = await confirmGoogleBooking(
      { GOOGLE_APPS_SCRIPT_WEBHOOK_URL: 'https://script.google.com/test' },
      requestId
    );
    assert.equal(result.ok, true);
    assert.equal(result.eventId, eventId);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('reports a partial failure when a losing concurrent event cannot be removed', async () => {
  const originalFetch = globalThis.fetch;
  const conflictingEvent = {
    id: 'other-event',
    created: '2029-12-31T23:59:59Z',
    status: 'confirmed',
    start: { dateTime: '2030-01-02T10:00:00+01:00' },
    end: { dateTime: '2030-01-02T12:00:00+01:00' },
  };
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.includes('/values/bookings!A1%3AAH')) return Response.json({ values: [[], bookingRow()] });
    if (target.endsWith(`/events/${eventId}`) && options.method === 'DELETE') {
      throw new Error('cleanup timeout');
    }
    if (target.endsWith(`/events/${eventId}`)) return Response.json({}, { status: 404 });
    if (target.endsWith('/calendar/v3/freeBusy')) {
      return Response.json({ calendars: { 'calendar@example.com': { busy: [] } } });
    }
    if (target.endsWith('/events') && options.method === 'POST') return Response.json(calendarEvent());
    if (target.includes('/events?')) return Response.json({ items: [conflictingEvent, calendarEvent()] });
    throw new Error(`Unexpected fetch: ${target}`);
  };
  try {
    const result = await confirmGoogleBooking(env, requestId);
    assert.deepEqual(result, { ok: false, reason: 'calendar_cleanup_failed', partial: true });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('reports that confirmation may be pending when the calendar event exists but the Sheet update fails', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.includes('/values/bookings!A1%3AAH')) return Response.json({ values: [[], bookingRow()] });
    if (target.endsWith(`/events/${eventId}`)) return Response.json({}, { status: 404 });
    if (target.endsWith('/calendar/v3/freeBusy')) {
      return Response.json({ calendars: { 'calendar@example.com': { busy: [] } } });
    }
    if (target.endsWith('/events') && options.method === 'POST') return Response.json(calendarEvent());
    if (target.includes('/events?')) return Response.json({ items: [calendarEvent()] });
    if (target.includes('/values/bookings!AD2%3AAF2')) throw new Error('sheet update timeout');
    throw new Error(`Unexpected fetch: ${target}`);
  };
  try {
    const result = await confirmGoogleBooking(env, requestId);
    assert.deepEqual(result, { ok: false, reason: 'confirmation_pending', partial: true });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('reports an uncertain confirmation when the calendar create request times out', async () => {
  const originalFetch = globalThis.fetch;
  let eventReads = 0;
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.includes('/values/bookings!A1%3AAH')) return Response.json({ values: [[], bookingRow()] });
    if (target.endsWith(`/events/${eventId}`)) {
      eventReads += 1;
      return Response.json({}, { status: 404 });
    }
    if (target.endsWith('/calendar/v3/freeBusy')) {
      return Response.json({ calendars: { 'calendar@example.com': { busy: [] } } });
    }
    if (target.endsWith('/events') && options.method === 'POST') throw new Error('calendar create timeout');
    throw new Error(`Unexpected fetch: ${target}`);
  };
  try {
    const result = await confirmGoogleBooking(env, requestId);
    assert.deepEqual(result, { ok: false, reason: 'confirmation_pending', partial: true });
    assert.equal(eventReads, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Apps Script preserves its event and reports a partial failure when the latest Sheet reread fails after create', () => {
  const source = readFileSync(
    new URL('../../integrations/google-apps-script-gateway/Code.gs', import.meta.url),
    'utf8'
  );
  let sheetReads = 0;
  let cleanupAttempts = 0;
  const row = bookingRow();
  const sheet = {
    getLastRow: () => 2,
    getRange: () => ({ getValues: () => [Array(34).fill('')], setValues: () => {} }),
    getDataRange: () => ({
      getValues: () => {
        sheetReads += 1;
        if (sheetReads === 1) return [[], row];
        throw new Error('sheet reread failed');
      },
    }),
  };
  const context = {
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: key => ({ SHEET_ID: 'sheet-id', CALENDAR_ID: 'calendar@example.com' })[key] || '',
      }),
    },
    SpreadsheetApp: {
      openById: () => ({ getSheetByName: () => sheet }),
      flush: () => {},
    },
    CalendarApp: {
      getCalendarById: () => ({
        getEvents: () => [],
        createEvent: () => ({
          getId: () => 'apps-script-event',
          getDescription: () => `booking_request_id=${requestId}`,
          getDateCreated: () => new Date('2030-01-01T00:00:00Z'),
          deleteEvent: () => {
            cleanupAttempts += 1;
          },
        }),
      }),
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    Utilities: { parseDate: value => new Date(`${value}+01:00`) },
  };
  runInNewContext(source, context);
  const result = runInNewContext(`confirmBooking(${JSON.stringify({ requestId })})`, context);

  assert.equal(cleanupAttempts, 0);
  assert.equal(result.success, false);
  assert.equal(result.reason, 'sheet_update_failed');
  assert.equal(result.partial, true);
});

test('Apps Script reports an uncertain confirmation when calendar creation throws', () => {
  const source = readFileSync(
    new URL('../../integrations/google-apps-script-gateway/Code.gs', import.meta.url),
    'utf8'
  );
  const row = bookingRow();
  const sheet = {
    getLastRow: () => 2,
    getRange: () => ({ getValues: () => [Array(34).fill('')], setValues: () => {} }),
    getDataRange: () => ({ getValues: () => [[], row] }),
  };
  const context = {
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: key => ({ SHEET_ID: 'sheet-id', CALENDAR_ID: 'calendar@example.com' })[key] || '',
      }),
    },
    SpreadsheetApp: {
      openById: () => ({ getSheetByName: () => sheet }),
      flush: () => {},
    },
    CalendarApp: {
      getCalendarById: () => ({
        getEvents: () => [],
        createEvent: () => {
          throw new Error('calendar create timeout');
        },
      }),
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    Utilities: { parseDate: value => new Date(`${value}+01:00`) },
  };
  runInNewContext(source, context);
  const result = runInNewContext(`confirmBooking(${JSON.stringify({ requestId })})`, context);

  assert.deepEqual(
    { success: result.success, reason: result.reason, partial: result.partial },
    { success: false, reason: 'confirmation_pending', partial: true }
  );
});

test('Apps Script removes only its recovered booking event when a manual event overlaps', () => {
  const source = readFileSync(
    new URL('../../integrations/google-apps-script-gateway/Code.gs', import.meta.url),
    'utf8'
  );
  let ownDeletes = 0;
  let manualDeletes = 0;
  let sheetWrites = 0;
  const row = bookingRow();
  const ownEvent = {
    getId: () => 'apps-script-event',
    getDescription: () => `booking_request_id=${requestId}`,
    getDateCreated: () => new Date('2030-01-01T00:00:00Z'),
    deleteEvent: () => {
      ownDeletes += 1;
    },
  };
  const manualEvent = {
    getId: () => 'manual-event',
    getDescription: () => '',
    getDateCreated: () => new Date('2031-01-01T00:00:00Z'),
    deleteEvent: () => {
      manualDeletes += 1;
    },
  };
  const sheet = {
    getLastRow: () => 2,
    getRange: (_row, column) => ({
      getValues: () => [Array(34).fill('')],
      setValues: () => {
        if (column === 30) sheetWrites += 1;
      },
    }),
    getDataRange: () => ({ getValues: () => [[], row] }),
  };
  const context = {
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: key => ({ SHEET_ID: 'sheet-id', CALENDAR_ID: 'calendar@example.com' })[key] || '',
      }),
    },
    SpreadsheetApp: {
      openById: () => ({ getSheetByName: () => sheet }),
      flush: () => {},
    },
    CalendarApp: {
      getCalendarById: () => ({
        getEvents: () => [ownEvent, manualEvent],
        createEvent: () => {
          throw new Error('should not create');
        },
      }),
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    Utilities: { parseDate: value => new Date(`${value}+01:00`) },
  };
  runInNewContext(source, context);
  const result = runInNewContext(`confirmBooking(${JSON.stringify({ requestId })})`, context);

  assert.equal(result.success, false);
  assert.equal(result.reason, 'slot_conflict');
  assert.equal(ownDeletes, 1);
  assert.equal(manualDeletes, 0);
  assert.equal(sheetWrites, 0);
});
