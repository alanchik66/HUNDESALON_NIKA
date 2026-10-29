import { getPaymentOrder, markPaymentBookingConfirmed } from './payment-orders.js';
import { runPaymentJob } from './payment-jobs.js';
import { buildBrandedEmail } from './email-template.js';
import { getEnvValue, sendSendPulseEmail } from './platform-integrations.js';

const COPY = {
  de: {
    title: 'Ihr Termin ist bestätigt — HUNDESALON_NIKA',
    intro: 'Ihr Termin wurde vom Salon bestätigt und im Kalender gespeichert.',
    deposit: 'Ihre Online-Anzahlung wird auf den Endpreis angerechnet.',
    date: 'Datum',
    time: 'Uhrzeit',
    service: 'Leistung',
    pet: 'Tier',
    amount: 'Anzahlung',
  },
  en: {
    title: 'Your appointment is confirmed — HUNDESALON_NIKA',
    intro: 'The salon has confirmed your appointment and saved it in the calendar.',
    deposit: 'Your online deposit will be deducted from the final price.',
    date: 'Date',
    time: 'Time',
    service: 'Service',
    pet: 'Pet',
    amount: 'Deposit',
  },
  ru: {
    title: 'Запись подтверждена — HUNDESALON_NIKA',
    intro: 'Салон подтвердил вашу запись и сохранил её в календаре.',
    deposit: 'Онлайн-предоплата будет учтена в итоговой стоимости.',
    date: 'Дата',
    time: 'Время',
    service: 'Услуга',
    pet: 'Питомец',
    amount: 'Предоплата',
  },
  uk: {
    title: 'Запис підтверджено — HUNDESALON_NIKA',
    intro: 'Салон підтвердив ваш запис і зберіг його в календарі.',
    deposit: 'Онлайн-передоплату буде враховано в підсумковій вартості.',
    date: 'Дата',
    time: 'Час',
    service: 'Послуга',
    pet: 'Улюбленець',
    amount: 'Передоплата',
  },
};

function validRequestId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
}

function buildConfirmationMessage(booking, { paid = false, amount = 0 } = {}) {
  const lang = Object.hasOwn(COPY, booking.lang) ? booking.lang : 'de';
  const copy = COPY[lang];
  const text = [
    copy.intro,
    '',
    copy.date + ': ' + booking.date,
    copy.time + ': ' + booking.time + ' (Europe/Berlin)',
    copy.service + ': ' + booking.service,
    copy.pet + ': ' + (booking.pet_name || booking.petName || ''),
    ...(paid ? [copy.amount + ': ' + (amount / 100).toFixed(2) + ' EUR', '', copy.deposit] : []),
    'https://hundesalon-nika.com',
  ].join('\n');
  return { lang, copy, text };
}

async function deliverConfirmationEmail(env, booking, options) {
  const { lang, copy, text } = buildConfirmationMessage(booking, options);
  return sendSendPulseEmail(env, {
    to: booking.email,
    from:
      getEnvValue(env, 'CLIENT_EMAIL_FROM') ||
      getEnvValue(env, 'SENDPULSE_FROM') ||
      'HUNDESALON_NIKA <info@hundesalon-nika.com>',
    replyTo: getEnvValue(env, 'SUPPORT_REPLY_TO_EMAIL') || 'info@hundesalon-nika.com',
    subject: copy.title,
    text,
    html: buildBrandedEmail({ title: copy.title, bodyText: text, lang }),
  });
}

