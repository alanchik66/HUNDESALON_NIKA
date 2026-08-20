const SITE_URL = 'https://hundesalon-nika.com';
const LOGO_URL = `${SITE_URL}/assets/images/brand/logo.png`;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const FOOTER_COPY = {
  de: {
    eyebrow: 'Premium-Fellpflege in Leipzig',
    cta: 'Website öffnen',
    reply: 'Antworten Sie bitte über den vorgesehenen Kontaktweg.',
    address: 'Salonadresse',
  },
  en: {
    eyebrow: 'Premium pet care in Leipzig',
    cta: 'Open website',
    reply: 'Please reply through the designated contact channel.',
    address: 'Salon address',
  },
  ru: {
    eyebrow: 'Премиальный уход за питомцами в Лейпциге',
    cta: 'Открыть сайт',
    reply: 'Пожалуйста, отвечайте через указанный канал связи.',
    address: 'Адрес салона',
  },
  uk: {
    eyebrow: 'Преміальний догляд за улюбленцями в Лейпцигу',
    cta: 'Відкрити сайт',
    reply: 'Будь ласка, відповідайте через вказаний канал зв’язку.',
    address: 'Адреса салону',
  },
};

function linkifyEscapedText(value) {
  return value.replace(/https?:\/\/[^\s<]+/g, (rawUrl) => {
    let url = rawUrl;
    let trailing = '';

    while (/[.,!?;:)]$/.test(url)) {
      trailing = url.at(-1) + trailing;
      url = url.slice(0, -1);
    }

    return `<a href="${url}" style="color:#e4bd63;font-weight:700;text-decoration:underline;">${url}</a>${trailing}`;
  });
}

function bodyToHtml(value) {
  return escapeHtml(value)
    .split(/\n{2,}/)
    .map((paragraph) => {
      const content = linkifyEscapedText(paragraph).replaceAll('\n', '<br>');
      return `<p style="margin:0 0 16px;">${content}</p>`;
    })
    .join('');
}

