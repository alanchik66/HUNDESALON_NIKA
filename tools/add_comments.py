#!/usr/bin/env python3
"""
=================================================================
HUNDESALON NIKA — Скрипт добавления профессиональных комментариев
Добавляет красивые, структурные HTML-комментарии во все страницы
=================================================================
"""
import os
import re

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ─── Словари комментариев для каждого языка ──────────────────────

COMMENTS = {
    'ru': {
        'head': '<!-- ═══════════════ SEO, мета-теги и подключение стилей ═══════════════ -->',
        'body': '<!-- ═══════════════════ Начало тела страницы ══════════════════════════ -->',
        'preloader': '<!-- ─── Прелоадер: анимация загрузки ─── -->',
        'header': '<!-- ══════════════════ Шапка сайта (Header) ═══════════════════════════ -->',
        'nav': '      <!-- Главное навигационное меню -->',
        'controls': '    <!-- Управление: выбор языка, онлайн-запись, тема -->',
        'lang': '      <!-- Выбор языка сайта -->',
        'social_bar': '<!-- ─── Панель социальных сетей и мини-плеер ─── -->',
        'social_icons': '    <!-- Иконки социальных сетей -->',
        'mobile_overlay': '<!-- ══════════════ Мобильное меню (выезжающая панель) ═══════════════ -->',
        'hero': '<!-- ══════════════════ Секция Hero: главный баннер ═════════════════════ -->',
        'about': '<!-- ══════════════════ Секция «О нас» ═══════════════════════════════ -->',
        'services': '<!-- ══════════════════ Секция «Наши услуги» ══════════════════════════ -->',
        'promotions': '<!-- ══════════════════ Секция «Акции месяца» ═════════════════════════ -->',
        'gallery': '<!-- ══════════════════ Секция «Фотогалерея» ══════════════════════════ -->',
        'reviews': '<!-- ══════════════════ Секция «Отзывы клиентов» ══════════════════════ -->',
        'footer': '<!-- ══════════════════ Подвал сайта (Footer) ══════════════════════════ -->',
        'scripts': '<!-- ═══════════════ Подключение скриптов ═════════════════════════════ -->',
    },
    'de': {
        'head': '<!-- ═══════════════ SEO, Meta-Tags und Stylesheets ═══════════════════ -->',
        'body': '<!-- ═══════════════════ Seitenkörper Beginn ══════════════════════════ -->',
        'preloader': '<!-- ─── Preloader: Ladeanimation ─── -->',
        'header': '<!-- ══════════════════ Seitenkopf (Header) ════════════════════════════ -->',
        'nav': '      <!-- Haupt-Navigationsmenü -->',
        'controls': '    <!-- Steuerung: Sprache, Online-Buchung, Thema -->',
        'lang': '      <!-- Sprachauswahl -->',
        'social_bar': '<!-- ─── Soziale Netzwerke Leiste ─── -->',
        'social_icons': '    <!-- Social-Media-Icons -->',
        'mobile_overlay': '<!-- ══════════════ Mobiles Menü (Seitenleiste) ═══════════════════════ -->',
        'hero': '<!-- ══════════════════ Hero-Sektion: Hauptbanner ═════════════════════ -->',
        'about': '<!-- ══════════════════ Sektion «Über uns» ═══════════════════════════ -->',
        'services': '<!-- ══════════════════ Sektion «Unsere Leistungen» ═══════════════════ -->',
        'promotions': '<!-- ══════════════════ Sektion «Aktionen des Monats» ═════════════════ -->',
        'gallery': '<!-- ══════════════════ Sektion «Fotogalerie» ═════════════════════════ -->',
        'reviews': '<!-- ══════════════════ Sektion «Kundenbewertungen» ═══════════════════ -->',
        'footer': '<!-- ══════════════════ Fußzeile (Footer) ══════════════════════════════ -->',
        'scripts': '<!-- ═══════════════ Skript-Einbindung ════════════════════════════════ -->',
    },
    'en': {
        'head': '<!-- ═══════════════ SEO, Meta Tags & Stylesheets ════════════════════ -->',
        'body': '<!-- ═══════════════════ Page Body Start ══════════════════════════════ -->',
        'preloader': '<!-- ─── Preloader: loading animation ─── -->',
        'header': '<!-- ══════════════════ Site Header ═════════════════════════════════════ -->',
        'nav': '      <!-- Main Navigation Menu -->',
        'controls': '    <!-- Controls: language selector, booking, theme -->',
        'lang': '      <!-- Language Selector -->',
        'social_bar': '<!-- ─── Social Media Bar ─── -->',
        'social_icons': '    <!-- Social Media Icons -->',
        'mobile_overlay': '<!-- ══════════════ Mobile Navigation (slide-out panel) ═══════════════ -->',
        'hero': '<!-- ══════════════════ Hero Section: Main Banner ═════════════════════ -->',
        'about': '<!-- ══════════════════ About Us Section ═════════════════════════════ -->',
        'services': '<!-- ══════════════════ Our Services Section ═════════════════════════ -->',
        'promotions': '<!-- ══════════════════ Monthly Promotions Section ═════════════════════ -->',
        'gallery': '<!-- ══════════════════ Photo Gallery Section ═════════════════════════ -->',
        'reviews': '<!-- ══════════════════ Client Reviews Section ════════════════════════ -->',
        'footer': '<!-- ══════════════════ Site Footer ════════════════════════════════════ -->',
        'scripts': '<!-- ═══════════════ Script Includes ══════════════════════════════════ -->',
    },
    'uk': {
        'head': '<!-- ═══════════════ SEO, мета-теги та підключення стилів ═════════════ -->',
        'body': '<!-- ═══════════════════ Початок тіла сторінки ════════════════════════ -->',
        'preloader': '<!-- ─── Прелоадер: анімація завантаження ─── -->',
        'header': '<!-- ══════════════════ Шапка сайту (Header) ═══════════════════════════ -->',
        'nav': '      <!-- Головне навігаційне меню -->',
        'controls': '    <!-- Керування: вибір мови, онлайн-запис, тема -->',
        'lang': '      <!-- Вибір мови сайту -->',
        'social_bar': '<!-- ─── Панель соціальних мереж ─── -->',
        'social_icons': '    <!-- Іконки соціальних мереж -->',
        'mobile_overlay': '<!-- ══════════════ Мобільне меню (висувна панель) ════════════════════ -->',
        'hero': '<!-- ══════════════════ Секція Hero: головний банер ════════════════════ -->',
        'about': '<!-- ══════════════════ Секція «Про нас» ════════════════════════════ -->',
        'services': '<!-- ══════════════════ Секція «Наші послуги» ═════════════════════════ -->',
        'promotions': '<!-- ══════════════════ Секція «Акції місяця» ══════════════════════════ -->',
        'gallery': '<!-- ══════════════════ Секція «Фотогалерея» ══════════════════════════ -->',
        'reviews': '<!-- ══════════════════ Секція «Відгуки клієнтів» ══════════════════════ -->',
        'footer': '<!-- ══════════════════ Підвал сайту (Footer) ══════════════════════════ -->',
        'scripts': '<!-- ═══════════════ Підключення скриптів ═════════════════════════════ -->',
    },
}

