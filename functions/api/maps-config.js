const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
};

export function onRequestGet({ env }) {
  const apiKey = String(env.GOOGLE_MAPS_BROWSER_KEY || '').trim();

  return new Response(
    JSON.stringify({
      enabled: Boolean(apiKey),
      apiKey: apiKey || undefined,
    }),
    { headers: JSON_HEADERS }
  );
}
