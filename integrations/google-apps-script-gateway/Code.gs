const PROPS = PropertiesService.getScriptProperties();

function setGatewaySecret(secret) {
  PROPS.setProperty('GATEWAY_SECRET', String(secret || '').trim());
  return { success: true };
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function requireSecret(payload) {
  const expected = String(PROPS.getProperty('GATEWAY_SECRET') || '').trim();
  const provided = String(payload.secret || '').trim();
  if (!expected || provided !== expected) {
    throw new Error('Forbidden');
  }
}

function getOrCreateSheet(name) {
  const sheetId = PROPS.getProperty('SHEET_ID');
  const spreadsheet = sheetId
    ? SpreadsheetApp.openById(sheetId)
    : SpreadsheetApp.create('HUNDESALON NIKA Platform Log');

  if (!sheetId) {
    PROPS.setProperty('SHEET_ID', spreadsheet.getId());
    const first = spreadsheet.getSheets()[0];
    first.setName('bookings');
    first.appendRow([
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
    ]);
    spreadsheet.insertSheet('subscribers').appendRow(['created_at', 'email', 'lang', 'page', 'origin']);
  }

  return spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
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
  const sheet = payload.spreadsheetId
    ? SpreadsheetApp.openById(payload.spreadsheetId).getSheetByName(payload.sheetName || 'bookings')
    : getOrCreateSheet(payload.sheetName || 'bookings');

  sheet.appendRow(payload.values || []);
  return { success: true, updatedRange: sheet.getName() };
}

function createCalendarEvent(payload) {
  const calendar = payload.calendarId
    ? CalendarApp.getCalendarById(payload.calendarId)
    : getOrCreateCalendar();

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

function uploadDriveFile(payload) {
  const folder = getOrCreateFolder();
  const bytes = Utilities.base64Decode(payload.fileBase64 || '');
  const blob = Utilities.newBlob(bytes, payload.mimeType || 'application/octet-stream', payload.fileName || 'upload.bin');
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
    if (payload.action === 'drive') return jsonResponse(uploadDriveFile(payload));

    return jsonResponse({ success: false, message: 'Unknown action' });
  } catch (error) {
    return jsonResponse({ success: false, message: error.message || 'Gateway failed' });
  }
}