# ─── Комментарии для подстраниц ──────────────────────────────────

PAGE_HEADERS = {
    'ru': {
        'blog': 'Блог — Новости и статьи о груминге',
        'datenschutz': 'Защита данных — Политика конфиденциальности',
        'do-i-posle': 'До и После — Результаты работ',
        'galereya': 'Галерея — Фото наших работ',
        'impressum': 'Импрессум — Юридическая информация',
        'kontakty': 'Контакты — Связь с салоном',
        'nashi-uslugi': 'Наши Услуги — Полный список услуг',
        'o-nas': 'О Нас — Информация о салоне',
        'onlayn-bronirovanie': 'Онлайн Бронирование — Запись на приём',
        'partnerstvo': 'Партнёрство — Предложение для партнёров',
        'prays-list': 'Прайс-Лист — Цены на услуги',
        'reyting': 'Рейтинг — Отзывы и оценки',
        'social': 'Социальные сети — Все наши соцсети',
        'vvedenie': 'Введение — Добро пожаловать',
    },
    'de': {
        'blog': 'Blog — Neuigkeiten und Artikel über Grooming',
        'datenschutz': 'Datenschutz — Datenschutzerklärung',
        'do-i-posle': 'Vorher & Nachher — Arbeitsergebnisse',
        'galereya': 'Galerie — Fotos unserer Arbeiten',
        'impressum': 'Impressum — Rechtliche Informationen',
        'kontakty': 'Kontakte — Kontakt zum Salon',
        'nashi-uslugi': 'Unsere Leistungen — Vollständige Serviceliste',
        'o-nas': 'Über Uns — Informationen zum Salon',
        'onlayn-bronirovanie': 'Online-Buchung — Termin vereinbaren',
        'partnerstvo': 'Partnerschaft — Partnerangebote',
        'prays-list': 'Preisliste — Preise für Leistungen',
        'reyting': 'Bewertungen — Kundenfeedback',
        'social': 'Soziale Medien — Unsere Netzwerke',
        'vvedenie': 'Einführung — Willkommen',
    },
    'en': {
        'blog': 'Blog — News and Articles about Grooming',
        'datenschutz': 'Privacy Policy — Data Protection',
        'do-i-posle': 'Before & After — Work Results',
        'galereya': 'Gallery — Photos of Our Work',
        'impressum': 'Legal Notice — Legal Information',
        'kontakty': 'Contacts — Get in Touch',
        'nashi-uslugi': 'Our Services — Full Service List',
        'o-nas': 'About Us — Salon Information',
        'onlayn-bronirovanie': 'Online Booking — Schedule Appointment',
        'partnerstvo': 'Partnership — Partner Offers',
        'prays-list': 'Price List — Service Prices',
        'reyting': 'Rating — Reviews and Ratings',
        'social': 'Social Media — Our Networks',
        'vvedenie': 'Introduction — Welcome',
    },
    'uk': {
        'blog': 'Блог — Новини та статті про грумінг',
        'datenschutz': 'Захист даних — Політика конфіденційності',
        'do-i-posle': 'До і Після — Результати робіт',
        'galereya': 'Галерея — Фото наших робіт',
        'impressum': 'Імпресум — Юридична інформація',
        'kontakty': 'Контакти — Зв\'язок з салоном',
        'nashi-uslugi': 'Наші Послуги — Повний список послуг',
        'o-nas': 'Про Нас — Інформація про салон',
        'onlayn-bronirovanie': 'Онлайн Бронювання — Запис на прийом',
        'partnerstvo': 'Партнерство — Пропозиції для партнерів',
        'prays-list': 'Прайс-Лист — Ціни на послуги',
        'reyting': 'Рейтинг — Відгуки та оцінки',
        'social': 'Соціальні мережі — Усі наші соцмережі',
        'vvedenie': 'Вступ — Ласкаво просимо',
    },
}

