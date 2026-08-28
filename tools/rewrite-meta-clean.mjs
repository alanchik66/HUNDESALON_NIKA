/**
 * Rewrite all meta descriptions to clean complete sentences, 160–168 chars.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIN = 160;
const MAX = 168;

const META = {
  'index.html': {
    de: 'Professioneller Hundesalon in Leipzig: Hundepflege und Katzenpflege, Haarschnitt, Baden, Fellpflege, Express-Entwollung und einfache Online-Buchung bei HUNDESALON NIKA.',
    en: 'Premium dog and cat grooming in Leipzig: haircuts, bathing, coat care, express deshedding and easy online booking at HUNDESALON NIKA — calm salon care.',
    ru: 'Профессиональный груминг собак и кошек в Лейпциге: стрижка, купание, уход за шерстью, экспресс-линька и удобная онлайн-запись в салоне HUNDESALON NIKA.',
    uk: 'Професійний грумінг собак і котів у Лейпцигу: стрижка, купання, догляд за шерстю, експрес-линька та зручний онлайн-запис у салоні HUNDESALON NIKA.',
  },
  'o-nas.html': {
    de: 'Lernen Sie HUNDESALON NIKA kennen: ein erfahrenes Pflegeteam in Leipzig mit Liebe zu Hunden und Katzen, transparenten Abläufen und ruhiger Betreuung im Salon vor Ort.',
    en: 'Meet HUNDESALON NIKA: an experienced grooming team in Leipzig with genuine care for dogs and cats, clear processes and a calm, stress-free salon visit.',
    ru: 'Познакомьтесь с HUNDESALON NIKA: опытная команда грумеров в Лейпциге с любовью к собакам и кошкам, прозрачным сервисом и спокойной атмосферой салона.',
    uk: 'Познайомтесь з HUNDESALON NIKA: досвідчена команда грумерів у Лейпцигу з любов’ю до собак і котів, прозорим сервісом і спокійною атмосферою салону.',
  },
  'nashi-uslugi.html': {
    de: 'Leistungen bei HUNDESALON NIKA in Leipzig: Haarschnitt, Baden, Zahnreinigung, Trimming, Ozontherapie, Express-Entwollung und Pflege — Termin online buchen.',
    en: 'Services at HUNDESALON NIKA in Leipzig: haircuts, bathing, teeth cleaning, trimming, ozone therapy, express deshedding and tailored care for pets.',
    ru: 'Услуги HUNDESALON NIKA в Лейпциге: стрижка, купание, чистка зубов, тримминг, озонотерапия, экспресс-линька и индивидуальный уход — запись онлайн.',
    uk: 'Послуги HUNDESALON NIKA у Лейпцигу: стрижка, купання, чищення зубів, тримінг, озонотерапія, експрес-линька та індивідуальний догляд — запис онлайн.',
  },
  'kontakty.html': {
    de: 'Kontakt zu HUNDESALON NIKA in Leipzig: Adresse, Telefon, Anfahrt, Öffnungszeiten und schnelle Wege zur Online-Terminbuchung für Hund und Katze im Salon.',
    en: 'Contact HUNDESALON NIKA in Leipzig: address, phone, directions, opening hours and quick ways to book grooming appointments for your dog or cat online.',
    ru: 'Контакты HUNDESALON NIKA в Лейпциге: адрес, телефон, как добраться, часы работы и удобные способы онлайн-записи на груминг для собак и кошек.',
    uk: 'Контакти HUNDESALON NIKA у Лейпцигу: адреса, телефон, як дістатися, години роботи та зручні способи онлайн-запису на грумінг для собак і котів.',
  },
  'galereya.html': {
    de: 'Fotogalerie von HUNDESALON NIKA in Leipzig: echte Vorher-Nachher-Ergebnisse, gepflegte Schnitte und glückliche Hunde und Katzen aus unserem Salonalltag.',
    en: 'HUNDESALON NIKA photo gallery in Leipzig: real before-and-after results, polished grooms and happy dogs and cats from our salon work in Saxony.',
    ru: 'Фотогалерея HUNDESALON NIKA в Лейпциге: реальные результаты до и после, аккуратные стрижки и счастливые питомцы из будней нашего груминг-салона.',
    uk: 'Фотогалерея HUNDESALON NIKA у Лейпцигу: реальні результати до й після, охайні стрижки та щасливі улюбленці з буднів нашого грумінг-салону.',
  },
  'prays-list.html': {
    de: 'Aktuelle Preisliste von HUNDESALON NIKA in Leipzig: transparente Pflegepreise für Hunde und Katzen — Haarschnitt, Baden, Trimming und Zusatzleistungen.',
    en: 'HUNDESALON NIKA price list in Leipzig: transparent grooming prices for dogs and cats — haircuts, bathing, trimming, coat care and salon extras.',
    ru: 'Прайс-лист HUNDESALON NIKA в Лейпциге: прозрачные цены на груминг для собак и кошек — стрижка, купание, тримминг, уход и дополнительные услуги.',
    uk: 'Прайс-лист HUNDESALON NIKA у Лейпцигу: прозорі ціни на грумінг для собак і котів — стрижка, купання, тримінг, догляд та додаткові послуги.',
  },
  'onlayn-bronirovanie.html': {
    de: 'Online-Terminbuchung bei HUNDESALON NIKA in Leipzig: Hundepflege und Katzenpflege mit wenigen Klicks, klarer Auswahl und ruhiger Betreuung reservieren. Jetzt buchen.',
    en: 'Book grooming online at HUNDESALON NIKA in Leipzig: reserve dog or cat appointments in a few clicks with clear service choices and calm salon care.',
    ru: 'Онлайн-запись в HUNDESALON NIKA в Лейпциге: забронируйте груминг для собаки или кошки за пару кликов с понятным выбором услуг и спокойной заботой.',
    uk: 'Онлайн-запис у HUNDESALON NIKA у Лейпцигу: забронюйте грумінг для собаки чи кота за кілька кліків із зрозумілим вибором послуг і спокійною турботою.',
  },
  'reyting.html': {
    de: 'Kundenbewertungen zu HUNDESALON NIKA in Leipzig: echte Erfahrungen mit Haarschnitt und Fellpflege — Transparenz, Vertrauen und zufriedene Tiere aus Leipzig und Sachsen.',
    en: 'Customer reviews of HUNDESALON NIKA in Leipzig: real experiences with grooming, haircuts and coat care — transparency, trust and happy pets.',
    ru: 'Отзывы клиентов о HUNDESALON NIKA в Лейпциге: реальный опыт груминга, стрижек и ухода — прозрачность, доверие и довольные собаки и кошки.',
    uk: 'Відгуки клієнтів про HUNDESALON NIKA у Лейпцигу: реальний досвід грумінгу, стрижок і догляду — прозорість, довіра та задоволені собаки й коти.',
  },
  'do-i-posle.html': {
    de: 'Vorher-Nachher bei HUNDESALON NIKA in Leipzig: sehen Sie Transformationen nach Haarschnitt, Baden und Fellpflege — Qualität, die man am Tier erkennt.',
    en: 'Before and after at HUNDESALON NIKA in Leipzig: see real transformations after grooming, haircuts and coat care — quality you can see on every pet.',
    ru: 'Фото до и после в HUNDESALON NIKA в Лейпциге: реальные изменения после груминга, стрижки и ухода за шерстью — качество, видное на каждом питомце.',
    uk: 'Фото до й після в HUNDESALON NIKA у Лейпцигу: реальні зміни після грумінгу, стрижки й догляду за шерстю — якість, яку видно на кожному улюбленці.',
  },
  'vvedenie.html': {
    de: 'Willkommen bei HUNDESALON NIKA in Leipzig: Einführung in unseren Salon, unser Pflegekonzept und die liebevolle Betreuung von Hunden und Katzen — jetzt online buchen.',
    en: 'Welcome to HUNDESALON NIKA in Leipzig: an introduction to our salon, grooming philosophy and caring approach to dogs and cats across Saxony.',
    ru: 'Добро пожаловать в HUNDESALON NIKA в Лейпциге: введение в наш салон, подход к грумингу и заботливое отношение к собакам и кошкам в Саксонии.',
    uk: 'Ласкаво просимо до HUNDESALON NIKA у Лейпцигу: вступ до нашого салону, підхід до грумінгу та дбайливе ставлення до собак і котів у Саксонії.',
  },
  'partnerstvo.html': {
    de: 'Partnerschaften mit HUNDESALON NIKA in Leipzig: Kooperationen mit Tierärzten, Hundeschulen, Fachgeschäften und Unternehmen für Tierwohl und professionelle Fellpflege.',
    en: 'Partner with HUNDESALON NIKA in Leipzig: collaborations for vets, dog schools, pet shops and local businesses around dog care and professional grooming.',
    ru: 'Партнёрство с HUNDESALON NIKA в Лейпциге: сотрудничество для ветклиник, кинологов, зоомагазинов и локального бизнеса в сфере ухода и груминга.',
    uk: 'Партнерство з HUNDESALON NIKA у Лейпцигу: співпраця для ветклінік, кінологів, зоомагазинів і локального бізнесу в сфері догляду та грумінгу.',
  },
  'social.html': {
    de: 'Folgen Sie HUNDESALON NIKA in Leipzig auf Instagram, Telegram, TikTok und anderen Kanälen: Einblicke in die Hundepflege, Pflegetipps und Salon-Neuigkeiten — jetzt buchen.',
    en: 'Follow HUNDESALON NIKA in Leipzig on Instagram, Telegram, TikTok and more: grooming insights, care tips and news from our dog and cat salon.',
    ru: 'Подписывайтесь на HUNDESALON NIKA в Лейпциге в Instagram, Telegram, TikTok и других сетях: закулисье груминга, советы по уходу и новости салона.',
    uk: 'Підписуйтесь на HUNDESALON NIKA у Лейпцигу в Instagram, Telegram, TikTok та інших мережах: закулісся грумінгу, поради з догляду та новини салону.',
  },
  'documents.html': {
    de: 'Unterlagen von HUNDESALON NIKA in Leipzig: Checklisten, Drive-Dokumente und Hinweise zur Vorbereitung auf den Pflegetermin für Hund und Katze — jetzt online ansehen.',
    en: 'Documents from HUNDESALON NIKA in Leipzig: checklists, Drive files and practical notes to prepare your dog or cat for a calm grooming appointment.',
    ru: 'Документы HUNDESALON NIKA в Лейпциге: чек-листы, файлы Google Drive и подсказки для подготовки собаки или кошки к спокойному визиту на груминг.',
    uk: 'Документи HUNDESALON NIKA у Лейпцигу: чек-листи, файли Google Drive і підказки для підготовки собаки чи кота до спокійного візиту на грумінг.',
  },
  'impressum.html': {
    de: 'Impressum von HUNDESALON NIKA in Leipzig: Anbieterkennzeichnung gemäß § 5 TMG, Kontakt, Verantwortlicher und rechtliche Angaben zum Hundesalon — jetzt online lesen.',
    en: 'Legal notice (Impressum) of HUNDESALON NIKA in Leipzig: provider information pursuant to § 5 TMG, contact details and legal salon information.',
    ru: 'Импрессум HUNDESALON NIKA в Лейпциге: сведения о поставщике по § 5 TMG, контакты, ответственное лицо и юридическая информация о груминг-салоне.',
    uk: 'Імпресум HUNDESALON NIKA у Лейпцигу: відомості про постачальника згідно з § 5 TMG, контакти, відповідальна особа та юридична інформація про салон.',
  },
  'datenschutz.html': {
    de: 'Datenschutzerklärung von HUNDESALON NIKA in Leipzig: wie wir personenbezogene Daten beim Website-Besuch und bei Online-Terminen schützen und verarbeiten.',
    en: 'Privacy policy of HUNDESALON NIKA in Leipzig: how we protect and process personal data when you visit our website or book grooming appointments.',
    ru: 'Политика конфиденциальности HUNDESALON NIKA в Лейпциге: как мы защищаем и обрабатываем персональные данные при посещении сайта и онлайн-записи.',
    uk: 'Політика конфіденційності HUNDESALON NIKA у Лейпцигу: як ми захищаємо та обробляємо персональні дані під час відвідування сайту та онлайн-запису.',
  },
  'hundesalon-leipzig.html': {
    de: 'Hundesalon in Leipzig bei HUNDESALON NIKA: Fellpflege, Hygiene, Baden, Haarschnitt und Online-Termine für Hunde und Katzen in ruhiger Atmosphäre.',
    en: 'Dog salon in Leipzig at HUNDESALON NIKA: coat care, hygiene, bathing, haircuts and online booking for dogs and cats in a calm professional atmosphere.',
    ru: 'Салон для собак в Лейпциге — HUNDESALON NIKA: уход за шерстью, гигиена, купание, стрижка и онлайн-запись для собак и кошек в спокойной атмосфере.',
    uk: 'Салон для собак у Лейпцигу — HUNDESALON NIKA: догляд за шерстю, гігієна, купання, стрижка та онлайн-запис для собак і котів у спокійній атмосфері.',
  },
  'blog/blog.html': {
    de: 'Pflegeblog von HUNDESALON NIKA in Leipzig: Fellpflege-Tipps, Haarschnitt-Trends und praxisnahe Artikel für Hunde- und Katzenbesitzer in Sachsen — jetzt online lesen.',
    en: 'HUNDESALON NIKA blog in Leipzig: grooming tips, haircut trends and practical articles for dog and cat owners across Saxony and Germany.',
    ru: 'Блог HUNDESALON NIKA в Лейпциге: советы по уходу за шерстью, тренды стрижек и практичные статьи для владельцев собак и кошек в Саксонии.',
    uk: 'Блог HUNDESALON NIKA у Лейпцигу: поради з догляду за шерстю, тренди стрижок і практичні статті для власників собак і котів у Саксонії.',
  },
  'blog/preimushchestva-ekspress-linki.html': {
    de: 'Warum Express-Entwollung bei HUNDESALON NIKA in Leipzig hilft: weniger Fell zu Hause, mehr Komfort für Hund und Katze und spürbar leichteres Fell.',
    en: 'Why express deshedding at HUNDESALON NIKA in Leipzig helps: less loose coat at home, more comfort for dogs and cats and lighter fur after care.',
    ru: 'Зачем экспресс-линька в HUNDESALON NIKA в Лейпциге: меньше шерсти дома, больше комфорта для собак и кошек и заметно легче шерсть после ухода.',
    uk: 'Навіщо експрес-линька в HUNDESALON NIKA у Лейпцигу: менше шерсті вдома, більше комфорту для собак і котів і помітно легша шерсть після догляду.',
  },
  'blog/kak-podgotovit-sobaku.html': {
    de: 'So bereiten Sie Hund oder Katze auf den Pflegetermin bei HUNDESALON NIKA vor: Checkliste, ruhige Anreise und Tipps für einen stressfreien Besuch.',
    en: 'How to prepare your dog or cat for grooming at HUNDESALON NIKA in Leipzig: checklist, calm arrival and tips for a stress-free salon visit.',
    ru: 'Как подготовить собаку или кошку к грумингу в HUNDESALON NIKA в Лейпциге: чек-лист, спокойный приезд и советы для безстрессового визита в салон.',
    uk: 'Як підготувати собаку чи кота до грумінгу в HUNDESALON NIKA у Лейпцигу: чек-лист, спокійний приїзд і поради для безстресового візиту в салон.',
  },
  'blog/plokhaya-strizhka.html': {
    de: 'Schlechten Hundeschnitt vermeiden: worauf Tierbesitzer achten sollten und wie HUNDESALON NIKA in Leipzig Qualität, Beratung und ruhige Abläufe sichert.',
    en: 'Avoid a bad dog haircut: what owners should look for and how HUNDESALON NIKA in Leipzig ensures quality, consultation and calm grooming workflows.',
    ru: 'Как избежать плохой стрижки: на что обратить внимание и как HUNDESALON NIKA в Лейпциге обеспечивает качество, консультацию и спокойный груминг.',
    uk: 'Як уникнути поганої стрижки: на що звернути увагу і як HUNDESALON NIKA у Лейпцигу забезпечує якість, консультацію та спокійний процес грумінгу.',
  },
  'blog/strizhka-koshek.html': {
    de: 'Katzenpflege bei HUNDESALON NIKA in Leipzig: wann ein Schnitt sinnvoll ist, wie wir Katzen schonend betreuen und welche Alternativen zur Schur es gibt.',
    en: 'Cat grooming at HUNDESALON NIKA in Leipzig: when a haircut makes sense, how we handle cats gently and which alternatives exist to a full shave.',
    ru: 'Стрижка кошек в HUNDESALON NIKA в Лейпциге: когда она нужна, как мы бережно работаем с кошками и какие альтернативы полной стрижке есть в салоне.',
    uk: 'Стрижка котів у HUNDESALON NIKA у Лейпцигу: коли вона потрібна, як ми дбайливо працюємо з котами та які альтернативи повній стрижці є в салоні.',
  },
  'blog/zashchita-ot-parazitov.html': {
    de: 'Parasitenschutz für Hunde und Katzen: praktische Tipps von HUNDESALON NIKA in Leipzig zu Vorsorge, Fellhygiene und sicherer Pflege im Alltag.',
    en: 'Parasite protection for dogs and cats: practical tips from HUNDESALON NIKA in Leipzig on prevention, coat hygiene and safe everyday pet care.',
    ru: 'Защита от паразитов у собак и кошек: практические советы HUNDESALON NIKA в Лейпциге о профилактике, гигиене шерсти и безопасном уходе дома.',
    uk: 'Захист від паразитів у собак і котів: практичні поради HUNDESALON NIKA у Лейпцигу про профілактику, гігієну шерсті та безпечний догляд удома.',
  },
};

const bad = [];
for (const [page, langs] of Object.entries(META)) {
  for (const [lang, text] of Object.entries(langs)) {
    const len = text.length;
    if (len < MIN || len > MAX) bad.push({ page, lang, len, text });
  }
}

function serializeConfig(obj) {
  const lines = [
    '/** Rich meta descriptions (160–168 chars) — de / en / ru / uk by page path inside lang folder. */',
    'export const META_DESCRIPTIONS = {',
  ];
  for (const [page, langs] of Object.entries(obj)) {
    lines.push(`  '${page}': {`);
    for (const [lang, text] of Object.entries(langs)) {
      lines.push(`    ${lang}: ${JSON.stringify(text)},`);
    }
    lines.push('  },');
  }
  lines.push('};', '');
  return lines.join('\n');
}

fs.writeFileSync(path.join(root, 'config', 'meta-descriptions.mjs'), serializeConfig(META), 'utf8');
console.log(JSON.stringify({ pages: Object.keys(META).length, bad }, null, 2));
if (bad.length) process.exit(1);