export function buildBrandedEmail({ title, bodyText, preheader = 'HUNDESALON_NIKA', lang = 'de' }) {
  const locale = FOOTER_COPY[lang] ? lang : 'de';
  const footer = FOOTER_COPY[locale];
  const body = bodyToHtml(bodyText);
  return `<!doctype html>
<html lang="${locale}" dir="ltr">
  <head>
    <meta charset="utf-8">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light dark; }
      body { margin:0; background:#010301; color:#ece8df; font-family:Arial,Helvetica,sans-serif; line-height:1.6; }
      table { border-collapse:collapse; }
      .email-bg { background-color:#010301; background-image:linear-gradient(145deg,#041006 0%,#010301 48%,#020806 100%); }
      .shell { width:100%; max-width:680px; margin:0 auto; }
      .card { background:#060b09; border:1px solid #d6e7dc1f; border-radius:22px; overflow:hidden; }
      .hero { padding:38px 32px 30px; background:#07150d; color:#f5f0e6; text-align:center; }
      .logo { display:block; width:144px; height:auto; margin:0 auto 18px; }
      .eyebrow { color:#e4bd63; font-size:11px; font-weight:700; letter-spacing:2px; line-height:1.4; text-transform:uppercase; }
      .title { margin:12px 0 0; color:#fff4d1; font-family:Georgia,'Times New Roman',serif; font-size:27px; font-weight:700; line-height:1.2; }
      .content { padding:32px; background:#060b09; color:#ece8df; font-size:16px; }
      .content a { color:#e4bd63; font-weight:700; }
      .cta { margin-top:24px; }
      .cta a { color:#08120b; font-size:14px; font-weight:700; text-decoration:none; }
      .footer { padding:20px 32px 24px; background:#060b09; border-top:1px solid #d6e7dc1f; color:#aab8b1; font-size:12px; }
      .footer a { color:#e4bd63; font-weight:700; }
      @media screen and (max-width:600px) {
        .email-pad { padding:12px 8px !important; }
        .hero { padding:30px 22px 24px !important; }
        .content { padding:24px 22px !important; }
        .footer { padding:18px 22px 22px !important; }
        .title { font-size:23px !important; }
      }
      @media (prefers-color-scheme: dark) {
        body { background:#010301; color:#ece8df; }
        .email-bg { background-color:#010301; }
        .card, .content, .footer { background:#060b09; }
        .card { border-color:#d6e7dc1f; }
        .hero { background:#07150d; color:#f5f0e6; }
        .content a, .footer a { color:#e4bd63; }
        .footer { border-color:#d6e7dc1f; color:#aab8b1; }
      }
      @media (prefers-color-scheme: light) {
        body { background:#faf8f4; color:#2c2822; }
        .email-bg { background-color:#faf8f4; background-image:none; }
        .card, .content, .footer { background:#fffdf9; }
        .card { border-color:#ded8cf; }
        .hero { background:#173b36; color:#fffdf9; }
        .content { color:#2c2822; }
        .content a, .footer a { color:#176b63; }
        .footer { border-color:#ded8cf; color:#68716d; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background-color:#010301;color:#ece8df;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
    <table role="presentation" class="email-bg" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#010301" style="width:100%;background-color:#010301;background-image:linear-gradient(145deg,#041006 0%,#010301 48%,#020806 100%);">
      <tr><td class="email-bg email-pad" align="center" valign="top" bgcolor="#010301" style="padding:28px 14px;background-color:#010301;">
        <table role="presentation" class="shell card" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#060b09" style="width:100%;max-width:680px;background-color:#060b09;border:1px solid #d6e7dc1f;border-radius:22px;overflow:hidden;">
          <tr><td bgcolor="#c6a15b" style="height:3px;font-size:0;line-height:0;background-color:#c6a15b;">&nbsp;</td></tr>
          <tr><td class="hero" bgcolor="#07150d" style="padding:38px 32px 30px;background-color:#07150d;color:#f5f0e6;text-align:center;">
            <img class="logo" src="${LOGO_URL}" width="144" alt="HUNDESALON_NIKA" style="display:block;width:144px;height:auto;margin:0 auto 18px;">
            <div class="eyebrow" style="color:#e4bd63;font-size:11px;font-weight:700;letter-spacing:2px;line-height:1.4;text-transform:uppercase;">${footer.eyebrow}</div>
            <h1 class="title" style="margin:12px 0 0;color:#fff4d1;font-family:Georgia,'Times New Roman',serif;font-size:27px;font-weight:700;line-height:1.2;">${escapeHtml(title)}</h1>
            <table role="presentation" width="96" cellpadding="0" cellspacing="0" border="0" style="width:96px;margin:22px auto 0;"><tr><td bgcolor="#c6a15b" style="height:1px;font-size:0;line-height:0;background-color:#c6a15b;">&nbsp;</td></tr></table>
          </td></tr>
          <tr><td class="content" bgcolor="#060b09" style="padding:32px;background-color:#060b09;color:#ece8df;font-size:16px;">${body}
            <table role="presentation" class="cta" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;"><tr><td bgcolor="#c6a15b" style="border-radius:8px;background-color:#c6a15b;"><a href="${SITE_URL}" style="display:inline-block;padding:12px 20px;color:#08120b;font-size:14px;font-weight:700;text-decoration:none;">${footer.cta}</a></td></tr></table>
          </td></tr>
          <tr><td class="footer" bgcolor="#060b09" style="padding:20px 32px 24px;background-color:#060b09;border-top:1px solid #d6e7dc1f;color:#aab8b1;font-size:12px;">HUNDESALON_NIKA · <a href="${SITE_URL}" style="color:#e4bd63;font-weight:700;text-decoration:none;">hundesalon-nika.com</a><br>${footer.address}: Walter-Markov-Ring 1 · 04288 Leipzig<br>${footer.reply}</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}