LANG_NAMES = {'ru': 'Русская версия', 'de': 'Deutsche Version', 'en': 'English Version', 'uk': 'Українська версія'}


def insert_comment_before(html, search, comment, already_check=None):
    """Вставляет комментарий перед первым вхождением search, если ещё нет."""
    if already_check and already_check in html:
        return html
    # Проверяем, нет ли уже этого комментария
    if comment.strip() in html:
        return html
    idx = html.find(search)
    if idx == -1:
        return html
    return html[:idx] + comment + '\n' + html[idx:]


def add_section_comments_to_index(filepath, lang):
    """Добавляет секционные комментарии в index.html (во вторую — рабочую — часть файла)."""
    c = COMMENTS[lang]
    with open(filepath, 'r', encoding='utf-8') as f:
        html = f.read()

    # Находим начало второй (реальной) части — второй <head>
    first_head_end = html.find('</html>')
    if first_head_end == -1:
        real = html
        prefix = ''
    else:
        prefix = html[:first_head_end + len('</html>') + 1]
        real = html[first_head_end + len('</html>') + 1:]

    # Добавляем комментарии в реальную часть
    real = insert_comment_before(real, '<head>', c['head'])
    real = insert_comment_before(real, '<body>', c['body'])
    real = insert_comment_before(real, '<div id="preloader">', c['preloader'] + '\n')
    real = insert_comment_before(real, '<header class="header">', c['header'] + '\n')

    # Навигация
    real = insert_comment_before(real, '<nav class="nav-main">', c['nav'] + '\n')

    # Контролы
    real = insert_comment_before(real, '<div class="header-controls">', c['controls'] + '\n')

    # Языковой селектор
    real = insert_comment_before(real, '<div class="language-dropdown">', c['lang'] + '\n')

    # Социальная панель
    real = insert_comment_before(real, '<div class="social-bar">', c['social_bar'] + '\n')

    # Иконки соцсетей
    real = insert_comment_before(real, '<div class="social-icons">', c['social_icons'] + '\n')

    # Мобильная навигация
    real = insert_comment_before(real, '<div id="mobileNavOverlay">', c['mobile_overlay'] + '\n')

    # Hero
    real = insert_comment_before(real, '<section class="hero">', c['hero'] + '\n')

    # About
    real = insert_comment_before(real, '<section class="about', c['about'] + '\n')

    # Services
    real = insert_comment_before(real, '<section class="services', c['services'] + '\n')

    # Promotions
    real = insert_comment_before(real, '<section id="promotions"', c['promotions'] + '\n')

    # Gallery
    real = insert_comment_before(real, '<section class="gallery', c['gallery'] + '\n')

    # Reviews
    real = insert_comment_before(real, '<section class="reviews', c['reviews'] + '\n')

    # Footer
    real = insert_comment_before(real, '<footer class="footer">', c['footer'] + '\n')

    # Scripts (ищем первый <script src после footer)
    footer_end = real.find('</footer>')
    if footer_end != -1:
        after_footer = real[footer_end:]
        script_idx = after_footer.find('<script src=')
        if script_idx != -1 and c['scripts'] not in after_footer:
            after_footer = after_footer[:script_idx] + c['scripts'] + '\n' + after_footer[script_idx:]
            real = real[:footer_end] + after_footer

    result = prefix + real

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(result)
    print(f'  ✓ {filepath}')


