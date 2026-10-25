/* Local development only. Each tab updates only resources it actually uses. */
(function () {
  if (!['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) || window.__nikaDevRefresh) return;
  window.__nikaDevRefresh = true;
  const applied = new Map();
  const dirtyForms = new Set();
  let busy = false;
  let pendingReload = false;
  let dirtyEditable = false;
  const publicPath = value => {
    try {
      const url = new URL(value, location.href);
      return url.origin === location.origin ? decodeURIComponent(url.pathname) : null;
    } catch { return null; }
  };
  const resources = () => {
    const result = new Map();
    const add = value => {
      const pathname = publicPath(value);
      if (!pathname) return;
      if (!result.has(pathname)) result.set(pathname, new Set());
      result.get(pathname).add(new URL(value, location.href).href);
    };
    add(location.href);
    if (location.pathname.endsWith('/')) add(`${location.pathname}index.html`);
    performance.getEntriesByType('resource').forEach(entry => add(entry.name));
    document.querySelectorAll('script[src],link[href],img[src],source[src],video[src],audio[src]').forEach(node => add(node.src || node.href));
    return result;
  };
  const deferReload = () => document.hidden || dirtyEditable || [...dirtyForms].some(form => form.isConnected) ||
    document.activeElement?.matches('input,textarea,select,[contenteditable="true"]') ||
    [...document.querySelectorAll('video,audio')].some(media => !media.paused && !media.ended);
  document.addEventListener('input', event => {
    if (event.target.form) dirtyForms.add(event.target.form);
    else if (event.target.isContentEditable || event.target.matches('textarea,input:not([type="range"]):not([type="checkbox"]):not([type="radio"])')) dirtyEditable = true;
  }, true);
  document.addEventListener('reset', event => dirtyForms.delete(event.target), true);
  const versioned = (value, revision) => {
    const url = new URL(value, location.href);
    url.searchParams.set('dev-refresh', revision);
    return url.href;
  };
  const refreshStyles = revision => Promise.all([...document.querySelectorAll('link[rel="stylesheet"]')]
    .filter(link => publicPath(link.href))
    .map(link => new Promise(resolve => {
      const replacement = link.cloneNode();
      replacement.href = versioned(link.href, revision);
      const timer = setTimeout(() => { replacement.remove(); resolve(false); }, 5000);
      replacement.onload = () => { clearTimeout(timer); link.remove(); resolve(true); };
      replacement.onerror = () => { clearTimeout(timer); replacement.remove(); resolve(false); };
      link.after(replacement);
    })));
  const check = async () => {
    if (busy || document.hidden) return;
    busy = true;
    try {
      const response = await fetch('http://127.0.0.1:5512/changes', {
        cache: 'no-store', signal: window.AbortSignal.timeout(5000),
      });
      if (!response.ok) return;
      const manifest = await response.json();
      if (manifest.project !== 'HUNDESALON_NIKA' || !Array.isArray(manifest.changes)) return;
      const used = resources();
      for (const change of manifest.changes) {
        if (!used.has(change.path) || change.at <= performance.timeOrigin || applied.get(change.path) === change.revision) continue;
        if (change.revision === 'deleted') { pendingReload = true; applied.set(change.path, change.revision); continue; }
        // Refresh the original URLs too, including URLs in CSS and module imports.
        const responses = await Promise.all([...used.get(change.path)].map(url => fetch(url, {
          cache: 'reload', signal: window.AbortSignal.timeout(5000),
        })));
        if (responses.some(result => !result.ok)) continue;
        await Promise.all(responses.map(result => result.arrayBuffer()));
        if (/\.(?:css|woff2?|ttf|otf)$/i.test(change.path)) {
          if ((await refreshStyles(change.revision)).some(ok => !ok)) continue;
        } else if (/\.(?:png|jpe?g|webp|gif|svg|ico|avif)$/i.test(change.path)) {
          document.querySelectorAll('img').forEach(img => {
            if (publicPath(img.src) === change.path) img.src = versioned(img.src, change.revision);
          });
          document.querySelectorAll('[srcset]').forEach(node => {
            const next = node.getAttribute('srcset').replace(/(^|,\s*)([^\s,]+)([^,]*)/g, (match, separator, url, descriptor) =>
              publicPath(url) === change.path ? `${separator}${versioned(url, change.revision)}${descriptor}` : match);
            if (next !== node.getAttribute('srcset')) node.setAttribute('srcset', next);
          });
          document.querySelectorAll('video[poster],link[rel~="icon"]').forEach(node => {
            const attr = node.tagName === 'VIDEO' ? 'poster' : 'href';
            if (publicPath(node.getAttribute(attr)) === change.path) node.setAttribute(attr, versioned(node.getAttribute(attr), change.revision));
          });
          document.querySelectorAll('[style]').forEach(node => {
            const next = node.getAttribute('style').replace(/url\((['"]?)(.*?)\1\)/g, (match, quote, url) =>
              publicPath(url) === change.path ? `url("${versioned(url, change.revision)}")` : match);
            if (next !== node.getAttribute('style')) node.setAttribute('style', next);
          });
          if ((await refreshStyles(change.revision)).some(ok => !ok)) continue;
        } else {
          pendingReload = true;
        }
        applied.set(change.path, change.revision);
      }
      if (pendingReload && !deferReload()) location.reload();
    } catch {
      // Watcher/server may restart. Keep the page and retry without clearing user data.
    } finally {
      busy = false;
    }
  };
  setInterval(() => void check(), 1500);
  document.addEventListener('visibilitychange', () => void check());
  void check();
})();
