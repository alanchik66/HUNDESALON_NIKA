/**
 * Cloudflare Pages Function: POST /sendmail
 * ==========================================
 * Обрабатывает контактные формы и заявки на бронирование.
 *
 * Настройка (один раз в Cloudflare Dashboard):
 *   1. Зарегистрируйтесь на https://resend.com (бесплатно, 3000 писем/мес.)
 *   2. Подтвердите домен hundesalon-nika.com в Resend → Domains
 *   3. Создайте API-ключ на https://resend.com/api-keys
 *   4. В Cloudflare Pages → Settings → Environment variables
 *      добавьте секрет: RESEND_API_KEY = <ваш ключ>
 */

import { assertAllowedOrigin, enforceRateLimit, jsonResponse } from './_lib/http-security.js';

const RECIPIENT = 'info@hundesalon-nika.com';
const FROM      = 'Hundesalon Nika <noreply@hundesalon-nika.com>';

/** Строки для ответа на разных языках */
const COPY = {
    ru: {
        success: 'Сообщение отправлено! Мы свяжемся с вами в ближайшее время.',
        error:   'Ошибка при отправке. Пожалуйста, позвоните нам по телефону.',
    },
    uk: {
        success: "Повідомлення надіслано! Ми зв'яжемося з вами найближчим часом.",
        error:   'Помилка надсилання. Будь ласка, зателефонуйте нам.',
    },
    en: {
        success: 'Message sent! We will get back to you soon.',
        error:   'Failed to send. Please contact us by phone.',
    },
    de: {
        success: 'Ihre Nachricht wurde gesendet! Wir melden uns in Kürze.',
        error:   'Senden fehlgeschlagen. Bitte kontaktieren Sie uns telefonisch.',
    },
};

/**
 * Sanitizes a string: trims whitespace, strips HTML tags.
 * @param {string} val
 * @returns {string}
 */
function sanitize(val) {
    return String(val ?? '')
        .trim()
        .replace(/<[^>]*>/g, '');
}

/**
 * Basic email format validation.
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/**
 * Main handler — called for every HTTP method.
 * @param {import('@cloudflare/workers-types').EventContext} ctx
 */
export async function onRequest(ctx) {
    const { request, env } = ctx;

    /* ── Allow only POST ──────────────────────────────────────── */
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', {
            status: 405,
            headers: { Allow: 'POST' },
        });
    }

    /* ── Origin check (CSRF mitigation) ──────────────────────── */
    const originCheck = assertAllowedOrigin(request);
    if (!originCheck.ok) {
        return jsonResponse({ success: false, message: 'Forbidden' }, 403);
    }
    const { origin } = originCheck;

    const rateLimited = await enforceRateLimit(request, {
        route: 'sendmail',
        limit: 12,
        windowSec: 60,
    });
    if (rateLimited) {
        return jsonResponse(
            { success: false, message: 'Too many requests. Please try again later.' },
            429,
            origin
        );
    }

    /* ── Parse form data ───────────────────────────────────────── */
    let fields;
    try {
        const ct = request.headers.get('Content-Type') ?? '';
        if (ct.includes('application/json')) {
            fields = await request.json();
        } else {
            const fd = await request.formData();
            fields = Object.fromEntries(fd.entries());
        }
    } catch {
        return jsonResponse({ success: false, message: 'Invalid request body' }, 400);
    }

    /* ── Extract and sanitize fields ───────────────────────────── */
    const name     = sanitize(fields.name);
    const email    = sanitize(fields.email);
    const phone    = sanitize(fields.phone);
    const message  = sanitize(fields.message);
    const lang     = sanitize(fields.lang).slice(0, 2) || 'de';
    const formType = sanitize(fields.form_type) || 'contact';
    const service  = sanitize(fields.service);
    const date     = sanitize(fields.date);
    const time     = sanitize(fields.time);

    const copy = COPY[lang] ?? COPY.de;

    /* ── Validate required fields ──────────────────────────────── */
    if (!name || !email) {
        return jsonResponse({ success: false, message: copy.error }, 400, origin);
    }
    if (!isValidEmail(email)) {
        return jsonResponse({ success: false, message: copy.error }, 400, origin);
    }

    if (formType === 'booking') {
        if (!service || !date || !time) {
            return jsonResponse({ success: false, message: copy.error }, 400, origin);
        }
        if (!phone) {
            return jsonResponse({ success: false, message: copy.error }, 400, origin);
        }
    } else if (!message) {
        return jsonResponse({ success: false, message: copy.error }, 400, origin);
    }

    const resolvedMessage =
        message ||
        (formType === 'booking'
            ? `Booking request: ${service} on ${date} at ${time}`
            : '');

    if (resolvedMessage.length > 2000) {
        return jsonResponse({ success: false, message: copy.error }, 400, origin);
    }

    /* ── Build email ───────────────────────────────────────────── */
    const subjects = {
        booking:  'Neue Buchungsanfrage — HUNDESALON NIKA',
        feedback: 'Bewertung von der Website — HUNDESALON NIKA',
        contact:  'Neue Kontaktanfrage — HUNDESALON NIKA',
    };
    const subject = subjects[formType] ?? subjects.contact;

    const bodyLines = [
        `Formulartyp: ${formType}`,
        `Sprache:     ${lang}`,
        `Name:        ${name}`,
        `E-Mail:      ${email}`,
        phone   ? `Telefon:     ${phone}`   : null,
        service ? `Leistung:    ${service}` : null,
        date    ? `Datum:       ${date}`    : null,
        time    ? `Uhrzeit:     ${time}`    : null,
        '',
        'Nachricht:',
        resolvedMessage,
    ].filter((l) => l !== null);

    const textBody = bodyLines.join('\n');

    /* ── Send via Resend API ───────────────────────────────────── */
    const apiKey = env?.RESEND_API_KEY;
    if (!apiKey) {
        console.error('[sendmail] RESEND_API_KEY not configured');
        return jsonResponse({ success: false, message: copy.error }, 503, origin);
    }

    let resendRes;
    try {
        resendRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization:  `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from:     FROM,
                to:       [RECIPIENT],
                reply_to: email,
                subject,
                text:     textBody,
            }),
        });
    } catch (err) {
        console.error('[sendmail] Network error:', err);
        return jsonResponse({ success: false, message: copy.error }, 502, origin);
    }

    if (resendRes.ok) {
        return jsonResponse({ success: true, message: copy.success }, 200, origin);
    }

    const errBody = await resendRes.text().catch(() => '');
    console.error('[sendmail] Resend error', resendRes.status, errBody);
    return jsonResponse({ success: false, message: copy.error }, 502, origin);
}

