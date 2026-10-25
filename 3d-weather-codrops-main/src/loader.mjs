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
      n = () => ((t ||= import(e)), t);
    window.Weather3DWidget = {
      load: n,
      mountWeatherWidget: async (...e) => (await n()).mountWeatherWidget(...e),
      unmountWeatherWidget: async (...e) => (await n()).unmountWeatherWidget(...e),
    };
  })();
})();
