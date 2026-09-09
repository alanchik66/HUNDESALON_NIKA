const endpoint = process.argv[2] ?? 'https://hundesalon-nika.com/api/ai-chat-gifs?q=happy&locale=ru';
const response = await fetch(endpoint, {
  headers: { Origin: 'https://hundesalon-nika.com' },
});
const body = await response.json().catch(() => ({}));

if (!response.ok || body.success !== true || !Array.isArray(body.items) || body.items.length === 0) {
  throw new Error(`Live GIF endpoint failed (HTTP ${response.status}).`);
}

if (!body.items.every((item) => typeof item?.url === 'string' && item.url.startsWith('https://'))) {
  throw new Error('Live GIF endpoint returned an invalid GIF item.');
}

console.log(`Live GIF endpoint verified: ${body.items.length} GIFs returned.`);
