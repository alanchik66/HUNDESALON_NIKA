(function () {
  const MAP_ELEMENTS = document.querySelectorAll('.map-native');
  if (!MAP_ELEMENTS.length) {
    return;
  }

  const LEAFLET_CSS_ID = 'leaflet-css';
  const LEAFLET_SCRIPT_ID = 'leaflet-script';
  const LEAFLET_CSS_URL = '/assets/vendor/leaflet/1.9.4/leaflet.css';
  const LEAFLET_SCRIPT_URL = '/assets/vendor/leaflet/1.9.4/leaflet.js';
  const SATELLITE_TILES =
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  const TRANSPORT_TILES =
    'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}';
  const LABEL_TILES =
    'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';

  function ensureLeafletCss() {
    if (document.getElementById(LEAFLET_CSS_ID)) {
      return;
    }

    const link = document.createElement('link');
    link.id = LEAFLET_CSS_ID;
    link.rel = 'stylesheet';
    link.href = LEAFLET_CSS_URL;
    document.head.appendChild(link);
  }

  function ensureLeafletScript() {
    return new Promise((resolve, reject) => {
      if (window.L && typeof window.L.map === 'function') {
        resolve();
        return;
      }

      const existing = document.getElementById(LEAFLET_SCRIPT_ID);
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }

      const script = document.createElement('script');
      script.id = LEAFLET_SCRIPT_ID;
      script.src = LEAFLET_SCRIPT_URL;
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function initMaps() {
    MAP_ELEMENTS.forEach(element => {
      if (element.dataset.mapReady === '1') {
        return;
      }

      const parent = element.parentElement;
      if (parent instanceof HTMLElement && parent.getBoundingClientRect().height < 80) {
        parent.style.height = '300px';
        parent.style.position = 'relative';
        parent.style.overflow = 'hidden';
      }
      if (element.getBoundingClientRect().height < 80) {
        element.style.height = '300px';
        element.style.width = '100%';
      }

      const lat = Number(element.dataset.lat);
      const lng = Number(element.dataset.lng);
      const zoom = Number(element.dataset.zoom) || 17;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return;
      }

      const map = window.L.map(element, {
        zoomControl: false,
        attributionControl: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        keyboard: true,
      }).setView([lat, lng], zoom);

      window.L.control.zoom({ position: 'bottomright' }).addTo(map);

      window.L.tileLayer(SATELLITE_TILES, {
        maxZoom: 19,
        attribution: 'Imagery &copy; Esri',
      }).addTo(map);

      window.L.tileLayer(TRANSPORT_TILES, {
        maxZoom: 19,
        opacity: 0.92,
      }).addTo(map);

      window.L.tileLayer(LABEL_TILES, {
        maxZoom: 19,
        opacity: 0.98,
      }).addTo(map);

      const pinIcon = window.L.divIcon({
        className: 'contact-map-pin',
        html: '<span></span>',
        iconSize: [30, 40],
        iconAnchor: [15, 39],
      });

      window.L.marker([lat, lng], { icon: pinIcon }).addTo(map);

      element.dataset.mapReady = '1';

      // Contacts section reveals with animation; recalc after paint for crisp tile placement.
      requestAnimationFrame(() => {
        map.invalidateSize();
      });
      setTimeout(() => map.invalidateSize(), 260);
    });
  }

  ensureLeafletCss();
  ensureLeafletScript()
    .then(initMaps)
    .catch(() => {
      // Keep the page functional if map library fails to load.
    });
})();
