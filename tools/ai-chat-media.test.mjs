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
  assert.match(source, /\/api\/ai-chat-upload-chunk/);
  assert.match(source, /X-Upload-Signature/);
  assert.match(source, /10 \* 1024 \* 1024/);
  assert.doesNotMatch(source, /xhr\.open\('PUT', uploadUrl\)/);
  assert.match(source, /150 \* 1024 \* 1024/);
  assert.match(source, /crypto\.subtle\.digest\('SHA-256'/);
  assert.match(source, /contentSha256/);
  assert.match(source, /session\.deduplicated === true/);
  assert.match(source, /copy\.uploadDuplicate/);
  assert.match(source, /if \(!open && state\.recorder\) stopVoiceRecording\(true\)/);
  assert.doesNotMatch(source, /SpeechRecognition/);
});

test('AI chat synchronizes persisted messages to the private server transcript', async () => {
  const source = await readFile(path.join(root, 'assets/js/ai-chat.js'), 'utf8');
  assert.match(source, /action: 'transcript'/);
  assert.match(source, /messages: transcriptMessages/);
  assert.match(source, /state\.transcriptSyncPromise = state\.transcriptSyncPromise/);
  assert.match(source, /queueTranscriptSync\(state\.sessionId, state\.messages\.slice\(\), state\.transcriptRevision\)/);
  assert.match(source, /state\.transcriptRevision \+= 1/);
  assert.match(source, /revision,/);
  assert.match(source, /for \(let attempt = 0; attempt <= retries; attempt \+= 1\)/);
  assert.match(source, /window\.addEventListener\('pagehide'/);
  assert.match(source, /keepalive:\s*true,\s*retries:\s*0/);
  assert.match(source, /scheduleTranscriptSync\(\)/);
});

test('AI chat renews a registered server session for each new conversation', async () => {
  const source = await readFile(path.join(root, 'assets/js/ai-chat.js'), 'utf8');
  assert.match(source, /const REGISTRATION_KEY = 'hundesalonAiChatIdentity:v1'/);
  assert.match(source, /action: 'renew'/);
  assert.match(source, /sessionToken: state\.sessionToken/);
  assert.match(source, /applyRegisteredIdentity\(result\)/);
});

test('personal support stays in the branded chat and bypasses the AI model', async () => {
  const source = await readFile(path.join(root, 'assets/js/ai-chat.js'), 'utf8');
  const endpoint = await readFile(path.join(root, 'functions/api/ai-chat.js'), 'utf8');
  assert.match(source, /mode: state\.mode/);
  assert.equal((source.match(/mode: state\.mode/g) || []).length, 3);
  assert.match(source, /result\?\.waitingForStaff === true/);
  assert.match(source, /action: 'set-mode'/);
  assert.match(source, /mode: requestedMode/);
  assert.match(source, /result\?\.mode !== requestedMode/);
  assert.match(source, /modeRevision === state\.modeRevision/);
  assert.doesNotMatch(source, /clickNativeChat/);
  assert.match(endpoint, /payload\.mode === 'human'/);
  assert.match(endpoint, /waitingForStaff: true/);
  assert.match(endpoint, /category: effectiveMode === 'human' \? 'personal' : 'messages'/);
  assert.match(endpoint, /session\.conversation_mode === 'human'/);
});

test('AI chat exposes persistent text sizing plus clear and close menu actions', async () => {
  const source = await readFile(path.join(root, 'assets/js/ai-chat.js'), 'utf8');
  const styles = await readFile(path.join(root, 'assets/css/ai-chat.css'), 'utf8');

  assert.match(source, /const TEXT_SIZE_KEY = 'hundesalonAiChatTextSize:v1'/);
  assert.match(source, /if \(storedLevel === null\) return DEFAULT_TEXT_SIZE_LEVEL/);
  assert.match(source, /localStorage\.setItem\(TEXT_SIZE_KEY, String\(normalized\)\)/);
  assert.match(source, /root\.style\.setProperty\('--hn-ai-font-adjust'/);
  assert.match(source, /decreaseFont\.addEventListener\('click'/);
  assert.match(source, /increaseFont\.addEventListener\('click'/);
  assert.match(source, /clearChat: 'Очистить чат'/);
  assert.match(source, /closeChat: 'Закрыть чат'/);
  assert.match(source, /reset\.addEventListener\('click', \(\) => void clearChat\(\)\)/);
  assert.match(source, /closeMenu\.addEventListener\('click', \(\) => setOpen\(false\)\)/);
  assert.match(source, /menuToggle\.setAttribute\('aria-controls', 'hn-ai-menu'\)/);
  assert.match(source, /menuActions\.forEach\(action => action\.setAttribute\('role', 'menuitem'\)\)/);
  assert.match(source, /panel\.classList\.toggle\('has-open-menu', open\)/);
  assert.match(source, /section\.toggleAttribute\('inert', open\)/);
  assert.match(source, /setMenuOpen\(willOpen, \{ focus: willOpen \}\)/);
  assert.match(styles, /--hn-ai-font-adjust: 0rem/);
  assert.match(styles, /font-size: calc\(0\.93rem \+ var\(--hn-ai-font-adjust\)\)/);
  assert.match(styles, /\.hn-ai-menu \{[\s\S]*?z-index: 30/);
  const mobileMenuStyles = styles.match(/@media \(max-width: 560px\)[\s\S]*?\.hn-ai-menu \{([\s\S]*?)\n  \}/)?.[1] || '';
  assert.match(mobileMenuStyles, /max-height: calc\(var\(--hn-ai-viewport-height\) - 5\.1rem\)/);
  assert.match(mobileMenuStyles, /rgba\(0, 30, 21, 0\.7\)/);
  assert.match(mobileMenuStyles, /-webkit-backdrop-filter: blur\(26px\)/);
  assert.doesNotMatch(mobileMenuStyles, /bottom:\s*0/);
  assert.match(
    styles,
    /\.hn-ai-panel\.has-open-menu[^{]*\{[\s\S]*?opacity:\s*0\.1;[\s\S]*?filter:\s*blur\(4px\)/,
  );
  assert.match(
    styles,
    /@supports \(-webkit-touch-callout: none\)[\s\S]*?--hn-ai-window-opacity: 0\.72[\s\S]*?-webkit-backdrop-filter: blur\(28px\)/
  );
});

test('AI chat keeps the composer above mobile virtual keyboards', async () => {
  const source = await readFile(path.join(root, 'assets/js/ai-chat.js'), 'utf8');
  const styles = await readFile(path.join(root, 'assets/css/ai-chat.css'), 'utf8');

  assert.match(source, /const viewport = window\.visualViewport/);
  assert.match(source, /--hn-ai-viewport-height/);
  assert.match(source, /--hn-ai-viewport-bottom/);
  assert.match(source, /visualViewport\?\.addEventListener\('resize', syncChatViewport/);
  assert.match(source, /root\.addEventListener\('focusin', syncChatViewport\)/);
  assert.match(styles, /height:\s*calc\(\s*var\(--hn-ai-viewport-height\)/);
  assert.match(styles, /bottom:\s*calc\(max\(1\.15rem, env\(safe-area-inset-bottom\)\) \+ var\(--hn-ai-viewport-bottom\)\)/);
  assert.match(styles, /top:\s*calc\(var\(--hn-ai-viewport-top\)/);
  assert.match(styles, /max-height:\s*min\(20rem, calc\(var\(--hn-ai-viewport-height\) - 8rem\)\)/);
  assert.match(styles, /font-size:\s*max\(1rem, calc\(0\.94rem \+ var\(--hn-ai-font-adjust\)\)\)/);
});

test('AI chat does not load a second SendPulse chats launcher', async () => {
  const integration = await readFile(path.join(root, 'assets/js/sendpulse-integrations.js'), 'utf8');
  const styles = await readFile(path.join(root, 'assets/css/ai-chat.css'), 'utf8');

  assert.doesNotMatch(integration, /static\.sppopups\.com/);
  assert.doesNotMatch(integration, /data-chats-widget-id/);
  assert.doesNotMatch(integration, /POPUP_WIDGET_ID/);
  assert.match(styles, /sp-popups\s*\{[\s\S]*?display:\s*none\s*!important/);
});

test('AI chat uses the HUNDESALON_NIKA logo for the welcome avatar', async () => {
  const source = await readFile(path.join(root, 'assets/js/ai-chat.js'), 'utf8');
  const styles = await readFile(path.join(root, 'assets/css/ai-chat.css'), 'utf8');

  assert.match(source, /const welcomeMark = document\.createElement\('img'\)/);
  assert.match(source, /welcomeMark\.src = BRAND_LOGO/);
  assert.match(source, /welcomeMark\.alt = ''/);
  assert.doesNotMatch(source, /welcomeMark\.textContent = 'AI'/);
  assert.match(styles, /\.hn-ai-welcome > img \{[\s\S]*?object-fit: contain/);
});

test('completed uploads become persistent chat messages with an explicit delivery state', async () => {
  const source = await readFile(path.join(root, 'assets/js/ai-chat.js'), 'utf8');
  assert.match(source, /await completeStoredFile\(session\.fileId, true\)/);
  assert.match(source, /if \(!result\.retryable \|\| attempt > 0\) break/);
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
