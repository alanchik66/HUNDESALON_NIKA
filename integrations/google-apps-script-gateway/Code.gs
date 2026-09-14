const PROPS = PropertiesService.getScriptProperties();

const SHEET_HEADERS = {
  bookings: [
    'created_at',
    'lang',
    'form_type',
    'name',
    'email',
    'phone',
    'service',
    'date',
    'time',
    'file_url',
    'payment_status',
    'message',
    'client_registration_id',
    'pet_name',
    'pet_species',
    'pet_breed',
    'pet_age',
    'pet_sex',
    'pet_tag_number',
    'service_price',
    'service_category',
    'booking_status',
    'client_type',
    'coat_condition',
    'behaviour',
    'estimated_duration_minutes',
    'booking_buffer_minutes',
    'safe_block_minutes',
    'request_id',
    'calendar_status',
    'calendar_confirmed_at',
    'calendar_event_id',
    'calendar_start',
    'calendar_end',
  ],
  subscribers: ['created_at', 'email', 'lang', 'page', 'origin', 'consent'],
  clients: [
    'submitted_at',
    'request_id',
    'lang',
    'form_type',
    'service',
    'service_price',
    'service_category',
    'promotion_key',
    'date',
    'time',
    'name',
    'email',
    'phone',
    'pet_name',
    'pet_species',
    'pet_breed',
    'pet_age',
    'pet_sex',
    'pet_tag_number',
    'message',
    'privacy_consent',
    'agb_consent',
    'source',
    'origin',
    'path',
  ],
  payments: [
    'created_at',
    'session_id',
    'payment_status',
    'amount_total',
    'currency',
    'lang',
    'name',
    'email',
    'phone',
    'service',
    'date',
    'time',
  ],
};

