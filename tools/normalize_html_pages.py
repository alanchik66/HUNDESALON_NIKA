from __future__ import annotations

"""
Mass HTML normalization for localized site pages.

What this script does:
- keeps shared assets/version strings aligned
- injects shared CSS/JS modules for repeated page features
- removes page-specific inline <style>/<script> blocks from special pages
- replaces repeated inline styles with reusable utility classes
- remaps gallery/background markup to shared CSS classes
- normalizes hidden sendmail metadata
- repairs known broken localized labels and language switchers
"""

import re
from pathlib import Path

import ftfy


ROOT = Path(__file__).resolve().parents[1]
LANGS = {"ru", "uk", "en", "de"}

STYLE_VERSION = "20260411-01"
MAIN_VERSION = "20260411-01"
SITE_SHELL_VERSION = "20260512-78"
PAGE_MODULES_VERSION = "20260411-01"

SPECIAL_PAGES = {
    "onlayn-bronirovanie.html",
    "partnerstvo.html",
    "prays-list.html",
    "reyting.html",
    "social.html",
}

STYLE_CLASS_REPLACEMENTS = {
    "margin-top: 100px;": "page-offset-top",
    "background: var(--glass-bg); backdrop-filter: blur(8px); border-radius: 28px; padding: 1.5rem; border: 1px solid var(--glass-border);": "glass-card",
    "max-width: 800px; margin: 0 auto; padding: 2rem 0;": "content-article",
    "color: var(--accent-gold); margin-bottom: 1rem;": "meta-accent",
    "margin-top: 2rem;": "stack-top-lg",
    "text-align: center; margin-bottom: 2rem;": "section-center",
    "text-align:center;margin-bottom:2rem;": "section-center",
    "color: var(--accent-gold); text-align: center;": "accent-center",
    "color: var(--accent-gold);": "accent-text",
    "font-size: 3rem; color: var(--accent-gold);": "icon-accent-lg",
    "display: flex; flex-direction: column; gap: 2rem;": "stack-column-lg",
    "grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));": "services-grid--compact",
    "border:0;": "map-embed",
    "display: flex; align-items: center; gap: 8px; margin: 8px 0; border-radius: 999px; padding: 12px 24px; justify-content: center; text-decoration: none; color: var(--accent-gold); font-weight: 600;": "cta-pill-link",
}

EURO_ICON_MARKUP = '<span class="site-icon site-icon--euro currency-inline" role="img" aria-label="euro"></span>'
JOB_HEADING_ICON_MARKUP = '<span class="site-icon site-icon--job heading-job-icon" aria-hidden="true"></span>'
EURO_SYMBOL = "\u20ac"
EURO_INLINE_PATTERN = re.compile(r"(?:\s|&nbsp;|\u00a0)*" + re.escape(EURO_ICON_MARKUP) + r"(?:\s|&nbsp;|\u00a0)*")
EURO_PREV_SPACE_PATTERN = re.compile(r"(?<=[0-9\w%])" + re.escape(EURO_ICON_MARKUP))
EURO_NEXT_WORD_SPACE_PATTERN = re.compile(re.escape(EURO_ICON_MARKUP) + r"(?=\w)")
MOJIBAKE_MARKERS = set("Р РЎР’РІР‚РѓвЂљвЂћвЂ¦вЂ вЂЎв‚¬вЂ°в„ўС™СљСњС›Сџ")
MOJIBAKE_TOKEN_RE = re.compile(r"""[^\s<>"'=]+""")
LANG_FLAG_BLOCK_RE = re.compile(r'(<div class="lang-flags">)(.*?)(</div>)', re.S)
LANG_FLAG_LINK_RE = re.compile(r'<a href="(?P<href>[^"]+)" class="flag-item(?: active)?">')

UK_TEXT_FIXES = {
    "РџР&nbsp;О НАС": "ПРО НАС",
    "Р'СТУП": "ВСТУП",
    "Креативный груминг": "Креативний грумінг",
    "<!-- ЯЗЫКОВОЕ МЕНЮ -->": "<!-- МЕНЮ МОВ -->",
    "<!-- На странице social.html иконки соцсетей в шапке скрыты -->": "<!-- На сторінці social.html іконки соцмереж у шапці приховані -->",
}

GLOBAL_TEXT_FIXES = {
    "Р&nbsp;усский": "Русский",
}


