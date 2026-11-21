import fs from 'node:fs';
import path from 'node:path';
import { TELEGRAM_MENU_COPY } from '../../assets/js/telegram-menu-copy.js';
import { escapeCopy } from '../../functions/_lib/page-copy.js';
import { replaceTelegramEditorTemplates, telegramFieldId } from '../../functions/_lib/page-editor-telegram.js';

function fieldKind(key) {
  if (key === 'title' || key === 'languageTitle') return 'heading';
  return key.endsWith('Title') ? 'label' : 'paragraph';
}

export function annotateTelegramEditorCopy(html) {
  const templates = Object.entries(TELEGRAM_MENU_COPY).map(([locale, copy]) => {
    const fields = Object.entries(copy).map(
      ([key, value]) =>
        '<span data-telegram-text="' +
        key +
        '"><!--nika-copy:' +
        fieldKind(key) +
        ':' +
        telegramFieldId(key) +
        '-->' +
        escapeCopy(value) +
        '<!--/nika-copy--></span>'
    );
    return '<template data-telegram-editor="' + locale + '">' + fields.join('') + '</template>';
  });
  const clean = replaceTelegramEditorTemplates(html, () => '');
  return clean.replace(/<\/body\s*>/i, close => templates.join('') + close);
}

export function buildTelegramEditorCopy(dist) {
  const file = path.join(dist, 'telegram-menu.html');
  fs.writeFileSync(file, annotateTelegramEditorCopy(fs.readFileSync(file, 'utf8')));
}
