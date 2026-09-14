(function () {
  const MAP_ELEMENTS = document.querySelectorAll('.map-native');
  if (!MAP_ELEMENTS.length) {
    return;
  }

  const GOOGLE_MAPS_CONFIG_URL = '/api/maps-config';
  const GOOGLE_MAPS_SCRIPT_ID = 'google-maps-3d-script';
  const SALON_MARKER_ICON_URL = '/assets/images/icons/locate.png';
  const CONFIG_TIMEOUT_MS = 5000;
  const GOOGLE_MAPS_TIMEOUT_MS = 15000;
  let googleMapsPromise;

  const MAP_UI_LABELS = {
    de: {
      north: 'Nach Norden ausrichten',
      recenter: 'Salon auf der Karte zentrieren',
      zoomIn: 'Vergrößern',
      zoomOut: 'Verkleinern',
      streetView: 'Street View öffnen',
      unavailable: 'Google Maps ist vorübergehend nicht verfügbar.',
    },
    en: {
      north: 'Face north',
      recenter: 'Center the salon on the map',
      zoomIn: 'Zoom in',
      zoomOut: 'Zoom out',
      streetView: 'Open Street View',
      unavailable: 'Google Maps is temporarily unavailable.',
    },
    ru: {
      north: 'Ориентировать карту на север',
      recenter: 'Показать салон в центре карты',
      zoomIn: 'Приблизить',
      zoomOut: 'Отдалить',
      streetView: 'Открыть просмотр улиц',
      unavailable: 'Google Карты временно недоступны.',
    },
    uk: {
      north: 'Орієнтувати карту на північ',
      recenter: 'Показати салон у центрі карти',
      zoomIn: 'Наблизити',
      zoomOut: 'Віддалити',
      streetView: 'Відкрити перегляд вулиць',
      unavailable: 'Google Карти тимчасово недоступні.',
    },
  };

  const MAP_CONTROL_ICONS = {
    north:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="map-control-north" d="M12 2 17 12 12 10 7 12Z"/><path class="map-control-south" d="M12 22 7 12 12 14 17 12Z"/></svg>',
    recenter:
      '<img class="contact-map-control-image contact-map-control-image-recenter" src="/assets/images/icons/map-recenter.png" alt="" aria-hidden="true" width="24" height="24" decoding="async">',
    zoomIn: '<span class="contact-map-control-symbol" aria-hidden="true">+</span>',
    zoomOut: '<span class="contact-map-control-symbol" aria-hidden="true">−</span>',
    streetView:
      '<img class="contact-map-control-image" src="/assets/images/icons/street-view.png" alt="" aria-hidden="true" width="24" height="24" decoding="async">',
  };

  function getMapLanguage() {
    const language = document.documentElement.lang.toLowerCase().split('-')[0];
    return ['de', 'en', 'ru', 'uk'].includes(language) ? language : 'de';
  }

  function withTimeout(promise, timeoutMs, message) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  }

  function waitUntilNearViewport(element) {
    if (!('IntersectionObserver' in window)) return Promise.resolve();

    return new Promise(resolve => {
      const observer = new IntersectionObserver(
        entries => {
          if (!entries.some(entry => entry.isIntersecting)) return;
          observer.disconnect();
          resolve();
        },
        { rootMargin: '400px 0px' }
      );
      observer.observe(element);
    });
  }

  function getModeLabels(element) {
    const hybrid = element.dataset.mapHybridLabel || 'Hybrid';
    return [
      {
        id: 'HYBRID',
        label: `${hybrid} 3D`,
      },
      {
        id: 'ROADMAP',
        label: element.dataset.mapRoadmapLabel || 'Map',
      },
    ];
  }

  function addMapModeControls(element, modes, setMode) {
    const viewport = element.closest('.map-viewport');
    if (!viewport || viewport.querySelector('.map-mode-controls')) return;

    const controls = document.createElement('div');
    controls.className = 'map-mode-controls';
    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-label', element.dataset.mapModeControlLabel || 'Map mode');

    for (const mode of modes) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'map-mode-button map-nav-control';
      button.dataset.navPill = 'map-mode';
      const label = document.createElement('span');
      label.className = 'map-mode-label';
      label.textContent = mode.label;
      button.appendChild(label);
      button.dataset.mapMode = mode.id;
      button.setAttribute('aria-pressed', String(mode.id === 'HYBRID'));
      button.addEventListener('click', async () => {
        if (button.getAttribute('aria-pressed') === 'true') return;
        const buttons = [...controls.querySelectorAll('.map-mode-button')];
        controls.setAttribute('aria-busy', 'true');
        for (const sibling of buttons) sibling.disabled = true;
        try {
          await setMode(mode.id);
          for (const sibling of buttons) {
            sibling.setAttribute('aria-pressed', String(sibling === button));
            window.HundesalonNavPill?.deactivate(sibling);
          }
          window.HundesalonNavPill?.activate(button);
          element.dataset.mapMode = mode.id.toLowerCase();
        } finally {
          controls.removeAttribute('aria-busy');
          for (const sibling of buttons) sibling.disabled = false;
        }
      });
      controls.appendChild(button);
    }

    viewport.appendChild(controls);
    window.HundesalonNavPill?.scan(controls);
  }

  async function getGoogleMapsKey() {
    const controller = new window.AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG_TIMEOUT_MS);
    const response = await fetch(GOOGLE_MAPS_CONFIG_URL, {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));
    if (!response.ok) throw new Error(`Maps config returned ${response.status}`);
    const payload = await response.json();
    return payload.enabled && typeof payload.apiKey === 'string' ? payload.apiKey.trim() : '';
  }

  function loadGoogleMaps(apiKey) {
    if (window.google?.maps?.importLibrary) return Promise.resolve();
    if (googleMapsPromise) return googleMapsPromise;

    googleMapsPromise = new Promise((resolve, reject) => {
      const existing = document.getElementById(GOOGLE_MAPS_SCRIPT_ID);
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }

      const callbackName = '__hundesalonNikaMapsReady';
      window[callbackName] = () => {
        delete window[callbackName];
        resolve();
      };

      const script = document.createElement('script');
      script.id = GOOGLE_MAPS_SCRIPT_ID;
      script.async = true;
      script.src =
        `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}` +
        `&v=beta&loading=async&language=${encodeURIComponent(getMapLanguage())}` +
        `&region=DE&callback=${callbackName}`;
      script.onerror = () => {
        delete window[callbackName];
        reject(new Error('Google Maps failed to load'));
      };
      document.head.appendChild(script);
    }).catch(error => {
      googleMapsPromise = undefined;
      throw error;
    });

    return googleMapsPromise;
  }

  async function initGoogleMap(element, apiKey) {
    const lat = Number(element.dataset.lat);
    const lng = Number(element.dataset.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;

    await withTimeout(loadGoogleMaps(apiKey), GOOGLE_MAPS_TIMEOUT_MS, 'Google Maps timed out');
    const { Map3DElement, MarkerElement } = await withTimeout(
      window.google.maps.importLibrary('maps3d'),
      GOOGLE_MAPS_TIMEOUT_MS,
      'Google Maps 3D timed out'
    );
    const label = element.getAttribute('aria-label') || 'HUNDESALON NIKA';
    const ui = MAP_UI_LABELS[getMapLanguage()] || MAP_UI_LABELS.de;
    const salonCenter = { lat, lng, altitude: 113 };
    const defaultCamera = { center: salonCenter, range: 520, tilt: 67.5, heading: 332 };
    const camera = { ...defaultCamera };
    const map = new Map3DElement({
      ...defaultCamera,
      mode: 'HYBRID',
      gestureHandling: 'COOPERATIVE',
      defaultUIHidden: true,
    });
    map.className = 'contact-map-3d';
    map.setAttribute('aria-label', label);

    const marker = new MarkerElement({
      position: { lat, lng, altitude: 2 },
      altitudeMode: 'RELATIVE_TO_MESH',
      collisionBehavior: 'REQUIRED',
      title: 'HUNDESALON NIKA',
    });
    marker.style.zIndex = '1000';
    const markerVisual = document.createElement('div');
    markerVisual.className = 'contact-map-google-pin';
    markerVisual.innerHTML =
      '<span class="contact-map-google-pin-label">HUNDESALON NIKA</span>' +
      `<img class="contact-map-google-pin-image" src="${SALON_MARKER_ICON_URL}" alt="" width="64" height="64">`;
    marker.append(markerVisual);
    map.append(marker);
    element.replaceChildren(map);
    element.dataset.mapReady = '1';
    element.dataset.mapProvider = 'google';
    element.dataset.mapMode = 'hybrid';

    const flyTo = overrides => {
      Object.assign(camera, overrides);
      map.flyCameraTo({ endCamera: { ...camera }, durationMillis: 650 });
    };
    let activeMode = 'HYBRID';
    let roadMap;
    let roadMapElement;

    const mapControls = document.createElement('div');
    mapControls.className = 'contact-map-controls';
    mapControls.setAttribute('role', 'group');
    mapControls.setAttribute('aria-label', element.dataset.mapModeControlLabel || 'Map controls');

    const addControlButton = (labelText, iconMarkup, handler, modifier = '') => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `contact-map-control map-nav-control ${modifier}`.trim();
      button.dataset.navPill = 'map-control';
      button.setAttribute('aria-label', labelText);
      button.title = labelText;
      button.innerHTML = `<span class="contact-map-control-icon">${iconMarkup}</span>`;
      button.addEventListener('click', handler);
      mapControls.appendChild(button);
      return button;
    };

    addControlButton(
      ui.north,
      MAP_CONTROL_ICONS.north,
      () => {
        if (activeMode === 'HYBRID') flyTo({ heading: 0 });
        else roadMap?.setHeading?.(0);
      },
      'contact-map-control-compass'
    );
    addControlButton(ui.recenter, MAP_CONTROL_ICONS.recenter, () => {
      if (activeMode === 'HYBRID') {
        Object.assign(camera, defaultCamera);
        flyTo({});
      } else {
        roadMap?.panTo?.({ lat, lng });
      }
    });
    addControlButton(ui.zoomIn, MAP_CONTROL_ICONS.zoomIn, () => {
      if (activeMode === 'HYBRID') flyTo({ range: Math.max(160, camera.range * 0.72) });
      else roadMap?.setZoom?.(Math.min(22, (roadMap.getZoom?.() || 17) + 1));
    });
    addControlButton(ui.zoomOut, MAP_CONTROL_ICONS.zoomOut, () => {
      if (activeMode === 'HYBRID') flyTo({ range: Math.min(1800, camera.range / 0.72) });
      else roadMap?.setZoom?.(Math.max(3, (roadMap.getZoom?.() || 17) - 1));
    });

    const streetView = document.createElement('a');
    streetView.className = 'contact-map-control map-nav-control contact-map-control-streetview';
    streetView.dataset.navPill = 'map-control';
    streetView.href = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
    streetView.target = '_blank';
    streetView.rel = 'noopener noreferrer';
    streetView.setAttribute('aria-label', ui.streetView);
    streetView.title = ui.streetView;
    streetView.innerHTML = `<span class="contact-map-control-icon">${MAP_CONTROL_ICONS.streetView}</span>`;
    mapControls.appendChild(streetView);
    element.closest('.map-viewport')?.appendChild(mapControls);
    window.HundesalonNavPill?.scan(mapControls);

    async function showRoadMap() {
      if (!roadMap) {
        const { Map } = await withTimeout(
          window.google.maps.importLibrary('maps'),
          GOOGLE_MAPS_TIMEOUT_MS,
          'Google Maps road map timed out'
        );
        roadMapElement = document.createElement('div');
        roadMapElement.className = 'contact-map-2d';
        roadMap = new Map(roadMapElement, {
          center: { lat, lng },
          zoom: Number(element.dataset.zoom) || 17,
          mapTypeId: 'roadmap',
          mapTypeControl: false,
          cameraControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: false,
          scaleControl: true,
          rotateControl: false,
          controlSize: 32,
          gestureHandling: 'cooperative',
        });
        new window.google.maps.Marker({
          position: { lat, lng },
          map: roadMap,
          title: 'HUNDESALON NIKA',
          icon: {
            url: SALON_MARKER_ICON_URL,
            scaledSize: new window.google.maps.Size(64, 64),
            anchor: new window.google.maps.Point(32, 56),
          },
          zIndex: 1000,
        });
      }
      element.replaceChildren(roadMapElement);
      activeMode = 'ROADMAP';
      mapControls.hidden = false;
      requestAnimationFrame(() => {
        window.google.maps.event.trigger(roadMap, 'resize');
        roadMap.setCenter({ lat, lng });
      });
    }

    addMapModeControls(element, getModeLabels(element), async mode => {
      if (mode === 'HYBRID') {
        element.replaceChildren(map);
        activeMode = 'HYBRID';
        mapControls.hidden = false;
        Object.assign(camera, defaultCamera);
        map.flyCameraTo({ endCamera: { ...camera }, durationMillis: 650 });
        return;
      }
      await showRoadMap();
    });
    return true;
  }

  function showMapUnavailable(element) {
    const ui = MAP_UI_LABELS[getMapLanguage()] || MAP_UI_LABELS.de;
    const message = document.createElement('p');
    message.className = 'contact-map-unavailable';
    message.textContent = ui.unavailable;
    element.replaceChildren(message);
    element.dataset.mapReady = '1';
    element.dataset.mapProvider = 'unavailable';
  }

  async function initMaps() {
    await waitUntilNearViewport(MAP_ELEMENTS[0]);

    let apiKey = '';
    try {
      apiKey = await getGoogleMapsKey();
    } catch {
      // The public configuration endpoint may be temporarily unavailable.
    }

    for (const element of MAP_ELEMENTS) {
      if (apiKey) {
        try {
          if (await initGoogleMap(element, apiKey)) continue;
        } catch {
          // Continue to the localized Google Maps unavailable state below.
        }
      }
      showMapUnavailable(element);
    }
  }

  void initMaps();
})();