def get_asset_prefix(path: Path) -> str:
    rel = path.relative_to(ROOT)
    return "../../assets" if "blog" in rel.parts else "../assets"


def ensure_after(html: str, anchor_pattern: str, snippet: str) -> str:
    if snippet.strip() in html:
        return html

    return re.sub(anchor_pattern, r"\1" + snippet, html, count=1)


def add_page_modules_link(html: str, asset_prefix: str) -> str:
    snippet = f'  <link rel="stylesheet" href="{asset_prefix}/css/page-modules.css?v={PAGE_MODULES_VERSION}">\n'
    anchor = r'(<link rel="stylesheet" href="' + re.escape(asset_prefix) + r'/css/style\.css(?:\?v=[^"]+)?">\n)'
    return ensure_after(html, anchor, snippet)


def add_site_shell_script(html: str, asset_prefix: str) -> str:
    snippet = f'  <script src="{asset_prefix}/js/site-shell.js?v={SITE_SHELL_VERSION}"></script>\n'
    anchor = r'(\s*<script src="' + re.escape(asset_prefix) + r'/js/main\.js(?:\?v=[^"]+)?"></script>\n)'
    return ensure_after(html, anchor, snippet)


def add_page_modules_script(html: str, asset_prefix: str) -> str:
    snippet = f'  <script src="{asset_prefix}/js/page-modules.js?v={PAGE_MODULES_VERSION}"></script>\n'
    anchor = r'(<script src="' + re.escape(asset_prefix) + r'/js/main\.js(?:\?v=[^"]+)?"></script>\n)'
    return ensure_after(html, anchor, snippet)


def normalize_versions(html: str, asset_prefix: str) -> str:
    replacements = {
        rf'{re.escape(asset_prefix)}/css/style\.css(?:\?v=[^"]+)?': f"{asset_prefix}/css/style.css?v={STYLE_VERSION}",
        rf'{re.escape(asset_prefix)}/js/main\.js(?:\?v=[^"]+)?': f"{asset_prefix}/js/main.js?v={MAIN_VERSION}",
        rf'{re.escape(asset_prefix)}/js/site-shell\.js(?:\?v=[^"]+)?': f"{asset_prefix}/js/site-shell.js?v={SITE_SHELL_VERSION}",
        rf'{re.escape(asset_prefix)}/css/page-modules\.css(?:\?v=[^"]+)?': f"{asset_prefix}/css/page-modules.css?v={PAGE_MODULES_VERSION}",
        rf'{re.escape(asset_prefix)}/js/page-modules\.js(?:\?v=[^"]+)?': f"{asset_prefix}/js/page-modules.js?v={PAGE_MODULES_VERSION}",
    }

    for pattern, replacement in replacements.items():
        html = re.sub(pattern, replacement, html)

    return html


def normalize_shared_script_order(html: str, asset_prefix: str) -> str:
    main_tag = f'<script src="{asset_prefix}/js/main.js?v={MAIN_VERSION}"></script>'
    shell_tag = f'<script src="{asset_prefix}/js/site-shell.js?v={SITE_SHELL_VERSION}"></script>'
    modules_tag = f'<script src="{asset_prefix}/js/page-modules.js?v={PAGE_MODULES_VERSION}"></script>'

    if main_tag not in html:
        return html

    html = re.sub(rf"\s*{re.escape(shell_tag)}\s*", "\n", html)
    html = re.sub(rf"\s*{re.escape(main_tag)}\s*", "\n", html)
    html = re.sub(rf"\s*{re.escape(modules_tag)}\s*", "\n", html)

    shared_block = f"\n{shell_tag}\n{main_tag}\n{modules_tag}\n"

    tooltip_pattern = re.escape(f'<script src="{asset_prefix}/js/tooltip.js?v=20260330-0001"></script>')
    if re.search(tooltip_pattern, html):
        return re.sub(tooltip_pattern, shared_block + r"\g<0>", html, count=1)

    return html.replace("</body>", shared_block + "</body>", 1)


def strip_inline_assets(html: str, page_name: str) -> str:
    if page_name not in SPECIAL_PAGES:
        return html

    html = re.sub(r"\n\s*<style>.*?</style>\s*\n", "\n", html, flags=re.S)
    html = re.sub(r"\n\s*<script>(?:(?!</script>).)*</script>\s*\n", "\n", html, flags=re.S)
    return html


