// Check the protected Quick Tunnel itself before allowing any requests into Pages.
// A plain tunnel or an arbitrary redirect must never make the local proxy ready.
export async function verifyPrivateAdminEdge(origin, request = fetch) {
  if (!/^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.trycloudflare\.com$/.test(origin)) return false;
  const host = new URL(origin).hostname;
  const protectedPaths = ['/admin/', '/api/admin/settings', '/api/admin/media', '/api/admin/comparisons'];
  const results = await Promise.all(
    protectedPaths.map(async path => {
      const response = await request(origin + path, {
        method: 'GET',
        redirect: 'manual',
        credentials: 'omit',
        cache: 'no-store',
        signal: AbortSignal.timeout(5500),
      });
      try {
        const location = response.headers.get('location');
        if (response.status !== 302 || !location) return false;
        const url = new URL(location);
        const cookie = response.headers.get('set-cookie') || '';
        return (
          url.origin === 'https://login.trycloudflare.com' &&
          url.pathname === '/authorize' &&
          url.searchParams.get('hostname') === host &&
          /^[\w-]{43}$/.test(url.searchParams.get('state') || '') &&
          cookie.startsWith('__Secure-cloudflared-qt-auth-state-') &&
          /;\s*Secure(?:;|$)/i.test(cookie) &&
          /;\s*HttpOnly(?:;|$)/i.test(cookie)
        );
      } finally {
        await response.body?.cancel();
      }
    })
  );
  return results.every(Boolean);
}

// An anonymous response must challenge through this account's login page for
// this exact host. The Access policy and tunnel JWT enforcement are configured separately.
export async function verifyNamedPrivateAdminEdge({ origin, teamOrigin }, request = fetch) {
  if (
    origin !== 'https://admin-preview.hundesalon-nika.com' ||
    !/^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com$/.test(teamOrigin)
  )
    return false;

  const loginPath = '/cdn-cgi/access/login/' + new URL(origin).hostname;
  const protectedPaths = ['/', '/admin/', '/api/admin/settings', '/api/admin/pages', '/api/admin/media', '/api/admin/comparisons'];
  const results = await Promise.all(
    protectedPaths.map(async path => {
      const response = await request(origin + path, {
        method: 'GET',
        redirect: 'manual',
        credentials: 'omit',
        cache: 'no-store',
        signal: AbortSignal.timeout(5500),
      });
      try {
        const location = response.headers.get('location');
        if (response.status !== 302 || !location || !URL.canParse(location)) return false;
        const url = new URL(location);
        return (
          url.origin === teamOrigin &&
          url.pathname === loginPath &&
          !url.username &&
          !url.password &&
          !url.hash &&
          ![...url.searchParams.keys()].some(name =>
            /^(?:cf_authorization|cf-access-jwt-assertion|token|access_token|id_token)$/i.test(name)
          )
        );
      } finally {
        await response.body?.cancel();
      }
    })
  );
  return results.every(Boolean);
}
