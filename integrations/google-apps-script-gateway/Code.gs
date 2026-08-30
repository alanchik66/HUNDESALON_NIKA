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

function getOrCreateFolder() {
  const folderId = PROPS.getProperty('DRIVE_FOLDER_ID');
  if (folderId) return DriveApp.getFolderById(folderId);

  const folder = DriveApp.createFolder('HUNDESALON NIKA Uploads');
  PROPS.setProperty('DRIVE_FOLDER_ID', folder.getId());
  return folder;
}

function setup() {
  const calendar = getOrCreateCalendar();
  const sheet = getOrCreateSheet('bookings').getParent();
  Object.keys(SHEET_HEADERS).forEach(name => getOrCreateSheet(name));
  const folder = getOrCreateFolder();

  return {
    success: true,
    calendarId: calendar.getId(),
    spreadsheetId: sheet.getId(),
    driveFolderId: folder.getId(),
    driveFolderUrl: folder.getUrl(),
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

function uploadDriveFile(payload) {
  const folder = getOrCreateFolder();
  const bytes = Utilities.base64Decode(payload.fileBase64 || '');
  const blob = Utilities.newBlob(
    bytes,
    payload.mimeType || 'application/octet-stream',
    payload.fileName || 'upload.bin'
  );
  const file = folder.createFile(blob);
  file.setDescription(JSON.stringify(payload.metadata || {}));

  return {
    success: true,
    fileId: file.getId(),
    fileUrl: file.getUrl(),
    webViewLink: file.getUrl(),
  };
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : '{}');
    requireSecret(payload);

    if (payload.action === 'setup') return jsonResponse(setup(payload));
    if (payload.action === 'sheets') return jsonResponse(appendSheet(payload));
    if (payload.action === 'calendar') return jsonResponse(createCalendarEvent(payload));
    if (payload.action === 'calendar_freebusy') return jsonResponse(getCalendarBusyIntervals(payload));
    if (payload.action === 'drive') return jsonResponse(uploadDriveFile(payload));

    return jsonResponse({ success: false, message: 'Unknown action' });
  } catch (error) {
    return jsonResponse({ success: false, message: error.message || 'Gateway failed' });
  }
}