def normalize_repair_input(text: str) -> str:
    return text.replace("&nbsp;", "\u00a0").replace(EURO_ICON_MARKUP, EURO_SYMBOL)


def score_mojibake(value: str) -> int:
    return sum(char in MOJIBAKE_MARKERS for char in value)


def repair_mojibake_tokens(text: str) -> str:
    def repl(match: re.Match[str]) -> str:
        token = match.group(0)
        if score_mojibake(token) == 0:
            return token

        candidates = [token]
        for encoding in ("cp1251", "cp1252", "latin1"):
            try:
                candidates.append(token.encode(encoding).decode("utf-8"))
            except UnicodeError:
                continue

        best = min(candidates, key=score_mojibake)
        return best if score_mojibake(best) < score_mojibake(token) else token

    repaired = text
    for _ in range(3):
        next_text = MOJIBAKE_TOKEN_RE.sub(repl, repaired)
        if next_text == repaired:
            break
        repaired = next_text

    return repaired


def replace_exact_style_with_class(html: str, style_value: str, class_name: str) -> str:
    pattern = re.compile(
        r"<(?P<tag>[a-zA-Z0-9]+)(?P<attrs>[^>]*?)\sstyle=\"" + re.escape(style_value) + r'"(?P<tail>[^>]*)>',
        re.S,
    )

    def repl(match: re.Match[str]) -> str:
        tag = match.group("tag")
        attrs = f'{match.group("attrs")}{match.group("tail")}'
        class_match = re.search(r'\bclass="([^"]*)"', attrs)

        if class_match:
            classes = class_match.group(1).split()
            if class_name not in classes:
                classes.append(class_name)
            attrs = re.sub(r'\bclass="[^"]*"', f'class="{" ".join(classes)}"', attrs, count=1)
        else:
            attrs = f'{attrs} class="{class_name}"'

        return f"<{tag}{attrs}>"

    return pattern.sub(repl, html)


def replace_inline_style_attributes(html: str) -> str:
    for style_value, class_name in STYLE_CLASS_REPLACEMENTS.items():
        html = replace_exact_style_with_class(html, style_value, class_name)

    return html


def replace_gallery_and_layout_patterns(html: str) -> str:
    html = re.sub(
        r"""<div class="gallery-item" style="background-image:\s*url\('\.\./assets/images/gallery([1-6])\.jpg'\);"></div>""",
        lambda match: f'<div class="gallery-item gallery-item--{match.group(1)}"></div>',
        html,
    )

    before_after_map = {
        "before1": "1",
        "after1": "2",
        "before2": "3",
        "after2": "4",
    }

    html = re.sub(
        r"""<div class="gallery-item" style="background-image:\s*url\('\.\./assets/images/(before1|after1|before2|after2)\.jpg'\);"><div class="gallery-caption">([^<]+)</div></div>""",
        lambda match: (
            f'<div class="gallery-item gallery-item--{before_after_map[match.group(1)]}">'
            f'<div class="gallery-caption">{match.group(2)}</div></div>'
        ),
        html,
    )

    return html


def clean_decorative_emoji(html: str) -> str:
    html = html.replace(">\u2600\ufe0f</button>", "></button>")
    html = re.sub(r'(<div class="promo-badge">)\s*[\U0001f525\U0001f389\u2b50]+\s*', r"\1", html)
    return html


def replace_euro_symbols(html: str) -> str:
    html = re.sub(r"(?<=\d)\s*\u20ac", f"&nbsp;{EURO_ICON_MARKUP}", html)
    html = re.sub(r"\u20ac(?=\s*\d)", EURO_ICON_MARKUP, html)
    return html


def normalize_euro_markup(html: str) -> str:
    return EURO_INLINE_PATTERN.sub(EURO_ICON_MARKUP, html)


def normalize_euro_spacing(html: str) -> str:
    html = EURO_PREV_SPACE_PATTERN.sub(f"&nbsp;{EURO_ICON_MARKUP}", html)
    html = EURO_NEXT_WORD_SPACE_PATTERN.sub(f"{EURO_ICON_MARKUP} ", html)
    return html


def restore_nbsp_entities(html: str) -> str:
    return html.replace("\u00a0", "&nbsp;")


def replace_job_heading_icons(html: str) -> str:
    return re.sub(
        r"<h2>\s*\u2702(?:\ufe0f)?\s*",
        f"<h2>{JOB_HEADING_ICON_MARKUP} ",
        html,
    )


