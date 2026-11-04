/**
 * Reconstructed maintained JavaScript from the deployed authored module.
 * Original JSX/build sources were unavailable; this is not upstream source.
 * Shader, CSS, locale strings, request behavior, and public contracts are retained.
 * Existing dependency runtimes remain explicitly vendored build inputs.
 */
(function () {
  (function () {
    let e = (() => {
        if (typeof document < `u` && document.currentScript?.src) {
          let e = new URL(document.currentScript.src),
            t = new URL(`./header-preview.mjs`, e);
          return ((t.search = e.search), t.href);
        }
        return new URL(`./header-preview.mjs`, window.location.href).href;
      })(),
      t,
      retry = 0,
      n = () => {
        if (t) return t;
        t = (async () => {
          for (let attempt = 0; attempt < 3; attempt += 1) {
            const target = new URL(e);
            if (retry) target.searchParams.set('weather-retry', String(retry));
            try {
              return await import(target.href);
            } catch (error) {
              retry += 1;
              if (attempt === 2) throw error;
              await new Promise(resolve => window.setTimeout(resolve, 300 * 2 ** attempt));
            }
          }
        })().catch(error => { t = null; throw error; });
        return t;
      };
    window.Weather3DWidget = {
      load: n,
      mountWeatherWidget: async (...e) => (await n()).mountWeatherWidget(...e),
      unmountWeatherWidget: async (...e) => (await n()).unmountWeatherWidget(...e),
    };
  })();
})();
