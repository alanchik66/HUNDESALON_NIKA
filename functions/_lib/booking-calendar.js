import {
  callGoogleAppsScriptGateway,
  cleanText,
  getEnvValue,
  getGoogleAccessToken,
  getGoogleOAuthAccessToken,
  safeJsonFetch,
} from './platform-integrations.js';

const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';
const GOOGLE_SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const REQUEST_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOCAL_DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
const GATEWAY_REASONS = new Set([
  'booking_not_found',
  'calendar_cleanup_failed',
  'calendar_unavailable',
  'confirmation_pending',
  'invalid_booking',
  'invalid_booking_time',
  'invalid_state',
  'sheet_unavailable',
  'sheet_update_failed',
  'slot_conflict',
]);

const BOOKING_COLUMN = Object.freeze({
  name: 3,
  email: 4,
  phone: 5,
  service: 6,
  date: 7,
  time: 8,
  fileUrl: 9,
  message: 11,
  petName: 13,
  petBreed: 15,
  requestId: 28,
  calendarStatus: 29,
  calendarEventId: 31,
  calendarStart: 32,
  calendarEnd: 33,
});

async function bookingJsonFetch(url, options) {
  try {
    const response = await safeJsonFetch(url, options);
    if (!response.ok && response.status !== 404 && response.status !== 409) {
      // Log provider status only: URLs, tokens and booking data stay private.
      console.warn(
        JSON.stringify({
          event: 'booking_google_request_failed',
          operation: options?.method || 'GET',
          provider: String(url).includes('/calendar/') ? 'calendar' : 'sheets',
          status: response.status,
          code: response.body?.error?.status || '',
          reason: response.body?.error?.errors?.[0]?.reason || '',
        })
      );
    }
    return response;
  } catch {
    return { ok: false, status: 0, body: null, networkError: true };
  }
}

function bookingValue(row, key, limit = 300) {
  return cleanText(row?.[BOOKING_COLUMN[key]], limit);
}

function bookingResult(row) {
  return {
    name: bookingValue(row, 'name', 120),
    service: bookingValue(row, 'service', 180),
    date: bookingValue(row, 'date', 16),
    time: bookingValue(row, 'time', 16),
    petName: bookingValue(row, 'petName', 120),
    petBreed: bookingValue(row, 'petBreed', 160),
  };
}

function findBookingRow(rows, requestId) {
  const rowOffset = rows.findIndex(
    (row, index) => index > 0 && cleanText(row?.[BOOKING_COLUMN.requestId], 36).toLowerCase() === requestId
  );
  return rowOffset > 0 ? { row: rows[rowOffset], rowOffset } : null;
}

async function googleToken(env) {
  return (
    (await getGoogleAccessToken(env, [GOOGLE_CALENDAR_SCOPE, GOOGLE_SHEETS_SCOPE])) ||
    (await getGoogleOAuthAccessToken(env))
  );
}

