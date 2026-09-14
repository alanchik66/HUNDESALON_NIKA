import { enforceRateLimit } from '../_lib/http-security.js';
import { confirmGoogleBooking } from '../_lib/booking-calendar.js';
import { verifyBookingConfirmationToken } from '../_lib/booking-confirmation.js';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function confirmationForm(params) {
  const id = escapeHtml(params.get('id'));
  const expires = escapeHtml(params.get('expires'));
  const signature = escapeHtml(params.get('sig'));
  return `<form method="post" action="/api/booking-confirm"><input type="hidden" name="id" value="${id}"><input type="hidden" name="expires" value="${expires}"><input type="hidden" name="sig" value="${signature}"><button type="submit">Запись подтвердить</button></form>`;
}

function page(title, message, status = 200, form = '') {
  return new Response(
    `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{margin:0;background:#f7f2e8;color:#20180f;font:16px/1.5 system-ui,sans-serif;display:grid;min-height:100vh;place-items:center}.card{background:#fff;border:1px solid #d9c7a8;border-radius:18px;box-shadow:0 14px 40px #4b351526;max-width:620px;padding:32px;margin:20px}h1{margin:0 0 12px;color:#704d16;font-size:clamp(24px,5vw,36px)}p{margin:0}form{margin-top:24px}button{background:#704d16;border:0;border-radius:10px;color:#fff;cursor:pointer;font:inherit;font-weight:700;padding:12px 18px}button:focus-visible{outline:3px solid #c79a42;outline-offset:3px}</style></head><body><main class="card"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p>${form}</main></body></html>`,
    {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0',
        'Content-Security-Policy':
          "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
      },
    }
  );
}

export async function onRequest({ request, env }) {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, POST' } });
  }
  const limited = await enforceRateLimit(request, { route: 'booking-confirm', limit: 20, windowSec: 600 });
  if (limited) return limited;

  let params;
  if (request.method === 'POST') {
    if (!(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/x-www-form-urlencoded')) {
      return page('Неверный запрос', 'Откройте исходную ссылку из служебного письма.', 415);
    }
    const contentLength = Number(request.headers.get('Content-Length') || 0);
    if (contentLength > 2048) return page('Неверный запрос', 'Размер запроса превышен.', 413);
    const body = await request.text();
    if (body.length > 2048) return page('Неверный запрос', 'Размер запроса превышен.', 413);
    params = new URLSearchParams(body);
  } else {
    params = new URL(request.url).searchParams;
  }

  const token = await verifyBookingConfirmationToken(env, params);
  if (!token.ok) {
    return page(
      'Ссылка недействительна',
      token.reason === 'expired'
        ? 'Срок ссылки истёк. Используйте кнопку в служебном Telegram-чате.'
        : 'Проверьте ссылку или используйте кнопку в служебном Telegram-чате.',
      token.reason === 'expired' ? 410 : 403
    );
  }

  if (request.method === 'GET') {
    return page(
      'Подтверждение записи',
      `Заявка ${token.requestId}. Проверьте данные в служебном письме и нажмите кнопку. Только после этого запись появится в Google Calendar.`,
      200,
      confirmationForm(params)
    );
  }

  let result;
  try {
    result = await confirmGoogleBooking(env, token.requestId);
  } catch {
    result = { ok: false, reason: 'confirmation_pending', partial: true };
  }
  if (!result.ok) {
    if (result.reason === 'slot_conflict') {
      return page('Время уже занято', 'Google Calendar не был изменён. Выберите с клиентом другое время.', 409);
    }
    if (result.reason === 'invalid_state') {
      return page('Заявка уже закрыта', 'Отменённую или отклонённую заявку подтвердить нельзя.', 409);
    }
    if (result.reason === 'booking_not_found') {
      return page('Заявка не найдена', 'Google Calendar не был изменён. Проверьте служебное письмо.', 404);
    }
    if (result.partial || result.reason === 'confirmation_pending' || result.reason === 'calendar_cleanup_failed') {
      return page(
        'Нужна повторная проверка',
        'Событие могло быть создано, но подтверждение не завершено. Не создавайте новую заявку: повторите эту же кнопку позже.',
        503
      );
    }
    return page(
      'Запись не подтверждена',
      'Google Calendar не был изменён. Повторите попытку позже через служебное уведомление.',
      503
    );
  }
  const booking = result.booking || {};
  const details = [booking.date, booking.time, booking.service, booking.name].filter(Boolean).join(' · ');
  return page(
    result.deduplicated ? 'Запись уже подтверждена' : 'Запись подтверждена',
    `${details || 'Событие'} сохранено в Google Calendar без дубликата.`
  );
}
