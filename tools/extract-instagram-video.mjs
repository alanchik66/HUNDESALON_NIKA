import { chromium } from 'playwright';

const [, , reelUrl] = process.argv;

if (!reelUrl) {
  console.error('Usage: node tools/extract-instagram-video.mjs <reelUrl>');
  process.exit(1);
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36';

function collectHtmlMatches(html) {
  const mp4Matches = [...html.matchAll(/https:[^"'\\]+\.mp4[^"'\\]*/g)].map((match) => match[0]);
  const keyedMatches = [
    ...html.matchAll(/(?:browser_native_hd_url|browser_native_sd_url|video_url)\\?":\\?"(https:[^"]+)/g)
  ].map((match) => match[1].replaceAll('\\u0026', '&').replaceAll('\\/', '/'));

  return [...new Set([...mp4Matches, ...keyedMatches])];
}

async function collectNetworkMatches(url) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: { width: 430, height: 900 }
  });
  const page = await context.newPage();
  const hits = new Set();
  const targetUrl = url.endsWith('/embed') ? url : `${url.replace(/\/$/, '')}/embed`;

  page.on('response', (response) => {
    const responseUrl = response.url();

    if (/\.(mp4|m3u8)(?:$|\?)/i.test(responseUrl) || /(video|dash|reel)/i.test(responseUrl)) {
      hits.add(responseUrl);
    }
  });

  try {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(2500);
    await page.mouse.click(215, 340);
    await page.waitForTimeout(9000);
    const domSources = await page.evaluate(() =>
      Array.from(document.querySelectorAll('video, source'))
        .flatMap((node) => [node.getAttribute('src'), node.getAttribute('poster'), node.getAttribute('data-src')])
        .filter(Boolean)
    );

    for (const domSource of domSources) {
      hits.add(domSource);
    }

    return [...hits];
  } finally {
    await context.close();
    await browser.close();
  }
}

const response = await fetch(reelUrl, {
  headers: {
    'user-agent': USER_AGENT,
    'accept-language': 'ru,de;q=0.9,en;q=0.8'
  }
});

const html = await response.text();
const urls = new Set(collectHtmlMatches(html));

for (const networkUrl of await collectNetworkMatches(reelUrl)) {
  if (/\.(mp4|m3u8)(?:$|\?)/i.test(networkUrl) || /(browser_native|video|dashinit|cdninstagram|fbcdn)/i.test(networkUrl)) {
    urls.add(networkUrl);
  }
}

process.stdout.write([...urls].join('\n'));
