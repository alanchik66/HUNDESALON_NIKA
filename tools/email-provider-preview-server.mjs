import http from 'node:http';
import { onRequestPost } from '../dist/functions/info-auto-reply.js';
const messages = {};
const realFetch = globalThis.fetch;
let captured;
console.log('FIXTURE ONLY: rendering HTML with a stubbed SMTP transport; this server sends no emails.');
globalThis.fetch = async (url, options) => {
  if (String(url) !== 'https://api.sendpulse.com/smtp/emails') throw new Error('Unexpected fixture request');
  captured = JSON.parse(options.body);
  return new Response(JSON.stringify({ result: true }), { headers: { 'content-type': 'application/json' } });
};
try {
  for (const lang of ['de', 'en', 'ru', 'uk']) {
    const response = await onRequestPost({
      env: { INFO_AUTOREPLY_SECRET: 'local-fixture', SENDPULSE_API_KEY: 'local-fixture' },
      request: new Request('https://hundesalon-nika.com/info-auto-reply', {
        method: 'POST',
        headers: { authorization: 'Bearer local-fixture', 'content-type': 'application/json' },
        body: JSON.stringify({ lang, to: 'snaiper1984@gmail.com' }),
      }),
    });
    if (!response.ok) throw new Error(`Fixture failed: ${lang}`);
    messages[lang] = Buffer.from(captured.email.html, 'base64').toString('utf8');
  }
} finally {
  globalThis.fetch = realFetch;
}
http
  .createServer((req, res) => {
    const lang = req.url.slice(1);
    if (!messages[lang]) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(
      `<title>Email source ${lang}</title><textarea aria-label="Email HTML source" style="width:95vw;height:90vh">${messages[lang].replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</textarea>`
    );
  })
  .listen(4188, '127.0.0.1', () => console.log('Email source preview on loopback port 4188'));