def add_page_header_comment(filepath, lang, page_key):
    """Добавляет красивый заголовочный комментарий в начало подстраницы."""
    with open(filepath, 'r', encoding='utf-8') as f:
        html = f.read()

    page_name = PAGE_HEADERS.get(lang, {}).get(page_key, page_key)
    lang_name = LANG_NAMES.get(lang, lang)

    header_comment = f"""<!--
  ================================================================
  HUNDESALON NIKA — {page_name}
  {lang_name}
  ----------------------------------------------------------------
  Version: 2026-04-20
  ================================================================
-->"""

    # Проверяем, нет ли уже заголовочного комментария
    if 'HUNDESALON NIKA' in html[:300] and '═══' in html[:300]:
        return False

    # Находим начало второй (реальной) части
    first_end = html.find('</html>')
    if first_end != -1:
        prefix = html[:first_end + len('</html>')]
        rest = html[first_end + len('</html>'):]
        # Вставляем комментарий после первого </html>
        result = prefix + '\n' + header_comment + rest
    else:
        # Нет дублирования — вставляем перед <!DOCTYPE или <head
        if html.strip().startswith('<!DOCTYPE'):
            result = header_comment + '\n' + html
        elif html.strip().startswith('<head'):
            result = header_comment + '\n' + html
        else:
            result = header_comment + '\n' + html

    # Добавляем секционные комментарии к ключевым секциям
    c = COMMENTS[lang]
    result = insert_comment_before(result, '<div id="preloader">', c['preloader'] + '\n')
    result = insert_comment_before(result, '<header class="header">', c['header'] + '\n')
    result = insert_comment_before(result, '<div id="mobileNavOverlay">', c['mobile_overlay'] + '\n')
    result = insert_comment_before(result, '<footer class="footer">', c['footer'] + '\n')

    # Scripts
    footer_end_idx = result.rfind('</footer>')
    if footer_end_idx != -1:
        after_f = result[footer_end_idx:]
        scr_idx = after_f.find('<script src=')
        if scr_idx != -1 and c['scripts'] not in after_f:
            after_f = after_f[:scr_idx] + c['scripts'] + '\n' + after_f[scr_idx:]
            result = result[:footer_end_idx] + after_f

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(result)
    print(f'  ✓ {filepath}')
    return True


def process_root_index(filepath):
    """Добавляет комментарии в корневой index.html (страница выбора языка)."""
    with open(filepath, 'r', encoding='utf-8') as f:
        html = f.read()

    if '═══' in html[:200]:
        print(f'  ⊘ {filepath} (уже есть комментарии)')
        return

    header = """<!--
  ================================================================
  HUNDESALON NIKA — Language Selector / Auswahl der Sprache
  ----------------------------------------------------------------
  Root page: automatically redirects user to their preferred
  language version (DE / RU / UK / EN) based on browser settings
  or previously saved preference.
  Version: 2026-04-20
  ================================================================
-->"""

    if html.strip().startswith('<!DOCTYPE'):
        html = header + '\n' + html
    else:
        html = header + '\n' + html

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f'  ✓ {filepath}')


# ─── MAIN ────────────────────────────────────────────────────────

if __name__ == '__main__':
    print('='*60)
    print('HUNDESALON NIKA — Добавление профессиональных комментариев')
    print('='*60)

    # 1. Главные страницы (index.html) для каждого языка
    print('\n[1] Главные страницы (index.html):')
    for lang in ['ru', 'de', 'en', 'uk']:
        fpath = os.path.join(BASE, lang, 'index.html')
        if os.path.exists(fpath):
            add_section_comments_to_index(fpath, lang)

    # 2. Подстраницы для каждого языка
    print('\n[2] Подстраницы:')
    subpages = [
        'blog', 'datenschutz', 'do-i-posle', 'galereya', 'impressum',
        'kontakty', 'nashi-uslugi', 'o-nas', 'onlayn-bronirovanie',
        'partnerstvo', 'prays-list', 'reyting', 'social', 'vvedenie'
    ]
    count = 0
    for lang in ['ru', 'de', 'en', 'uk']:
        for page in subpages:
            fpath = os.path.join(BASE, lang, f'{page}.html')
            if os.path.exists(fpath):
                if add_page_header_comment(fpath, lang, page):
                    count += 1

    # 3. Корневой index.html
    print('\n[3] Корневой index.html:')
    root_index = os.path.join(BASE, 'index.html')
    if os.path.exists(root_index):
        process_root_index(root_index)

    print(f'\n{"="*60}')
    print(f'Готово! Обработано подстраниц: {count}')
    print(f'{"="*60}')