async function readBookingRows(spreadsheetId, authHeaders) {
  const valuesRange = encodeURIComponent('bookings!A1:AH');
  const response = await bookingJsonFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${valuesRange}`,
    { headers: authHeaders }
  );
  return { ok: response.ok, rows: Array.isArray(response.body?.values) ? response.body.values : [] };
}

function berlinOffsetMilliseconds(at) {
  const zone = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin',
    timeZoneName: 'longOffset',
  })
    .formatToParts(at)
    .find(part => part.type === 'timeZoneName')?.value;
  const match = String(zone || '').match(/^GMT([+-])(\d{2}):?(\d{2})$/);
  if (!match) return Number.NaN;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return (match[1] === '-' ? -minutes : minutes) * 60 * 1000;
}

function formatBerlinLocal(at) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const value = type => parts.find(part => part.type === type)?.value || '';
  return `${value('year')}-${value('month')}-${value('day')}T${value('hour')}:${value('minute')}:${value('second')}`;
}

function berlinLocalToUtc(value) {
  if (!LOCAL_DATE_TIME_RE.test(value)) return '';
  const naive = Date.parse(`${value}Z`);
  if (!Number.isFinite(naive)) return '';
  let utc = naive;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const offset = berlinOffsetMilliseconds(new Date(utc));
    if (!Number.isFinite(offset)) return '';
    utc = naive - offset;
  }
  const result = new Date(utc);
  return formatBerlinLocal(result) === value ? result.toISOString() : '';
}

function matchesBookingEvent(event, eventId, requestId) {
  return (
    cleanText(event?.id, 220) === eventId &&
    event?.status === 'confirmed' &&
    cleanText(event?.extendedProperties?.private?.bookingRequestId, 36).toLowerCase() === requestId
  );
}

function eventOverlaps(event, startMs, endMs) {
  if (!event || event.status === 'cancelled' || event.transparency === 'transparent') return false;
  const start = Date.parse(event.start?.dateTime || event.start?.date || '');
  const end = Date.parse(event.end?.dateTime || event.end?.date || '');
  return Number.isFinite(start) && Number.isFinite(end) && start < endMs && end > startMs;
}

function isManagedBookingEvent(event) {
  return Boolean(
    cleanText(event?.extendedProperties?.private?.bookingRequestId, 36) ||
    /(?:^|\n)booking_request_id=[0-9a-f-]{36}(?:\n|$)/i.test(String(event?.description || ''))
  );
}

async function deleteCalendarEvent(eventUrl, eventId, authHeaders) {
  const response = await bookingJsonFetch(`${eventUrl}/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    headers: authHeaders,
  });
  return response.ok || response.status === 404 || response.status === 410;
}

async function resolveConcurrentSlot({ eventUrl, event, eventId, authHeaders, timeMin, timeMax }) {
  const query = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    showDeleted: 'false',
    maxResults: '50',
  });
  const response = await bookingJsonFetch(`${eventUrl}?${query.toString()}`, { headers: authHeaders });
  if (!response.ok) return { ok: false, reason: 'calendar_unavailable' };
  const startMs = Date.parse(timeMin);
  const endMs = Date.parse(timeMax);
  const candidates = Array.isArray(response.body?.items)
    ? response.body.items.filter(candidate => eventOverlaps(candidate, startMs, endMs))
    : [];
  if (!candidates.some(candidate => candidate?.id === eventId)) candidates.push(event);
  if (candidates.some(candidate => candidate?.id !== eventId && !isManagedBookingEvent(candidate))) {
    return { ok: false, reason: 'slot_conflict' };
  }
  const bookingCandidates = candidates.filter(isManagedBookingEvent);
  bookingCandidates.sort((left, right) => {
    const byCreated = String(left?.created || '9999-12-31T23:59:59.999Z').localeCompare(
      String(right?.created || '9999-12-31T23:59:59.999Z')
    );
    return byCreated || String(left?.id || '').localeCompare(String(right?.id || ''));
  });
  return bookingCandidates[0]?.id === eventId ? { ok: true } : { ok: false, reason: 'slot_conflict' };
}

