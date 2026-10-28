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
    const booking = order.booking;
    const lang = Object.hasOwn(COPY, booking.lang) ? booking.lang : 'de';
    const copy = COPY[lang];
    const text = [
      copy.intro,
      '',
      copy.date + ': ' + booking.date,
      copy.time + ': ' + booking.time + ' (Europe/Berlin)',
      copy.service + ': ' + booking.service,
      copy.pet + ': ' + booking.pet_name,
      copy.amount + ': ' + (order.amount / 100).toFixed(2) + ' EUR',
      '',
      copy.deposit,
      'https://hundesalon-nika.com',
    ].join('\n');
    return runPaymentJob(env, order.id, 'confirmation_email', () =>
      sendSendPulseEmail(env, {
        to: booking.email,
        from:
          getEnvValue(env, 'CLIENT_EMAIL_FROM') ||
          getEnvValue(env, 'SENDPULSE_FROM') ||
          'HUNDESALON_NIKA <info@hundesalon-nika.com>',
        replyTo: getEnvValue(env, 'SUPPORT_REPLY_TO_EMAIL') || 'info@hundesalon-nika.com',
        subject: copy.title,
        text,
        html: buildBrandedEmail({ title: copy.title, bodyText: text, lang }),
      })
    );
  } catch {
    console.error(JSON.stringify({ event: 'paid_booking_confirmation_delivery_pending' }));
    return { ok: false };
  }
}
