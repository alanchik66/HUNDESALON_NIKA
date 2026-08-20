import { getPublicReadCorsOrigin, jsonResponse, enforceRateLimit } from './_lib/http-security.js';
import { getEnvValue, getGoogleCalendarBusyIntervals, hasUsableValue } from './_lib/platform-integrations.js';

const MAX_LOOKAHEAD_DAYS = 90;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const normalizeDate = value => {
  const date = String(value || '').trim();
  if (!DATE_RE.test(date)) return '';

  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return '';
  return date;
};

const isWithinBookingHorizon = date => {
  const requested = new Date(`${date}T00:00:00Z`);
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const latest = new Date(todayUtc);
  latest.setUTCDate(latest.getUTCDate() + MAX_LOOKAHEAD_DAYS);
  return requested >= todayUtc && requested <= latest;
};

const normalizeBusyIntervals = intervals => (Array.isArray(intervals) ? intervals : [])
  .map(interval => {
    const start = Date.parse(interval?.start || '');
    const end = Date.parse(interval?.end || '');
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
    return {
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
    };
  })
  .filter(Boolean)
  .slice(0, 100);

export async function onRequestGet({ request, env }) {
  const requestedOrigin = String(request.headers.get('Origin') || '').trim();
  const origin = getPublicReadCorsOrigin(request);
  if (requestedOrigin && !origin) {
    return jsonResponse({ success: false, message: 'Origin is not allowed.' }, 403);
  }

  const rateLimited = await enforceRateLimit(request, {
    route: 'booking-availability',
    limit: 60,
    windowSec: 60,
  });
  if (rateLimited) return rateLimited;

  const date = normalizeDate(new URL(request.url).searchParams.get('date'));
  if (!date || !isWithinBookingHorizon(date)) {
    return jsonResponse({ success: false, message: 'Date is outside the booking window.' }, 400, origin);
  }

  const calendarId = getEnvValue(env, 'GOOGLE_CALENDAR_ID', 'primary');
  if (!hasUsableValue(calendarId)) {
    return jsonResponse({ success: true, configured: false, date, busyIntervals: [] }, 200, origin);
  }

  const dayStart = new Date(`${date}T00:00:00Z`);
  const timeMin = new Date(dayStart);
  timeMin.setUTCHours(timeMin.getUTCHours() - 2);
  const timeMax = new Date(dayStart);
  timeMax.setUTCHours(timeMax.getUTCHours() + 26);

  try {
    const result = await getGoogleCalendarBusyIntervals(env, {
      calendarId,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
    });

    return jsonResponse(
      {
        success: true,
        configured: Boolean(result.configured && result.ok),
        date,
        busyIntervals: normalizeBusyIntervals(result.busyIntervals),
      },
      200,
      origin
    );
  } catch (error) {
    console.warn('[booking-availability] Calendar lookup failed:', error?.message || error);
    return jsonResponse({ success: true, configured: false, date, busyIntervals: [] }, 200, origin);
  }
}
