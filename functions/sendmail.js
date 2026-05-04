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

    /* ── Origin check (basic CSRF mitigation) ─────────────────── */
    const origin = request.headers.get('Origin') ?? '';
    const host   = request.headers.get('Host')   ?? '';
    if (origin && !origin.endsWith(host) && !origin.startsWith('http://localhost')) {
        return jsonResponse({ success: false, message: 'Forbidden' }, 403);
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
    if (!name || !email || !message) {
        return jsonResponse({ success: false, message: copy.error }, 400);
    }
    if (!isValidEmail(email)) {
        return jsonResponse({ success: false, message: copy.error }, 400);
    }
    if (message.length > 2000) {
        return jsonResponse({ success: false, message: copy.error }, 400);
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
        message,
    ].filter((l) => l !== null);

    const textBody = bodyLines.join('\n');

    /* ── Send via Resend API ───────────────────────────────────── */
    const apiKey = env?.RESEND_API_KEY;
    if (!apiKey) {
        console.error('[sendmail] RESEND_API_KEY not configured');
        return jsonResponse({ success: false, message: copy.error }, 503);
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
        return jsonResponse({ success: false, message: copy.error }, 502);
    }

    if (resendRes.ok) {
        return jsonResponse({ success: true, message: copy.success });
    }

    const errBody = await resendRes.text().catch(() => '');
    console.error('[sendmail] Resend error', resendRes.status, errBody);
    return jsonResponse({ success: false, message: copy.error }, 502);
}

/* ── Helper ────────────────────────────────────────────────────── */
function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}
