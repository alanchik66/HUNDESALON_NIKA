/**
 * Expand thin gallery/documents/before-after pages with static SEO copy (4 langs).
 * Marker: data-thin-expand — idempotent replace.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NAP } from '../config/brand-profiles.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const marker = 'data-thin-expand';

const COPY = {
  documents: {
    de: {
      leadExtra:
        'Gute Vorbereitung macht den Besuch ruhiger — für Sie und Ihr Tier. Auf dieser Seite finden Sie die wichtigsten Unterlagen und Hinweise vor dem Pflegetermin in Leipzig.',
      h2: 'Was Sie hier finden',
      items: [
        'Checklisten zur Vorbereitung von Hund oder Katze auf den Salonbesuch',
        'Hinweise zu Impfungen, Parasitenschutz und Gesundheitszustand vor dem Termin',
        'Links zu Drive-Dokumenten und Formularen, die wir vor der Pflege nutzen',
        'Praktische Tipps für Anreise, Wartezeit und Abholung in Leipzig',
      ],
      body: `HUNDESALON NIKA arbeitet nach Termin. Bitte bringen Sie aktuelle Angaben zu Fellzustand, Besonderheiten und gewünschter Leistung mit. So können wir Haarschnitt, Baden und Pflege ohne unnötigen Stress planen. Adresse: ${NAP.street}, ${NAP.postalCode} ${NAP.locality}.`,
      more: 'Wenn Ihr Tier ängstlich ist, schreiben Sie uns vorab — wir planen mehr Zeit und ruhige Abläufe. Für Express-Entwollung, Hygiene oder einen umfassenden Pflegetermin finden Sie Details unter Leistungen und Preise. Die Dokumente auf dieser Seite ergänzen das Gespräch im Salon, ersetzen aber keine individuelle Beratung vor Ort.',
      cta: 'Jetzt Termin buchen',
      ctaHref: 'onlayn-bronirovanie.html',
      secondary: 'Leistungen ansehen',
      secondaryHref: 'nashi-uslugi.html',
    },
    en: {
      leadExtra:
        'Good preparation makes the visit calmer — for you and your pet. Here you will find the key documents and notes before a grooming appointment in Leipzig.',
      h2: 'What you will find here',
      items: [
        'Checklists to prepare your dog or cat for the salon visit',
        'Notes on vaccinations, parasite protection and health before the appointment',
        'Links to Drive documents and forms we use before grooming',
        'Practical tips for arrival, waiting and pickup in Leipzig',
      ],
      body: `HUNDESALON NIKA works by appointment. Please share coat condition, special needs and the service you want so we can plan haircut, bath and care without unnecessary stress. Address: ${NAP.street}, ${NAP.postalCode} ${NAP.locality}.`,
      more: 'If your pet is anxious, message us beforehand — we schedule extra time and calmer handling. For express deshedding, hygiene or a full grooming day, see services and prices. These documents support the salon conversation; they do not replace an in-person consultation.',
      cta: 'Book an appointment',
      ctaHref: 'onlayn-bronirovanie.html',
      secondary: 'View services',
      secondaryHref: 'nashi-uslugi.html',
    },
    ru: {
      leadExtra:
        'Хорошая подготовка делает визит спокойнее — для вас и питомца. Здесь собраны важные материалы и подсказки перед записью на груминг в Лейпциге.',
      h2: 'Что вы найдёте на странице',
      items: [
        'Чек-листы подготовки собаки или кошки к визиту в салон',
        'Заметки о прививках, защите от паразитов и самочувствии перед процедурой',
        'Ссылки на документы Drive и формы, которые мы используем перед грумингом',
        'Практические советы по приезду, ожиданию и забору питомца в Лейпциге',
      ],
      body: `HUNDESALON NIKA работает по предварительной записи. Сообщите состояние шерсти, особенности и желаемую услугу — так мы спокойно спланируем стрижку, купание и уход. Адрес: ${NAP.street}, ${NAP.postalCode} ${NAP.locality}.`,
      more: 'Если питомец тревожный, напишите заранее — заложим больше времени и спокойный темп. Экспресс-линька, гигиена или полный день груминга описаны в услугах и прайсе. Документы на странице дополняют разговор в салоне, но не заменяют очную консультацию.',
      cta: 'Записаться онлайн',
      ctaHref: 'onlayn-bronirovanie.html',
      secondary: 'Смотреть услуги',
      secondaryHref: 'nashi-uslugi.html',
    },
    uk: {
      leadExtra:
        'Добра підготовка робить візит спокійнішим — для вас і улюбленця. Тут зібрані важливі матеріали та підказки перед записом на грумінг у Лейпцигу.',
      h2: 'Що ви знайдете на сторінці',
      items: [
        'Чек-листи підготовки собаки чи кота до візиту в салон',
        'Нотатки про щеплення, захист від паразитів і самопочуття перед процедурою',
        'Посилання на документи Drive і форми, які ми використовуємо перед грумінгом',
        'Практичні поради щодо приїзду, очікування та забирання улюбленця в Лейпцигу',
      ],
      body: `HUNDESALON NIKA працює за попереднім записом. Повідомте стан шерсті, особливості та бажану послугу — так ми спокійно сплануємо стрижку, купання й догляд. Адреса: ${NAP.street}, ${NAP.postalCode} ${NAP.locality}.`,
      more: 'Якщо улюбленець тривожний, напишіть заздалегідь — закладемо більше часу й спокійний темп. Експрес-линька, гігієна чи повний день грумінгу описані в послугах і прайсі. Документи на сторінці доповнюють розмову в салоні, але не замінюють очну консультацію.',
      cta: 'Записатися онлайн',
      ctaHref: 'onlayn-bronirovanie.html',
      secondary: 'Дивитися послуги',
      secondaryHref: 'nashi-uslugi.html',
    },
  },
  'do-i-posle': {
    de: {
      intro:
        'Vorher-Nachher zeigt, wie Fell, Form und Pflege nach der professionellen Fellpflege wirken. Bei HUNDESALON NIKA in Leipzig dokumentieren wir echte Salon-Ergebnisse — Haarschnitt, Baden und Entwollung — damit Sie den Unterschied klar sehen.',
      h2: 'Warum Vorher & Nachher hilft',
      items: [
        'Sie erkennen den Stil und die Sorgfalt unseres Teams vor dem Termin',
        'Unterschiede bei Rasse, Felltyp und gewünschter Länge werden greifbar',
        'Transparente Ergebnisse schaffen Vertrauen vor der Online-Buchung',
      ],
      body: 'Ziehen Sie den Regler, vergleichen Sie Details und wählen Sie danach Leistungen oder einen Termin. Für mehr Fotos aus dem Alltag des Salons besuchen Sie die Galerie.',
      more: 'Jedes Tier ist anders: Länge, Volumen und Pflegebedarf hängen von Rasse, Saison und Alltag ab. Die Fotos zeigen typische Ergebnisse aus unserem Salon in Leipzig — als Orientierung, nicht als Garantie für ein identisches Finish. Vor dem Termin klären wir Wünsche und Machbarkeit persönlich.',
      cta: 'Termin online buchen',
      ctaHref: 'onlayn-bronirovanie.html',
      secondary: 'Zur Preisliste',
      secondaryHref: 'prays-list.html',
    },
    en: {
      intro:
        'Before and after shows how coat, shape and care look after grooming. At HUNDESALON NIKA in Leipzig we document real salon results — haircuts, baths and deshedding — so you can see the difference clearly.',
      h2: 'Why before & after helps',
      items: [
        'You can see our team’s style and care before you book',
        'Differences by breed, coat type and desired length become tangible',
        'Transparent results build trust before online booking',
      ],
      body: 'Drag the slider, compare details, then choose a service or appointment. For more everyday salon photos, visit the gallery.',
      more: 'Every pet is different: length, volume and care needs depend on breed, season and daily life. Photos show typical results from our Leipzig salon — guidance, not a promise of an identical finish. Before the visit we discuss wishes and what is realistic for your pet.',
      cta: 'Book online',
      ctaHref: 'onlayn-bronirovanie.html',
      secondary: 'View price list',
      secondaryHref: 'prays-list.html',
    },
    ru: {
      intro:
        'Фото до и после показывают, как выглядят шерсть, форма и уход после груминга. В HUNDESALON NIKA в Лейпциге мы фиксируем реальные результаты салона — стрижку, купание и вычёсывание — чтобы разница была видна.',
      h2: 'Зачем смотреть до и после',
      items: [
        'Вы заранее видите стиль и аккуратность нашей команды',
        'Разница по породе, типу шерсти и желаемой длине становится понятнее',
        'Прозрачные результаты повышают доверие перед онлайн-записью',
      ],
      body: 'Двигайте ползунок, сравнивайте детали и затем выбирайте услугу или время. Больше повседневных фото салона — в галерее.',
      more: 'Каждый питомец уникален: длина, объём и уход зависят от породы, сезона и образа жизни. Фото — типичные результаты нашего салона в Лейпциге, ориентир, а не обещание идентичного финиша. Перед визитом обсуждаем пожелания и реалистичный результат.',
      cta: 'Записаться онлайн',
      ctaHref: 'onlayn-bronirovanie.html',
      secondary: 'Смотреть прайс',
      secondaryHref: 'prays-list.html',
    },
    uk: {
      intro:
        'Фото до й після показують, як виглядають шерсть, форма й догляд після грумінгу. У HUNDESALON NIKA у Лейпцигу ми фіксуємо реальні результати салону — стрижку, купання й вичісування — щоб різниця була видно.',
      h2: 'Навіщо дивитися до й після',
      items: [
        'Ви заздалегідь бачите стиль і акуратність нашої команди',
        'Різниця за породою, типом шерсті та бажаною довжиною стає зрозумілішою',
        'Прозорі результати підвищують довіру перед онлайн-записом',
      ],
      body: 'Рухайте повзунок, порівнюйте деталі й далі обирайте послугу або час. Більше повсякденних фото салону — в галереї.',
      more: 'Кожен улюбленець унікальний: довжина, об’єм і догляд залежать від породи, сезону та способу життя. Фото — типові результати нашого салону в Лейпцигу, орієнтир, а не обіцянка ідентичного фінішу. Перед візитом обговорюємо побажання та реалістичний результат.',
      cta: 'Записатися онлайн',
      ctaHref: 'onlayn-bronirovanie.html',
      secondary: 'Дивитися прайс',
      secondaryHref: 'prays-list.html',
    },
  },
  galereya: {
    de: {
      intro:
        'In der Galerie von HUNDESALON NIKA sehen Sie Ausschnitte aus dem Salonalltag in Leipzig: gepflegte Schnitte, glänzendes Fell und ruhige Betreuung für Hunde und Katzen.',
      h2: 'Was die Galerie zeigt',
      items: [
        'Haarschnitte und Fellpflege für unterschiedliche Rassen und Felltypen',
        'Hygiene und Form — von Alltagspflege bis ausdrucksstarkem Finish',
        'Atmosphäre eines modernen Hundesalons in Sachsen',
      ],
      body: 'Bilder ersetzen keine Beratung: für die passende Leistung und Länge sprechen wir vor dem Termin. Vorher-Nachher-Vergleiche finden Sie auf der Transformationsseite; Termine buchen Sie online.',
      more: 'Wir pflegen Hunde und Katzen mit Fokus auf Hygiene, Komfort und ein sauberes Finish. Die Galerie wird laufend ergänzt und spiegelt reale Arbeit im Salon wider — inklusive unterschiedlicher Felltypen und Stile, die Kunden in Leipzig häufig wünschen.',
      cta: 'Vorher & Nachher ansehen',
      ctaHref: 'do-i-posle.html',
      secondary: 'Leistungen & Termin',
      secondaryHref: 'nashi-uslugi.html',
    },
    en: {
      intro:
        'The HUNDESALON NIKA gallery shows everyday salon work in Leipzig: polished cuts, healthy coats and calm care for dogs and cats.',
      h2: 'What the gallery shows',
      items: [
        'Haircuts and coat care for different breeds and coat types',
        'Hygiene and shape — from everyday tidy-ups to expressive finishes',
        'The atmosphere of a modern grooming salon in Saxony',
      ],
      body: 'Photos do not replace a consultation: we discuss the right service and length before your visit. See before-and-after comparisons on the transformations page, and book online when you are ready.',
      more: 'We care for dogs and cats with a focus on hygiene, comfort and a clean finish. The gallery grows over time and reflects real salon work — including coat types and styles clients in Leipzig often ask for.',
      cta: 'View before & after',
      ctaHref: 'do-i-posle.html',
      secondary: 'Services & booking',
      secondaryHref: 'nashi-uslugi.html',
    },
    ru: {
      intro:
        'Галерея HUNDESALON NIKA показывает будни салона в Лейпциге: аккуратные стрижки, ухоженная шерсть и спокойная работа с собаками и кошками.',
      h2: 'Что показывает галерея',
      items: [
        'Стрижки и уход за шерстью для разных пород и типов шерсти',
        'Гигиена и форма — от повседневного ухода до выразительного финиша',
        'Атмосфера современного груминг-салона в Саксонии',
      ],
      body: 'Фото не заменяют консультацию: длину и услугу мы обсуждаем до визита. Сравнения до и после — на странице трансформаций; запись — онлайн.',
      more: 'Мы ухаживаем за собаками и кошками с акцентом на гигиену, комфорт и аккуратный финиш. Галерея пополняется и отражает реальную работу салона — разные типы шерсти и стили, которые часто выбирают клиенты в Лейпциге.',
      cta: 'Смотреть до и после',
      ctaHref: 'do-i-posle.html',
      secondary: 'Услуги и запись',
      secondaryHref: 'nashi-uslugi.html',
    },
    uk: {
      intro:
        'Галерея HUNDESALON NIKA показує будні салону в Лейпцигу: охайні стрижки, доглянута шерсть і спокійна робота з собаками й котами.',
      h2: 'Що показує галерея',
      items: [
        'Стрижки й догляд за шерстю для різних порід і типів шерсті',
        'Гігієна та форма — від повсякденного догляду до виразного фінішу',
        'Атмосфера сучасного грумінг-салону в Саксонії',
      ],
      body: 'Фото не замінюють консультацію: довжину й послугу обговорюємо до візиту. Порівняння до й після — на сторінці трансформацій; запис — онлайн.',
      more: 'Ми дбаємо про собак і котів з акцентом на гігієну, комфорт і акуратний фініш. Галерея поповнюється й відображає реальну роботу салону — різні типи шерсті та стилі, які часто обирають клієнти в Лейпцигу.',
      cta: 'Дивитися до й після',
      ctaHref: 'do-i-posle.html',
      secondary: 'Послуги та запис',
      secondaryHref: 'nashi-uslugi.html',
    },
  },
};

function block(pageKey, lang) {
  const t = COPY[pageKey][lang];
  const list = t.items.map((item) => `            <li>${item}</li>`).join('\n');
  // documents lead is expanded in-place on existing booking-lead; avoid duplicate
  return `        <div class="thin-expand" ${marker}>
          <h2 class="section-title" style="font-size:1.35rem;margin-top:1.5rem">${t.h2}</h2>
          <ul class="thin-expand__list">
${list}
          </ul>
          <p>${t.body}</p>
${t.more ? `          <p>${t.more}</p>\n` : ''}          <p class="gallery-cta" style="margin-top:1.25rem">
            <a href="${t.ctaHref}" class="btn-neon">${t.cta}</a>
            <a href="${t.secondaryHref}" class="btn-neon" style="margin-left:0.75rem">${t.secondary}</a>
          </p>
        </div>
`;
}

function expandIntro(html, pageKey, lang) {
  const t = COPY[pageKey][lang];
  if (pageKey === 'documents' && t.leadExtra) {
    return html.replace(/<p class="booking-lead">[^<]*<\/p>/, `<p class="booking-lead">${t.leadExtra}</p>`);
  }
  if (!t.intro) return html;
  if (pageKey === 'do-i-posle') {
    return html.replace(/<p class="gallery-intro">[^<]*<\/p>/, `<p class="gallery-intro">${t.intro}</p>`);
  }
  if (pageKey === 'galereya') {
    return html.replace(/<p class="section-center">[^<]*<\/p>/, `<p class="section-center">${t.intro}</p>`);
  }
  return html;
}

function upsert(html, pageKey, lang, insertAfter) {
  const card = block(pageKey, lang);
  const re = new RegExp(
    `\\s*<div class="thin-expand" ${marker}>[\\s\\S]*?</div>\\s*`,
    'i'
  );
  if (re.test(html)) return html.replace(re, `\n${card}`);
  if (!html.includes(insertAfter)) {
    throw new Error(`anchor not found for ${pageKey}/${lang}: ${insertAfter.slice(0, 60)}`);
  }
  return html.replace(insertAfter, `${insertAfter}\n${card}`);
}

const jobs = [
  {
    file: 'documents.html',
    key: 'documents',
    after: {
      de: '<div class="documents-grid" data-documents-list></div>',
      en: '<div class="documents-grid" data-documents-list></div>',
      ru: '<div class="documents-grid" data-documents-list></div>',
      uk: '<div class="documents-grid" data-documents-list></div>',
    },
  },
  {
    file: 'do-i-posle.html',
    key: 'do-i-posle',
    after: {
      de: '<p class="gallery-intro">Interaktive Galerie: Vorher & Nachher — ziehen Sie den Regler!</p>',
      en: '<p class="gallery-intro">Interactive gallery: Before & After — drag the slider!</p>',
      ru: null, // detect
      uk: null,
    },
  },
  {
    file: 'galereya.html',
    key: 'galereya',
    after: {
      de: '<p class="section-center">Unsere Arbeit — das Ergebnis von Leidenschaft und Professionalität</p>',
      en: '<p class="section-center">Our work — the result of love and professionalism</p>',
      ru: null,
      uk: null,
    },
  },
];

function findIntroLine(html, patterns) {
  for (const p of patterns) {
    const m = html.match(p);
    if (m) return m[0];
  }
  return null;
}

let updated = 0;
for (const lang of ['de', 'en', 'ru', 'uk']) {
  for (const job of jobs) {
    const file = path.join(root, lang, job.file);
    let html = fs.readFileSync(file, 'utf8');
    let anchor = job.after[lang];

    if (!anchor && job.key === 'do-i-posle') {
      anchor = findIntroLine(html, [
        /<p class="gallery-intro">[^<]*<\/p>/,
      ]);
    }
    if (!anchor && job.key === 'galereya') {
      anchor = findIntroLine(html, [
        /<p class="section-center">[^<]*<\/p>/,
      ]);
    }
    if (!anchor) throw new Error(`No anchor ${lang}/${job.file}`);

    html = expandIntro(html, job.key, lang);
    // re-resolve anchor after intro replace
    if (job.key === 'do-i-posle') {
      anchor = findIntroLine(html, [/<p class="gallery-intro">[^<]*<\/p>/]);
    }
    if (job.key === 'galereya') {
      anchor = findIntroLine(html, [/<p class="section-center">[^<]*<\/p>/]);
    }
    html = upsert(html, job.key, lang, anchor);
    fs.writeFileSync(file, html, 'utf8');
    updated += 1;
    console.log(`expanded ${lang}/${job.file}`);
  }
}
console.log(JSON.stringify({ updated }));