def fix_known_text_artifacts(html: str, lang: str) -> str:
    for source, target in GLOBAL_TEXT_FIXES.items():
        html = html.replace(source, target)
        html = html.replace(source.replace("&nbsp;", "\u00a0"), target)

    if lang != "uk":
        return html

    for source, target in UK_TEXT_FIXES.items():
        html = html.replace(source, target)
        html = html.replace(source.replace("&nbsp;", "\u00a0"), target)

    return html


def normalize_language_flags(html: str, lang: str) -> str:
    def block_repl(match: re.Match[str]) -> str:
        block = match.group(2)

        def link_repl(link_match: re.Match[str]) -> str:
            href = link_match.group("href").replace("\\", "/")
            is_active = f"/{lang}/" in href
            active_class = " active" if is_active else ""
            return f'<a href="{href}" class="flag-item{active_class}">'

        updated_block = LANG_FLAG_LINK_RE.sub(link_repl, block)
        return f"{match.group(1)}{updated_block}{match.group(3)}"

    return LANG_FLAG_BLOCK_RE.sub(block_repl, html)


def inject_hidden_fields(html: str, page_name: str, lang: str) -> str:
    contact_form = '<form action="../sendmail.php" method="POST">'
    if page_name == "kontakty.html" and contact_form in html and 'name="form_type"' not in html:
        html = html.replace(
            contact_form,
            contact_form
            + f'\n        <input type="hidden" name="form_type" value="contact">\n'
            + f'        <input type="hidden" name="lang" value="{lang}">',
            1,
        )

    feedback_form = '<form action="../sendmail.php" method="POST">'
    if page_name == "reyting.html" and feedback_form in html and 'name="form_type"' not in html:
        html = html.replace(
            feedback_form,
            feedback_form
            + f'\n        <input type="hidden" name="form_type" value="feedback">\n'
            + f'        <input type="hidden" name="lang" value="{lang}">',
            1,
        )

    if page_name in {"kontakty.html", "reyting.html"}:
        html = re.sub(r'(<textarea name="message"[^>]*)(?<!required)>', r"\1 required>", html, count=1)

    return html


def fix_known_copy_issues(html: str, rel: Path) -> str:
    html = html.replace("Teplice", "Leipzig")

    if rel.as_posix().endswith("prays-list.html"):
        lang = rel.parts[0]
        html = re.sub(
            r'<meta property="og:url" content="[^"]+">',
            f'<meta property="og:url" content="../{lang}/prays-list.html">',
            html,
            count=1,
        )

    return html


def normalize_page(path: Path) -> bool:
    rel = path.relative_to(ROOT)
    asset_prefix = get_asset_prefix(path)
    page_name = rel.name
    lang = rel.parts[0]

    original = path.read_text(encoding="utf-8")
    updated = fix_known_text_artifacts(original, lang)
    updated = normalize_repair_input(updated)
    updated = ftfy.fix_text(updated)
    updated = repair_mojibake_tokens(updated)

    updated = normalize_versions(updated, asset_prefix)
    updated = add_page_modules_link(updated, asset_prefix)
    updated = add_site_shell_script(updated, asset_prefix)
    updated = add_page_modules_script(updated, asset_prefix)
    updated = normalize_versions(updated, asset_prefix)
    updated = normalize_shared_script_order(updated, asset_prefix)
    updated = strip_inline_assets(updated, page_name)
    updated = inject_hidden_fields(updated, page_name, lang)
    updated = fix_known_copy_issues(updated, rel)
    updated = replace_inline_style_attributes(updated)
    updated = replace_gallery_and_layout_patterns(updated)
    updated = clean_decorative_emoji(updated)
    updated = replace_euro_symbols(updated)
    updated = normalize_euro_markup(updated)
    updated = normalize_euro_spacing(updated)
    updated = restore_nbsp_entities(updated)
    updated = replace_job_heading_icons(updated)
    updated = normalize_language_flags(updated, lang)

    if updated == original:
        return False

    path.write_text(updated, encoding="utf-8")
    return True


def main() -> None:
    changed = 0

    for path in sorted(ROOT.rglob("*.html")):
        rel = path.relative_to(ROOT)
        if not rel.parts or rel.parts[0] not in LANGS:
            continue

        if normalize_page(path):
            changed += 1

    print(f"Updated {changed} HTML files.")


if __name__ == "__main__":
    main()
