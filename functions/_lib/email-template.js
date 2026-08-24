const SITE_URL = 'https://hundesalon-nika.com';
const LOGO_URL = `${SITE_URL}/assets/images/brand/logo.png`;
const ICON_URL = 'https://raw.githubusercontent.com/alanchik66/HUNDESALON_NIKA/main/assets/images/icons';
const LANGUAGE_ICON_URL = `${SITE_URL}/assets/images/icons/globe-language.webp`;
const THEME_DARK_ICON_URL = `${SITE_URL}/assets/images/icons/sunrise.webp`;

// Cloudflare routing and SendPulse sender authorization are configured separately.
// Keep this list as the canonical set of business aliases, not as a permission bypass.
export const MASTER_EMAIL_TEMPLATE = Object.freeze({
  id: 'hundesalon-nika-master-v1',
  mailboxes: Object.freeze([
    'admin@hundesalon-nika.com',
    'booking@hundesalon-nika.com',
    'contact@hundesalon-nika.com',
    'info@hundesalon-nika.com',
    'noreply@hundesalon-nika.com',
    'support@hundesalon-nika.com',
  ]),
  senderRules: Object.freeze({
    landlord: Object.freeze({
      from: 'info@hundesalon-nika.com',
      replyTo: 'info@hundesalon-nika.com',
    }),
    automated: Object.freeze({
      from: 'noreply@hundesalon-nika.com',
      replyTo: 'support@hundesalon-nika.com',
    }),
  }),
});

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
    allNetworks: 'ALLE NETZWERKE',
    legal: ['Impressum', 'Datenschutz', 'AGB'],
    copyright: '© 2026 HUNDESALON_NIKA | Alle Rechte vorbehalten',
  },
  en: {
    eyebrow: 'Premium pet care in Leipzig',
    cta: 'Open website',
    reply: 'Please reply through the designated contact channel.',
    address: 'Salon address',
    allNetworks: 'ALL SOCIALS',
    legal: ['Legal Notice', 'Privacy Policy', 'Terms'],
    copyright: '© 2026 HUNDESALON_NIKA | All rights reserved',
  },
  ru: {
    eyebrow: 'Премиальный уход за питомцами в Лейпциге',
    cta: 'Открыть сайт',
    reply: 'Пожалуйста, отвечайте через указанный канал связи.',
    address: 'Адрес салона',
    allNetworks: 'ВСЕ СОЦСЕТИ',
    legal: ['Импрессум', 'Конфиденциальность', 'Условия'],
    copyright: '© 2026 HUNDESALON_NIKA | Все права защищены',
  },
  uk: {
    eyebrow: 'Преміальний догляд за улюбленцями в Лейпцигу',
    cta: 'Відкрити сайт',
    reply: 'Будь ласка, відповідайте через вказаний канал зв’язку.',
    address: 'Адреса салону',
    allNetworks: 'ВСІ СОЦМЕРЕЖІ',
    legal: ['Імпресум', 'Конфіденційність', 'Умови'],
    copyright: '© 2026 HUNDESALON_NIKA | Усі права захищені',
  },
};

const NAV_COPY = {
  de: {
    primary: [
      ['ÜBER UNS', 'o-nas.html'],
      ['UNSERE LEISTUNGEN', 'nashi-uslugi.html'],
      ['PREISLISTE', 'prays-list.html'],
      ['GALERIE', 'galereya.html'],
      ['KONTAKTE', 'kontakty.html'],
    ],
    booking: 'ONLINE BUCHEN',
  },
  en: {
    primary: [
      ['ABOUT US', 'o-nas.html'],
      ['OUR SERVICES', 'nashi-uslugi.html'],
      ['PRICE LIST', 'prays-list.html'],
      ['GALLERY', 'galereya.html'],
      ['CONTACTS', 'kontakty.html'],
    ],
    booking: 'BOOK ONLINE',
  },
  ru: {
    primary: [
      ['О НАС', 'o-nas.html'],
      ['НАШИ УСЛУГИ', 'nashi-uslugi.html'],
      ['ПРАЙС-ЛИСТ', 'prays-list.html'],
      ['ГАЛЕРЕЯ', 'galereya.html'],
      ['КОНТАКТЫ', 'kontakty.html'],
    ],
    booking: 'ОНЛАЙН ЗАКАЗ',
  },
  uk: {
    primary: [
      ['ПРО НАС', 'o-nas.html'],
      ['НАШІ ПОСЛУГИ', 'nashi-uslugi.html'],
      ['ПРАЙС-ЛИСТ', 'prays-list.html'],
      ['ГАЛЕРЕЯ', 'galereya.html'],
      ['КОНТАКТИ', 'kontakty.html'],
    ],
    booking: 'ОНЛАЙН ЗАПИС',
  },
};