/** Durable, idempotent confirmation delivery for cash and online bookings. */
export async function notifyBookingConfirmed(env, requestId, calendarResult) {
  if (!validRequestId(requestId) || !calendarResult?.ok || !calendarResult.eventId) return { ok: false };
  const booking = calendarResult.booking || {};
  if (!env?.CHAT_DB?.prepare) return { ok: false, reason: 'confirmation_store_unavailable' };
  try {
    const order = env.CHAT_DB.batch ? await getPaymentOrder(env, requestId) : null;
    if (order?.paymentStatus === 'paid') return notifyPaidBookingConfirmed(env, requestId, calendarResult);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(booking.email || '')) return { ok: false, reason: 'booking_email_missing' };
    const db = env.CHAT_DB;
    const now = Date.now();
    const claimToken = crypto.randomUUID();
    const idempotencyKey = 'booking_confirmation:' + requestId;
    const createdAt = new Date(now).toISOString();
    const claim = await db
      .prepare(
        "INSERT INTO delivery_attempts (id, request_id, form_type, channel, state, provider_status, result_code, created_at, updated_at, idempotency_key, lease_token, lease_until) VALUES (?, ?, 'booking', 'email_client', 'pending', 0, 'pending', ?, ?, ?, ?, ?) ON CONFLICT DO UPDATE SET state = 'pending', lease_token = excluded.lease_token, lease_until = excluded.lease_until, updated_at = excluded.updated_at, result_code = 'pending' WHERE delivery_attempts.idempotency_key = excluded.idempotency_key AND (delivery_attempts.state = 'failed' OR delivery_attempts.state = 'pending' AND delivery_attempts.lease_until <= ?)"
      )
      .bind(crypto.randomUUID(), requestId, createdAt, createdAt, idempotencyKey, claimToken, now + 120_000, now)
      .run();
    if (Number(claim?.meta?.changes) !== 1) {
      const state = await db
        .prepare('SELECT state FROM delivery_attempts WHERE idempotency_key = ?')
        .bind(idempotencyKey)
        .first();
      return state?.state === 'accepted'
        ? { ok: true, deduplicated: true }
        : { ok: false, pending: true, reason: 'confirmation_job_busy' };
    }
    const result = await deliverConfirmationEmail(env, booking, {
      paid: false,
      amount: 0,
    });
    if (result?.ok !== true) {
      await db
        .prepare(
          "UPDATE delivery_attempts SET state = 'failed', provider_status = ?, result_code = 'provider_failure', lease_token = NULL, lease_until = 0, updated_at = ? WHERE idempotency_key = ? AND state = 'pending' AND lease_token = ?"
        )
        .bind(Number(result?.status || 0), new Date().toISOString(), idempotencyKey, claimToken)
        .run();
      return result || { ok: false, reason: 'confirmation_email_failed' };
    }
    const completed = await db
      .prepare(
        "UPDATE delivery_attempts SET state = 'accepted', provider_status = ?, result_code = 'accepted', lease_token = NULL, lease_until = 0, updated_at = ? WHERE idempotency_key = ? AND state = 'pending' AND lease_token = ? AND lease_until > ?"
      )
      .bind(Number(result.status || 0), new Date().toISOString(), idempotencyKey, claimToken, Date.now())
      .run();
    return Number(completed?.meta?.changes) === 1
      ? result
      : { ok: false, reason: 'confirmation_job_completion_pending' };
  } catch (error) {
    if (env?.NODE_ENV === 'test') throw error;
    console.error(JSON.stringify({ event: 'booking_confirmation_delivery_pending' }));
    return { ok: false, reason: 'confirmation_email_failed' };
  }
}

/** Called only after the existing staff-authorized Calendar confirmation succeeds. */
export async function notifyPaidBookingConfirmed(env, requestId, calendarResult) {
  if (!calendarResult?.ok || !calendarResult.eventId) return { ok: false };
  if (!env?.CHAT_DB?.prepare) return { ok: true, skipped: true };
  try {
    const order = await getPaymentOrder(env, requestId);
    if (!order || order.paymentStatus !== 'paid') return { ok: true, skipped: true };
    const marked = await markPaymentBookingConfirmed(env, {
      orderId: order.id,
      eventId: calendarResult.eventId,
      confirmedAt: calendarResult.confirmedAt || Date.now(),
    });
    if (!marked.ok) return { ok: false };
    return runPaymentJob(env, order.id, 'confirmation_email', () =>
      deliverConfirmationEmail(env, order.booking, { paid: true, amount: order.amount })
    );
  } catch {
    console.error(JSON.stringify({ event: 'paid_booking_confirmation_delivery_pending' }));
    return { ok: false };
  }
}
