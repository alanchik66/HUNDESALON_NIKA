"""
fix_html_stubs.py
-----------------
Removes the old stub/template block from the beginning of HTML pages.

Every page file currently has TWO HTML structures:
  1. A short stub (legacy template, 15-70 lines) starting with
     <!DOCTYPE html><html lang="XX">...
     It either ends with </body></html> or lacks that closing.
  2. The REAL content that follows, starting with a comment or <head>.

This script keeps only the REAL content and prepends the proper
<!DOCTYPE html> + <html lang="XX"> to it.
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LANGS = {"ru", "uk", "en", "de"}

# Regex to extract the lang attribute from the first <html> tag
LANG_RE = re.compile(r'<html\s+lang="([^"]+)"', re.IGNORECASE)


def fix_file(path: Path) -> bool:
    """
    Returns True if the file was modified, False otherwise.
    """
    text = path.read_text(encoding="utf-8")

    # Extract language from the first <html lang="...">
    m = LANG_RE.search(text)
    if not m:
        print(f"  SKIP (no <html lang>): {path.relative_to(ROOT)}")
        return False
    lang = m.group(1)

    # -------------------------------------------------------------------
    # Case A: stub ends with </html> mid-file
    # The real content follows the first </html>.
    # We check that there is a <body> tag AFTER the first </html>.
    # -------------------------------------------------------------------
    first_html_close = text.find("</html>")
    if first_html_close != -1:
        after_close = text[first_html_close + len("</html>"):]
        # If there's a <body or <head after the first </html>, it's Case A
        if re.search(r"<(head|body)\b", after_close, re.IGNORECASE):
            real_content = after_close.lstrip("\n\r")
            new_text = f"<!DOCTYPE html>\n<html lang=\"{lang}\">\n{real_content}"
            if new_text != text:
                path.write_text(new_text, encoding="utf-8")
                print(f"  FIXED (Case A): {path.relative_to(ROOT)}")
                return True
            else:
                print(f"  SKIP (already clean): {path.relative_to(ROOT)}")
                return False

    # -------------------------------------------------------------------
    # Case B: stub has no </html> — there are two <head> tags.
    # Take everything from the SECOND <head> to end-of-file.
    # -------------------------------------------------------------------
    head_matches = list(re.finditer(r"<head\b", text, re.IGNORECASE))
    if len(head_matches) >= 2:
        second_head_start = head_matches[1].start()
        real_content = text[second_head_start:]
        new_text = f"<!DOCTYPE html>\n<html lang=\"{lang}\">\n{real_content}"
        if new_text != text:
            path.write_text(new_text, encoding="utf-8")
            print(f"  FIXED (Case B): {path.relative_to(ROOT)}")
            return True
        else:
            print(f"  SKIP (already clean): {path.relative_to(ROOT)}")
            return False

    print(f"  SKIP (no dual structure): {path.relative_to(ROOT)}")
    return False


def main() -> None:
    """Iterate over all HTML files in each language directory and fix stubs."""
    fixed = 0
    skipped = 0
    for lang in LANGS:
        lang_dir = ROOT / lang
        for html_file in sorted(lang_dir.rglob("*.html")):
            result = fix_file(html_file)
            if result:
                fixed += 1
            else:
                skipped += 1

    print(f"\nDone. Fixed: {fixed}, Skipped: {skipped}")


if __name__ == "__main__":
    main()
