import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('ships the complete fully-qualified Unicode Emoji 17.0 set', async () => {
  const data = JSON.parse(await readFile(path.join(root, 'assets/data/emoji-17.0.json'), 'utf8'));
  const emoji = data.groups.flatMap(group => group.emoji.map(item => item.value));
  assert.equal(data.version, '17.0');
  assert.equal(data.count, 3944);
  assert.equal(new Set(emoji).size, emoji.length);
  assert.equal(data.groups.length, 10);
});

test('AI chat uses MediaRecorder and direct resumable upload UI', async () => {
  const source = await readFile(path.join(root, 'assets/js/ai-chat.js'), 'utf8');
  assert.match(source, /new window\.MediaRecorder/);
  assert.match(source, /Content-Range/);
  assert.match(source, /UPLOAD_ENDPOINT\}\?action=chunk/);
  assert.doesNotMatch(source, /xhr\.open\('PUT', uploadUrl\)/);
  assert.match(source, /150 \* 1024 \* 1024/);
  assert.match(source, /if \(!open && state\.recorder\) stopVoiceRecording\(true\)/);
  assert.doesNotMatch(source, /SpeechRecognition/);
});

test('completed uploads become persistent chat messages with an explicit delivery state', async () => {
  const source = await readFile(path.join(root, 'assets/js/ai-chat.js'), 'utf8');
  assert.match(source, /const delivered = completion\.notified === true/);
  assert.match(source, /addMessage\('user', file\.name, \{/);
  assert.match(source, /safeAttachment\.delivered \? copy\.uploadComplete : copy\.uploadStored/);
  assert.match(source, /attachment: item\.attachment/);
});

test('AI chat includes a localized and attributed GIF picker', async () => {
  const source = await readFile(path.join(root, 'assets/js/ai-chat.js'), 'utf8');
  const endpoint = await readFile(path.join(root, 'functions/api/ai-chat-gifs.js'), 'utf8');
  assert.match(source, /const GIF_ENDPOINT = '\/api\/ai-chat-gifs'/);
  assert.match(source, /Powered by GIPHY/);
  assert.match(endpoint, /rating: 'g'/);
  for (const label of ['GIF auswählen', 'Choose a GIF', 'Выбрать GIF', 'Вибрати GIF']) {
    assert.match(source, new RegExp(label));
  }
});

test('AI chat ships the licensed Noto Color Emoji webfont as its primary emoji renderer', async () => {
  const chatCss = await readFile(path.join(root, 'assets/css/ai-chat.css'), 'utf8');
  const fontCss = await readFile(path.join(root, 'assets/css/noto-color-emoji.css'), 'utf8');
  assert.match(chatCss, /font-family: 'Noto Color Emoji', 'Segoe UI Emoji', sans-serif/);
  assert.doesNotMatch(chatCss, /Apple Color Emoji/);
  assert.equal((fontCss.match(/@font-face/g) || []).length, 10);
  assert.doesNotMatch(fontCss, /\.woff\)/);
  for (let subset = 0; subset < 10; subset += 1) {
    await access(
      path.join(root, 'assets/fonts/noto-color-emoji', `noto-color-emoji-${subset}-400-normal.woff2`)
    );
  }
  await access(path.join(root, 'assets/fonts/noto-color-emoji/LICENSE.txt'));
});