const THEME_COPY = {
  de: 'Darstellung wechseln',
  en: 'Switch appearance',
  ru: 'Сменить оформление',
  uk: 'Змінити оформлення',
};

const LANGUAGE_COPY = {
  de: 'Sprache wechseln',
  en: 'Change language',
  ru: 'Сменить язык',
  uk: 'Змінити мову',
};

const SOCIAL_LINKS = [
  ['WhatsApp', 'https://wa.me/4915172450988', 'whatsapp.png'],
  ['Telegram', 'https://t.me/hundesalon_nika_support_bot', 'telegram.png'],
  ['Viber', 'viber://chat?number=%2B4915172450988', 'viber.png'],
  ['Telefon', 'tel:+4915172450988', 'phone.png'],
  ['Facebook', 'https://www.facebook.com/share/17SVsvkZEo/?mibextid=wwXIfr', 'facebook.png'],
  ['E-Mail', 'mailto:info@hundesalon-nika.com', 'mail.png'],
];

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
  const navCopy = NAV_COPY[locale];
  const navigation = navCopy.primary
    .map(
      ([label, path]) =>
        `<a class="nav-link" href="${SITE_URL}/${locale}/${path}" style="position:relative;display:inline-block;overflow:hidden;margin:2px 0 2px 3px;padding:6px 7px;border:0;border-radius:7px;background-color:#13251a;background-image:radial-gradient(ellipse at 30% 0%,rgba(255,255,255,.12) 0%,rgba(255,255,255,0) 60%),linear-gradient(105deg,rgba(255,255,255,0) 0%,rgba(255,246,215,.08) 30%,rgba(255,246,215,.28) 50%,rgba(255,255,255,0) 70%);background-position:0 0,45% 50%;background-size:100% 100%,260% 180%;color:#efc866;font-family:Georgia,'Times New Roman',serif;font-size:8px;font-weight:500;letter-spacing:.4px;line-height:1.2;text-decoration:none;text-shadow:0 1px 0 #683907;box-shadow:0 4px 20px rgba(0,0,0,.12),inset 0 .5px 0 rgba(255,255,255,.05);white-space:nowrap;">${escapeHtml(label)}</a>`,
    )
    .join('');
  const footerNavigation = navCopy.primary
    .filter((_, index) => index !== 3)
    .map(
      ([label, path]) =>
        `<a href="${SITE_URL}/${locale}/${path}" style="display:inline-block;margin:4px 9px;color:#d8c7a0;font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:.4px;text-decoration:none;white-space:nowrap;">${escapeHtml(label)}</a>`,
    )
    .join('');
  const socialNavigation = SOCIAL_LINKS.map(
    ([label, href, icon]) =>
      `<td align="center" style="padding:0 4px;"><a href="${href}" title="${escapeHtml(label)}" style="display:inline-block;text-decoration:none;"><img src="${ICON_URL}/${icon}" width="32" height="32" alt="${escapeHtml(label)}" style="display:block;width:32px;height:32px;border:0;"></a></td>`,
  ).join('');
  const legalNavigation = [
    ['impressum.html', footer.legal[0]],
    ['datenschutz.html', footer.legal[1]],
    ['agb.html', footer.legal[2]],
  ]
    .map(
      ([path, label]) =>
        `<a href="${SITE_URL}/${locale}/${path}" style="color:#9d9178;text-decoration:none;">${escapeHtml(label)}</a>`,
    )
    .join(' <span style="color:#665b48;">|</span> ');
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
      .hero { padding:24px 26px 28px; background:#07150d; color:#f5f0e6; text-align:left; }
      .logo { display:block; width:96px; height:96px; max-height:96px; object-fit:contain; margin:0; }
      .nav-cell { text-align:right; font-size:0; }
      .header-tools { margin:0 0 7px auto; }
      .language-control, .theme-control { display:inline-block; width:25px; height:25px; border:0; background:transparent; text-decoration:none; vertical-align:middle; }
      .control-icon { display:block; width:25px; height:25px; border:0; object-fit:contain; filter:drop-shadow(0 4px 8px rgba(0,0,0,.3)) saturate(1.05) brightness(1.04); animation:emailControlFloat 4.8s ease-in-out infinite,emailControlGlow 7s ease-in-out infinite; transition:transform .28s ease,filter .28s ease; }
      .language-control:hover .control-icon, .language-control:focus .control-icon, .theme-control:hover .control-icon { transform:translateY(-1px) scale(1.025); filter:drop-shadow(0 6px 12px rgba(0,0,0,.34)) saturate(1.08) brightness(1.08); }
      .theme-control { cursor:pointer; }
      .theme-icon { object-fit:contain; }
      .nav-link, .booking-link { position:relative; display:inline-block; overflow:hidden; border:0; background-color:#13251a; background-image:radial-gradient(ellipse at 30% 0%,rgba(255,255,255,.12) 0%,rgba(255,255,255,0) 60%),linear-gradient(105deg,rgba(255,255,255,0) 0%,rgba(255,246,215,.08) 30%,rgba(255,246,215,.28) 50%,rgba(255,255,255,0) 70%); background-position:0 0,45% 50%; background-size:100% 100%,260% 180%; color:#efc866; font-family:Georgia,'Times New Roman',serif; font-weight:500; text-decoration:none; text-shadow:0 1px 0 #683907; box-shadow:0 4px 20px rgba(0,0,0,.12),inset 0 .5px 0 rgba(255,255,255,.05); white-space:nowrap; animation:emailNavBreath 5.7s ease-in-out infinite,emailNavRefraction 8.8s cubic-bezier(.22,1,.36,1) infinite; transition:transform .32s cubic-bezier(.22,1,.36,1),color .32s ease,background-color .32s ease,box-shadow .32s ease; }
      .nav-link { margin:2px 0 2px 3px; padding:6px 7px; border-radius:7px; font-size:8px; letter-spacing:.4px; line-height:1.2; }
      .booking-link { margin-bottom:7px; padding:8px 14px; border-radius:11px; font-size:11px; font-weight:700; letter-spacing:.7px; line-height:1.2; }
      .nav-link:hover, .nav-link:focus, .booking-link:hover, .booking-link:focus { transform:translateY(-1px) scale(1.012); color:#ffe6a8; background-color:#102319; box-shadow:0 6px 28px rgba(0,0,0,.16),inset 0 .5px 0 rgba(255,255,255,.07); }
      @keyframes emailNavBreath { 0%,100% { box-shadow:0 4px 20px rgba(0,0,0,.12),inset 0 .5px 0 rgba(255,255,255,.04); filter:brightness(.97); } 50% { box-shadow:0 6px 28px rgba(0,0,0,.16),inset 0 .5px 0 rgba(255,255,255,.07); filter:brightness(1.03); } }
      @keyframes emailNavRefraction { 0% { background-position:0 0,-160% 50%; } 52% { background-position:0 0,80% 50%; } 100% { background-position:0 0,220% 50%; } }
      @keyframes emailControlFloat { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-1px); } }
      @keyframes emailControlGlow { 0%,100% { opacity:.96; } 50% { opacity:1; } }
      .eyebrow { color:#e4bd63; font-size:11px; font-weight:700; letter-spacing:2px; line-height:1.4; text-transform:uppercase; }
      .title { margin:12px 0 0; color:#fff4d1; font-family:Georgia,'Times New Roman',serif; font-size:27px; font-weight:700; line-height:1.2; }
      .content { padding:32px; background:#060b09; color:#ece8df; font-size:16px; }
      .content a { color:#e4bd63; font-weight:700; }
      .cta { margin-top:24px; }
      .cta a { color:#08120b; font-size:14px; font-weight:700; text-decoration:none; }
      .footer { padding:20px 32px 24px; background:#060b09; border-top:1px solid #d6e7dc1f; color:#aab8b1; font-size:12px; }
      .footer a { color:#e4bd63; font-weight:700; }
      .site-footer { padding:22px 24px 20px; background:#17140d; background-image:linear-gradient(90deg,#17140d 0%,#2b2112 52%,#17140d 100%); border-top:1px solid #5f4c29; color:#9d9178; text-align:center; }
      @media screen and (max-width:600px) {
        .email-pad { padding:12px 8px !important; }
        .hero { padding:24px 22px 24px !important; }
        .brand-cell, .nav-cell { display:block !important; width:100% !important; text-align:center !important; }
        .logo { width:96px !important; height:96px !important; max-height:96px !important; margin:0 auto 10px !important; }
        .language-control, .theme-control, .control-icon { width:25px !important; height:25px !important; }
        .nav-link { margin:3px !important; }
        .booking-link { margin:0 0 8px !important; }
        .content { padding:24px 22px !important; }
        .footer { padding:18px 22px 22px !important; }
        .site-footer { padding:20px 14px !important; }
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
      .theme-toggle:checked + .email-bg { background-color:#faf8f4 !important; background-image:none !important; }
      .theme-toggle:checked + .email-bg .card,
      .theme-toggle:checked + .email-bg .content,
      .theme-toggle:checked + .email-bg .footer { background:#fffdf9 !important; }
      .theme-toggle:checked + .email-bg .card { border-color:#ded8cf !important; }
      .theme-toggle:checked + .email-bg .hero { background:#173b36 !important; color:#fffdf9 !important; }
      .theme-toggle:checked + .email-bg .content { color:#2c2822 !important; }
      .theme-toggle:checked + .email-bg .content a,
      .theme-toggle:checked + .email-bg .footer a { color:#176b63 !important; }
      .theme-toggle:checked + .email-bg .footer { border-color:#ded8cf !important; color:#68716d !important; }
    </style>
  </head>
  <body style="margin:0;padding:0;background-color:#010301;color:#ece8df;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
    <input class="theme-toggle" id="nika-email-theme" type="checkbox" aria-label="${escapeHtml(THEME_COPY[locale])}" style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    <table role="presentation" class="email-bg" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#010301" style="width:100%;background-color:#010301;background-image:linear-gradient(145deg,#041006 0%,#010301 48%,#020806 100%);">
      <tr><td class="email-bg email-pad" align="center" valign="top" bgcolor="#010301" style="padding:28px 14px;background-color:#010301;">
        <table role="presentation" class="shell card" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#060b09" style="width:100%;max-width:680px;background-color:#060b09;border:1px solid #d6e7dc1f;border-radius:22px;overflow:hidden;">
          <tr><td class="hero" bgcolor="#07150d" style="padding:24px 26px 28px;background-color:#07150d;color:#f5f0e6;text-align:left;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;"><tr>
              <td class="brand-cell" width="108" valign="middle" style="width:108px;vertical-align:middle;"><img class="logo" src="${LOGO_URL}" width="96" height="96" alt="HUNDESALON_NIKA" style="display:block;width:96px;height:96px;max-height:96px;object-fit:contain;margin:0;"></td>
               <td class="nav-cell" align="right" valign="middle" style="text-align:right;vertical-align:middle;font-size:0;"><table role="presentation" class="header-tools" cellpadding="0" cellspacing="0" border="0" align="right" style="margin:0 0 7px auto;"><tr><td align="center" valign="middle" style="padding:0 6px 0 0;"><a class="language-control" href="${SITE_URL}/${locale}/" title="${escapeHtml(LANGUAGE_COPY[locale])}" aria-label="${escapeHtml(LANGUAGE_COPY[locale])}" style="display:inline-block;width:25px;height:25px;border:0;background:transparent;text-decoration:none;"><img class="control-icon" src="${LANGUAGE_ICON_URL}" width="25" height="25" alt="${escapeHtml(LANGUAGE_COPY[locale])}" style="display:block;width:25px;height:25px;border:0;object-fit:contain;"></a></td><td align="center" valign="middle"><a class="booking-link" href="${SITE_URL}/${locale}/onlayn-bronirovanie.html" style="position:relative;display:inline-block;overflow:hidden;margin:0;padding:11px 18px;border:0;border-radius:11px;background-color:#13251a;background-image:radial-gradient(ellipse at 30% 0%,rgba(255,255,255,.12) 0%,rgba(255,255,255,0) 60%),linear-gradient(105deg,rgba(255,255,255,0) 0%,rgba(255,246,215,.08) 30%,rgba(255,246,215,.28) 50%,rgba(255,255,255,0) 70%);background-position:0 0,45% 50%;background-size:100% 100%,260% 180%;color:#efc866;font-family:Georgia,'Times New Roman',serif;font-size:11px;font-weight:700;letter-spacing:.7px;line-height:1.2;text-decoration:none;text-shadow:0 1px 0 #683907;box-shadow:0 4px 20px rgba(0,0,0,.12),inset 0 .5px 0 rgba(255,255,255,.05);white-space:nowrap;">${escapeHtml(navCopy.booking)}</a></td><td align="center" valign="middle" style="padding:0 0 0 6px;"><label class="theme-control" for="nika-email-theme" title="${escapeHtml(THEME_COPY[locale])}" aria-label="${escapeHtml(THEME_COPY[locale])}" style="display:inline-block;width:25px;height:25px;border:0;background:transparent;cursor:pointer;"><img class="control-icon theme-icon" src="${THEME_DARK_ICON_URL}" width="25" height="25" alt="${escapeHtml(THEME_COPY[locale])}" style="display:block;width:25px;height:25px;border:0;object-fit:contain;"></label></td></tr></table><div style="clear:both;height:0;font-size:0;line-height:0;">&nbsp;</div>${navigation}</td>
            </tr></table>
            <div class="eyebrow" style="margin-top:22px;color:#e4bd63;font-size:11px;font-weight:700;letter-spacing:2px;line-height:1.4;text-transform:uppercase;">${footer.eyebrow}</div>
            <h1 class="title" style="margin:12px 0 0;color:#fff4d1;font-family:Georgia,'Times New Roman',serif;font-size:27px;font-weight:700;line-height:1.2;">${escapeHtml(title)}</h1>
            <table role="presentation" width="96" cellpadding="0" cellspacing="0" border="0" style="width:96px;margin:22px 0 0;"><tr><td bgcolor="#c6a15b" style="height:1px;font-size:0;line-height:0;background-color:#c6a15b;">&nbsp;</td></tr></table>
          </td></tr>
          <tr><td class="content" bgcolor="#060b09" style="padding:32px;background-color:#060b09;color:#ece8df;font-size:16px;">${body}
            <table role="presentation" class="cta" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;"><tr><td bgcolor="#c6a15b" style="border-radius:8px;background-color:#c6a15b;"><a href="${SITE_URL}" style="display:inline-block;padding:12px 20px;color:#08120b;font-size:14px;font-weight:700;text-decoration:none;">${footer.cta}</a></td></tr></table>
          </td></tr>
          <tr><td class="footer" bgcolor="#060b09" style="padding:20px 32px 24px;background-color:#060b09;border-top:1px solid #d6e7dc1f;color:#aab8b1;font-size:12px;"><a href="${SITE_URL}" style="color:#e4bd63;font-weight:700;text-decoration:none;">HUNDESALON_NIKA</a><br>${footer.address}: Walter-Markov-Ring 1 · 04288 Leipzig<br>${footer.reply}</td></tr>
          <tr><td class="site-footer" bgcolor="#17140d" style="padding:22px 24px 20px;background-color:#17140d;background-image:linear-gradient(90deg,#17140d 0%,#2b2112 52%,#17140d 100%);border-top:1px solid #5f4c29;color:#9d9178;text-align:center;">
            <div style="margin:0 0 14px;text-align:center;">${footerNavigation}</div>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 13px;"><tr>${socialNavigation}<td align="center" style="padding-left:8px;"><a href="${SITE_URL}/${locale}/social.html" style="display:inline-block;padding:8px 12px;border:1px solid #65502b;border-radius:10px;background-color:#2a2114;color:#e1cf9f;font-family:Georgia,'Times New Roman',serif;font-size:11px;font-weight:700;letter-spacing:.35px;text-decoration:none;white-space:nowrap;"><img src="${ICON_URL}/social-links.png" width="18" height="18" alt="" style="display:inline-block;width:18px;height:18px;border:0;vertical-align:middle;margin-right:6px;">${escapeHtml(footer.allNetworks)}</a></td></tr></table>
            <div style="margin:0 0 8px;color:#9d9178;font-size:11px;">${legalNavigation}</div>
            <div style="color:#776d58;font-size:10px;">${escapeHtml(footer.copyright)}</div>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}