function setGatewaySecret(secret) {
  PROPS.setProperty('GATEWAY_SECRET', String(secret || '').trim());
  return { success: true };
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function requireSecret(payload) {
  const expected = String(PROPS.getProperty('GATEWAY_SECRET') || '').trim();
  const provided = String(payload.secret || '').trim();
  if (!expected || provided !== expected) {
    throw new Error('Forbidden');
  }
}

function ensureSheetHeaders(sheet, name) {
  const headers = SHEET_HEADERS[name] || [];
  if (!headers.length) return sheet;

  const range = sheet.getRange(1, 1, 1, headers.length);
  const existing = sheet.getLastRow() > 0 ? range.getValues()[0] : [];
  const merged = headers.map((header, index) => String(existing[index] || '').trim() || header);
  const needsUpdate =
    existing.length === 0 || merged.some((value, index) => value !== String(existing[index] || '').trim());

  if (needsUpdate) range.setValues([merged]);
  return sheet;
}

function getOrCreateSheet(name) {
  const sheetId = PROPS.getProperty('SHEET_ID');
  const spreadsheet = sheetId
    ? SpreadsheetApp.openById(sheetId)
    : SpreadsheetApp.create('HUNDESALON NIKA Platform Log');

  if (!sheetId) {
    PROPS.setProperty('SHEET_ID', spreadsheet.getId());
    spreadsheet.getSheets()[0].setName('bookings');
  }

  const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  return ensureSheetHeaders(sheet, name);
}

function getOrCreateCalendar() {
  const calendarId = PROPS.getProperty('CALENDAR_ID');
  if (calendarId) return CalendarApp.getCalendarById(calendarId);

  const calendar = CalendarApp.createCalendar('HUNDESALON NIKA Bookings', {
    timeZone: 'Europe/Berlin',
  });
  PROPS.setProperty('CALENDAR_ID', calendar.getId());
  return calendar;
}

function setup() {
  const calendar = getOrCreateCalendar();
  const sheet = getOrCreateSheet('bookings').getParent();
  Object.keys(SHEET_HEADERS).forEach(name => getOrCreateSheet(name));

  return {
    success: true,
    calendarId: calendar.getId(),
    spreadsheetId: sheet.getId(),
  };
}

function appendSheet(payload) {
  const sheetName = payload.sheetName || 'bookings';
  let sheet;
  if (payload.spreadsheetId) {
    const spreadsheet = SpreadsheetApp.openById(payload.spreadsheetId);
    sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
    ensureSheetHeaders(sheet, sheetName);
  } else {
    sheet = getOrCreateSheet(sheetName);
  }

  sheet.appendRow(payload.values || []);
  return { success: true, updatedRange: sheet.getName() };
}

function createCalendarEvent(payload) {
  const calendar = payload.calendarId ? CalendarApp.getCalendarById(payload.calendarId) : getOrCreateCalendar();

  const event = calendar.createEvent(
    payload.summary || 'HUNDESALON NIKA Booking',
    new Date(payload.startDateTime),
    new Date(payload.endDateTime),
    { description: payload.description || '' }
  );

  return {
    success: true,
    eventId: event.getId(),
    htmlLink: event.getHtmlLink(),
  };
}

function getCalendarBusyIntervals(payload) {
  const calendar = payload.calendarId ? CalendarApp.getCalendarById(payload.calendarId) : getOrCreateCalendar();
  if (!calendar) throw new Error('Calendar not found');

  const timeMin = new Date(payload.timeMin);
  const timeMax = new Date(payload.timeMax);
  if (!Number.isFinite(timeMin.getTime()) || !Number.isFinite(timeMax.getTime()) || timeMin >= timeMax) {
    throw new Error('Invalid free/busy time range');
  }

  const busyIntervals = calendar.getEvents(timeMin, timeMax).map(event => ({
    start: event.getStartTime().toISOString(),
    end: event.getEndTime().toISOString(),
  }));
  return { success: true, busyIntervals: busyIntervals };
}

function findBookingRecord(sheet, requestId) {
  const values = sheet.getDataRange().getValues();
  const rowOffset = values.findIndex(function (row, index) {
    return index > 0 && String(row[28] || '').trim().toLowerCase() === requestId;
  });
  return rowOffset < 1 ? null : { rowOffset: rowOffset, row: values[rowOffset] };
}

function bookingDetails(row) {
  return {
    name: String(row[3] || ''),
    service: String(row[6] || ''),
    date: String(row[7] || ''),
    time: String(row[8] || ''),
    petName: String(row[13] || ''),
    petBreed: String(row[15] || ''),
  };
}

function persistBookingConfirmation(sheet, requestId, eventId) {
  try {
    const current = findBookingRecord(sheet, requestId);
    if (!current) return { success: false, reason: 'booking_not_found' };
    const status = String(current.row[29] || '').trim().toLowerCase();
    const storedEventId = String(current.row[31] || '').trim();
    if (status === 'confirmed' && storedEventId) {
      return {
        success: true,
        deduplicated: true,
        eventId: storedEventId,
        booking: bookingDetails(current.row),
      };
    }
    if (status !== 'pending') return { success: false, reason: 'invalid_state' };
    const confirmedAt = new Date().toISOString();
    sheet.getRange(current.rowOffset + 1, 30, 1, 3).setValues([['confirmed', confirmedAt, eventId]]);
    SpreadsheetApp.flush();
    return {
      success: true,
      deduplicated: false,
      eventId: eventId,
      confirmedAt: confirmedAt,
      booking: bookingDetails(current.row),
    };
  } catch (error) {
    return { success: false, reason: 'sheet_update_failed', partial: true };
  }
}

function isManagedBookingEvent(event) {
  return /(?:^|\n)booking_request_id=[0-9a-f-]{36}(?:\n|$)/i.test(String(event.getDescription() || ''));
}

function bookingEventWins(calendar, start, end, event) {
  const eventId = String(event.getId());
  const candidates = calendar.getEvents(start, end);
  if (
    candidates.some(function (candidate) {
      return String(candidate.getId()) !== eventId && !isManagedBookingEvent(candidate);
    })
  ) {
    return false;
  }
  if (!candidates.some(function (candidate) { return String(candidate.getId()) === eventId; })) {
    candidates.push(event);
  }
  const bookingCandidates = candidates.filter(isManagedBookingEvent);
  bookingCandidates.sort(function (left, right) {
    const byCreated = left.getDateCreated().getTime() - right.getDateCreated().getTime();
    return byCreated || String(left.getId()).localeCompare(String(right.getId()));
  });
  return bookingCandidates.length > 0 && String(bookingCandidates[0].getId()) === eventId;
}

function confirmBooking(payload) {
  const requestId = String(payload.requestId || '').trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(requestId)) {
    return { success: false, reason: 'invalid_booking' };
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { success: false, reason: 'calendar_unavailable' };
  let createAttempted = false;
  let createdEvent = null;
  try {
    const spreadsheetId = String(payload.spreadsheetId || PROPS.getProperty('SHEET_ID') || '').trim();
    const spreadsheet = spreadsheetId ? SpreadsheetApp.openById(spreadsheetId) : getOrCreateSheet('bookings').getParent();
    const sheet = spreadsheet.getSheetByName('bookings');
    if (!sheet) return { success: false, reason: 'booking_not_found' };
    ensureSheetHeaders(sheet, 'bookings');
    const record = findBookingRecord(sheet, requestId);
    if (!record) return { success: false, reason: 'booking_not_found' };
    const row = record.row;
    const status = String(row[29] || '').trim().toLowerCase();
    const storedEventId = String(row[31] || '').trim();
    const booking = bookingDetails(row);
    if (status === 'confirmed' && storedEventId) {
      return { success: true, deduplicated: true, eventId: storedEventId, booking: booking };
    }
    if (status !== 'pending') return { success: false, reason: 'invalid_state' };

    const start = Utilities.parseDate(String(row[32] || ''), 'Europe/Berlin', "yyyy-MM-dd'T'HH:mm:ss");
    const end = Utilities.parseDate(String(row[33] || ''), 'Europe/Berlin', "yyyy-MM-dd'T'HH:mm:ss");
    if (!start || !end || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
      return { success: false, reason: 'invalid_booking_time' };
    }

    const calendarId = String(payload.calendarId || PROPS.getProperty('CALENDAR_ID') || '').trim();
    const calendar = calendarId ? CalendarApp.getCalendarById(calendarId) : getOrCreateCalendar();
    if (!calendar) return { success: false, reason: 'calendar_unavailable' };
    const requestMarker = 'booking_request_id=' + requestId;
    const conflicts = calendar.getEvents(start, end);
    const existing = conflicts.find(function (event) {
      return String(event.getDescription() || '').includes(requestMarker);
    });
    if (existing) {
      let existingWins;
      try {
        existingWins = bookingEventWins(calendar, start, end, existing);
      } catch (arbitrationError) {
        return { success: false, reason: 'confirmation_pending', partial: true };
      }
      if (!existingWins) {
        try {
          existing.deleteEvent();
          return { success: false, reason: 'slot_conflict' };
        } catch (cleanupError) {
          return { success: false, reason: 'calendar_cleanup_failed', partial: true };
        }
      }
      const recovered = persistBookingConfirmation(sheet, requestId, existing.getId());
      return recovered.success ? Object.assign(recovered, { deduplicated: true }) : recovered;
    }
    if (conflicts.length) return { success: false, reason: 'slot_conflict' };

    const description = [
      requestMarker,
      'Name: ' + String(row[3] || ''),
      'E-mail: ' + String(row[4] || ''),
      'Phone: ' + String(row[5] || ''),
      'Pet: ' + String(row[13] || '') + ' (' + String(row[15] || '') + ')',
      row[9] ? 'OneDrive: ' + String(row[9]) : '',
      row[11] ? 'Message: ' + String(row[11]) : '',
    ]
      .filter(Boolean)
      .join('\n');
    createAttempted = true;
    createdEvent = calendar.createEvent(
      'HUNDESALON NIKA: ' + String(row[6] || '') + ' — ' + String(row[3] || ''),
      start,
      end,
      { description: description }
    );
    let createdWins;
    try {
      createdWins = bookingEventWins(calendar, start, end, createdEvent);
    } catch (arbitrationError) {
      try {
        createdEvent.deleteEvent();
        return { success: false, reason: 'calendar_unavailable' };
      } catch (cleanupError) {
        return { success: false, reason: 'calendar_cleanup_failed', partial: true };
      }
    }
    if (!createdWins) {
      try {
        createdEvent.deleteEvent();
        return { success: false, reason: 'slot_conflict' };
      } catch (cleanupError) {
        return { success: false, reason: 'calendar_cleanup_failed', partial: true };
      }
    }
    const persisted = persistBookingConfirmation(sheet, requestId, createdEvent.getId());
    if (persisted.success && !persisted.deduplicated) return persisted;
    if (!persisted.success && persisted.partial) return persisted;
    try {
      createdEvent.deleteEvent();
    } catch (cleanupError) {
      return { success: false, reason: 'calendar_cleanup_failed', partial: true };
    }
    if (persisted.success) return persisted;
    return { success: false, reason: persisted.reason, partial: false };
  } catch (error) {
    if (createdEvent) {
      try {
        createdEvent.deleteEvent();
        return { success: false, reason: 'calendar_unavailable' };
      } catch (cleanupError) {
        return { success: false, reason: 'calendar_cleanup_failed', partial: true };
      }
    }
    if (createAttempted) return { success: false, reason: 'confirmation_pending', partial: true };
    return { success: false, reason: 'calendar_unavailable', message: error.message || 'Confirmation failed' };
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : '{}');
    requireSecret(payload);

    if (payload.action === 'setup') return jsonResponse(setup(payload));
    if (payload.action === 'sheets') return jsonResponse(appendSheet(payload));
    if (payload.action === 'calendar') return jsonResponse(createCalendarEvent(payload));
    if (payload.action === 'calendar_freebusy') return jsonResponse(getCalendarBusyIntervals(payload));
    if (payload.action === 'booking_confirm') return jsonResponse(confirmBooking(payload));

    return jsonResponse({ success: false, message: 'Unknown action' });
  } catch (error) {
    return jsonResponse({ success: false, message: error.message || 'Gateway failed' });
  }
}