export async function confirmGoogleBooking(env, requestId) {
  const safeRequestId = cleanText(requestId, 36).toLowerCase();
  const spreadsheetId = cleanText(getEnvValue(env, 'SHEET_ID'), 220);
  const calendarId = cleanText(getEnvValue(env, 'GOOGLE_CALENDAR_ID', 'primary'), 220) || 'primary';
  if (!REQUEST_ID_RE.test(safeRequestId)) return { ok: false, reason: 'invalid_booking' };

  let gateway;
  try {
    gateway = await callGoogleAppsScriptGateway(env, 'booking_confirm', {
      requestId: safeRequestId,
      spreadsheetId,
      calendarId,
    });
  } catch {
    return { ok: false, reason: 'confirmation_pending', partial: true };
  }
  if (!gateway.skipped) {
    const reason = cleanText(gateway.body?.reason, 80);
    const eventId = cleanText(gateway.body?.eventId, 220);
    if (gateway.ok && gateway.body?.success === true && eventId) {
      return {
        ok: true,
        deduplicated: gateway.body?.deduplicated === true,
        eventId,
        confirmedAt: cleanText(gateway.body?.confirmedAt, 80),
        booking: gateway.body?.booking || {},
      };
    }
    if (Number(gateway.status) >= 500) {
      return { ok: false, reason: 'confirmation_pending', partial: true };
    }
    if (GATEWAY_REASONS.has(reason)) {
      return { ok: false, reason, partial: gateway.body?.partial === true };
    }
    return { ok: false, reason: 'confirmation_pending', partial: true };
  }

  if (!spreadsheetId) return { ok: false, reason: 'invalid_booking' };

  let token;
  try {
    token = await googleToken(env);
  } catch {
    return { ok: false, reason: 'calendar_unavailable', stage: 'token' };
  }
  if (!token) return { ok: false, reason: 'google_not_configured' };
  const authHeaders = { Authorization: `Bearer ${token}` };
  const initialSheet = await readBookingRows(spreadsheetId, authHeaders);
  const initialMatch = findBookingRow(initialSheet.rows, safeRequestId);
  if (!initialSheet.ok || !initialMatch) {
    return { ok: false, reason: initialSheet.ok ? 'booking_not_found' : 'sheet_unavailable' };
  }

  const initialStatus = bookingValue(initialMatch.row, 'calendarStatus', 32).toLowerCase();
  const initialEventId = bookingValue(initialMatch.row, 'calendarEventId', 220);
  if (initialStatus === 'confirmed' && initialEventId) {
    return { ok: true, deduplicated: true, eventId: initialEventId, booking: bookingResult(initialMatch.row) };
  }
  if (initialStatus !== 'pending') return { ok: false, reason: 'invalid_state' };

  // Sheets USER_ENTERED dates can be rendered with a space instead of ISO's T.
  // Normalize only that separator; keep strict date/DST validation below.
  const startDateTime = bookingValue(initialMatch.row, 'calendarStart', 32).replace(
    /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/,
    '$1T$2'
  );
  const endDateTime = bookingValue(initialMatch.row, 'calendarEnd', 32).replace(
    /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/,
    '$1T$2'
  );
  const timeMin = berlinLocalToUtc(startDateTime);
  const timeMax = berlinLocalToUtc(endDateTime);
  if (!timeMin || !timeMax || Date.parse(timeMax) <= Date.parse(timeMin)) {
    return { ok: false, reason: 'invalid_booking_time' };
  }

  const deterministicEventId = `booking${safeRequestId.replace(/-/g, '')}`;
  const eventUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
  const existing = await bookingJsonFetch(`${eventUrl}/${encodeURIComponent(deterministicEventId)}`, {
    headers: authHeaders,
  });
  let event;
  let deduplicated = false;
  let createdNow = false;
  if (existing.ok) {
    if (!matchesBookingEvent(existing.body, deterministicEventId, safeRequestId)) {
      return { ok: false, reason: 'calendar_unavailable', stage: 'event_identity' };
    }
    event = existing.body;
    deduplicated = true;
  } else if (existing.status === 404) {
    const freeBusy = await bookingJsonFetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeMin, timeMax, items: [{ id: calendarId }] }),
    });
    const busy = freeBusy.body?.calendars?.[calendarId]?.busy;
    if (!freeBusy.ok || !Array.isArray(busy)) return { ok: false, reason: 'calendar_unavailable', stage: 'free_busy' };
    if (busy.length) return { ok: false, reason: 'slot_conflict' };

    const row = initialMatch.row;
    const description = [
      `booking_request_id=${safeRequestId}`,
      `Name: ${bookingValue(row, 'name', 120)}`,
      `E-mail: ${bookingValue(row, 'email', 180)}`,
      `Phone: ${bookingValue(row, 'phone', 80)}`,
      `Pet: ${bookingValue(row, 'petName', 120)} (${bookingValue(row, 'petBreed', 160)})`,
      bookingValue(row, 'fileUrl', 1000) ? `OneDrive: ${bookingValue(row, 'fileUrl', 1000)}` : '',
      bookingValue(row, 'message', 1000) ? `Message: ${bookingValue(row, 'message', 1000)}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    const created = await bookingJsonFetch(eventUrl, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: deterministicEventId,
        summary: `HUNDESALON NIKA: ${bookingValue(row, 'service', 180)} — ${bookingValue(row, 'name', 120)}`,
        description,
        status: 'confirmed',
        transparency: 'opaque',
        visibility: 'private',
        start: { dateTime: startDateTime, timeZone: 'Europe/Berlin' },
        end: { dateTime: endDateTime, timeZone: 'Europe/Berlin' },
        extendedProperties: { private: { bookingRequestId: safeRequestId } },
      }),
    });
    if (created.ok && matchesBookingEvent(created.body, deterministicEventId, safeRequestId)) {
      event = created.body;
      createdNow = true;
    } else if (created.status >= 400 && created.status < 500 && created.status !== 409) {
      return {
        ok: false,
        reason: 'calendar_unavailable',
        stage: 'event_create',
        providerStatus: created.status,
        calendarAlias: calendarId === 'primary' ? 'primary' : 'explicit',
      };
    } else {
      const recovered = await bookingJsonFetch(`${eventUrl}/${encodeURIComponent(deterministicEventId)}`, {
        headers: authHeaders,
      });
      if (!recovered.ok || !matchesBookingEvent(recovered.body, deterministicEventId, safeRequestId)) {
        return { ok: false, reason: 'confirmation_pending', partial: true };
      }
      event = recovered.body;
      deduplicated = true;
    }
  } else {
    return { ok: false, reason: 'calendar_unavailable', stage: 'event_read' };
  }

  const race = await resolveConcurrentSlot({
    eventUrl,
    event,
    eventId: deterministicEventId,
    authHeaders,
    timeMin,
    timeMax,
  });
  if (!race.ok) {
    if (race.reason !== 'slot_conflict' && !createdNow) {
      return { ok: false, reason: 'confirmation_pending', partial: true };
    }
    const cleaned = await deleteCalendarEvent(eventUrl, deterministicEventId, authHeaders);
    return cleaned ? race : { ok: false, reason: 'calendar_cleanup_failed', partial: true };
  }

  const latestSheet = await readBookingRows(spreadsheetId, authHeaders);
  const latestMatch = findBookingRow(latestSheet.rows, safeRequestId);
  if (!latestSheet.ok || !latestMatch) {
    if (createdNow || (latestSheet.ok && !latestMatch)) {
      const cleaned = await deleteCalendarEvent(eventUrl, deterministicEventId, authHeaders);
      if (!cleaned) return { ok: false, reason: 'calendar_cleanup_failed', partial: true };
    }
    if (!latestSheet.ok && !createdNow) {
      return { ok: false, reason: 'confirmation_pending', partial: true };
    }
    return { ok: false, reason: latestSheet.ok ? 'booking_not_found' : 'sheet_unavailable' };
  }
  const latestStatus = bookingValue(latestMatch.row, 'calendarStatus', 32).toLowerCase();
  const latestEventId = bookingValue(latestMatch.row, 'calendarEventId', 220);
  if (latestStatus === 'confirmed' && latestEventId === deterministicEventId) {
    return { ok: true, deduplicated: true, eventId: deterministicEventId, booking: bookingResult(latestMatch.row) };
  }
  if (latestStatus !== 'pending') {
    const cleaned = await deleteCalendarEvent(eventUrl, deterministicEventId, authHeaders);
    if (!cleaned) return { ok: false, reason: 'calendar_cleanup_failed', partial: true };
    return { ok: false, reason: 'invalid_state' };
  }

  const confirmedAt = new Date().toISOString();
  const sheetRowNumber = latestMatch.rowOffset + 1;
  const updateRange = encodeURIComponent(`bookings!AD${sheetRowNumber}:AF${sheetRowNumber}`);
  const update = await bookingJsonFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${updateRange}?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [['confirmed', confirmedAt, deterministicEventId]] }),
    }
  );
  if (update.networkError) return { ok: false, reason: 'confirmation_pending', partial: true };
  if (!update.ok) return { ok: false, reason: 'confirmation_pending', partial: true };

  return {
    ok: true,
    deduplicated,
    eventId: deterministicEventId,
    confirmedAt,
    booking: bookingResult(latestMatch.row),
  };
}
