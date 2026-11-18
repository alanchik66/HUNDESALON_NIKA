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
  const FRAME_CHANNEL = 'nika-contact-map';
  const FRAME_VERSION = 1;
  const FRAME_ORIGIN = location.origin;
  const IS_RENDER_FRAME = document.documentElement.hasAttribute('data-contact-map-frame');
  const scriptVersion = new URL(document.currentScript?.src || '/assets/js/contact-map.js', location.href).searchParams.get('v');
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
    let timer;
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]).finally(() => clearTimeout(timer));
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

  function reflectMapMode(element, mode) {
    element.dataset.mapMode = mode.toLowerCase();
    for (const button of element.closest('.map-viewport')?.querySelectorAll('.map-mode-button') || []) {
      const selected = button.dataset.mapMode === mode.toUpperCase();
      button.setAttribute('aria-pressed', String(selected));
      if (selected) window.HundesalonNavPill?.activate(button);
      else window.HundesalonNavPill?.deactivate(button);
    }
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
          reflectMapMode(element, element.dataset.mapMode || mode.id);
        } catch {
          // Retain the current selected mode when the isolated renderer cannot respond.
          element.dataset.mapControlError = '1';
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

  async function getGoogleMapsConfig() {
    const requestConfig = async () => {
      const controller = new window.AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG_TIMEOUT_MS);
      try {
        const response = await fetch(GOOGLE_MAPS_CONFIG_URL, {
          headers: { Accept: 'application/json' },
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) {
          const error = new Error(`Maps config returned ${response.status}`);
          error.retryable = response.status >= 500;
          throw error;
        }
        return await response.json();
      } finally {
        clearTimeout(timeoutId);
      }
    };
    let payload;
    try {
      payload = await requestConfig();
    } catch (error) {
      if (error.retryable === false) throw error;
      payload = await requestConfig();
    }
    let embedUrl = '';
    if (typeof payload.embedUrl === 'string') {
      try {
        const url = new URL(payload.embedUrl);
        if (url.origin === 'https://www.google.com' && url.pathname === '/maps/embed'
          && !url.username && !url.password && url.searchParams.has('pb') && !url.searchParams.has('key')) {
          embedUrl = url.href;
        }
      } catch {
        // Ignore malformed configuration instead of embedding an arbitrary URL.
      }
    }
    return {
      apiKey: payload.enabled && typeof payload.apiKey === 'string' ? payload.apiKey.trim() : '',
      embedUrl,
    };
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

  function createMapRenderLease(element, { onVisibility, onDispose, isolated = false } = {}) {
    const viewport = element.closest('.map-viewport') || element;
    const removers = [];
    const pointers = new Set();
    let renderer;
    let enabled = true;
    let active = true;
    let inViewport = false;
    let pageActive = true;
    let pageFocused = true;
    let navigating = false;
    let disposed = false;
    let resumeTimer = 0;
    let resumeFrame = 0;
    let clickTimer = 0;

    const listen = (target, type, handler, options) => {
      target.addEventListener(type, handler, options);
      removers.push(() => target.removeEventListener(type, handler, options));
    };
    const cancelResume = () => {
      clearTimeout(resumeTimer);
      cancelAnimationFrame(resumeFrame);
      resumeTimer = resumeFrame = 0;
    };
    const suspend = () => {
      cancelResume();
      if (!renderer) return;
      // Preserve connection and viewport size so the SDK never recreates its Wasm surface.
      renderer.style.visibility = 'hidden';
      renderer.style.opacity = '0';
      renderer.style.pointerEvents = 'none';
      renderer.inert = true;
      element.dataset.mapSuspended = '1';
      onVisibility?.(false);
    };
    const sync = () => {
      if (!renderer) return;
      if (disposed || !enabled || !active || !pageActive || !pageFocused || document.hidden || !inViewport || navigating || pointers.size
        || document.body.matches('.nav-open, .booking-modal-open, .price-modal-open, .social-reel-modal-open')) {
        suspend();
        return;
      }
      renderer.style.visibility = '';
      renderer.style.opacity = '';
      renderer.style.pointerEvents = '';
      renderer.inert = false;
      if (renderer.parentNode !== element) element.appendChild(renderer);
      element.dataset.mapSuspended = '0';
      onVisibility?.(true);
    };
    const scheduleResume = () => {
      cancelResume();
      if (disposed) return;
      // Resume after the complete native input action and its menu/scroll updates.
      resumeTimer = window.setTimeout(() => {
        resumeTimer = 0;
        resumeFrame = requestAnimationFrame(() => {
          resumeFrame = 0;
          sync();
        });
      }, 0);
    };
    const updateVisibility = () => {
      const rect = viewport.getBoundingClientRect();
      inViewport = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0
        && rect.top < window.innerHeight && rect.left < window.innerWidth;
      sync();
    };
    const isInsideMap = event => event.composedPath?.().includes(viewport) || viewport.contains(event.target);
    const outsideControl = event => {
      if (isInsideMap(event)) return null;
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      const control = target?.closest('a[href],button');
      if (control?.matches('a') && (control.hasAttribute('download') || (control.target && control.target !== '_self'))) return null;
      return control;
    };
    const beginInput = event => {
      if (!outsideControl(event)) return;
      pointers.add(event.pointerId ?? event.type);
      suspend();
    };
    const endInput = event => {
      if (event.pointerId != null) pointers.delete(event.pointerId);
      else if (!event.touches?.length) pointers.clear();
      scheduleResume();
    };
    const captureClick = event => {
      const control = outsideControl(event);
      if (!control) return;
      suspend();
      const link = control.matches('a') ? control : null;
      if (link && !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey
        && !event.shiftKey && !event.altKey && !link.hasAttribute('download')
        && (!link.target || link.target === '_self')) {
        try {
          const url = new URL(link.href, location.href);
          const current = new URL(location.href);
          navigating = /^https?:$/.test(url.protocol)
            && (url.origin !== current.origin || url.pathname !== current.pathname || url.search !== current.search);
        } catch {
          // Invalid links retain their normal browser behavior.
        }
      }
      clearTimeout(clickTimer);
      clickTimer = window.setTimeout(() => {
        clickTimer = 0;
        if (event.defaultPrevented) navigating = false;
        scheduleResume();
      }, 0);
    };
    const passiveCapture = { capture: true, passive: true };
    // Install before the SDK so its gesture work cannot precede header navigation.
    if (!isolated && 'PointerEvent' in window) {
      listen(window, 'pointerdown', beginInput, passiveCapture);
      listen(window, 'pointerup', endInput, passiveCapture);
      listen(window, 'pointercancel', endInput, passiveCapture);
    } else if (!isolated) {
      listen(window, 'touchstart', beginInput, passiveCapture);
      listen(window, 'touchend', endInput, passiveCapture);
      listen(window, 'touchcancel', endInput, passiveCapture);
      listen(window, 'mousedown', beginInput, passiveCapture);
      listen(window, 'mouseup', endInput, passiveCapture);
    }
    if (!isolated) listen(window, 'click', captureClick, passiveCapture);

    const menuObserver = new MutationObserver(sync);
    menuObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    let visibilityObserver;
    if ('IntersectionObserver' in window) {
      visibilityObserver = new IntersectionObserver(entries => {
        inViewport = entries.some(entry => entry.target === viewport && entry.isIntersecting && entry.intersectionRatio > 0);
        sync();
      });
      visibilityObserver.observe(viewport);
    } else {
      listen(window, 'scroll', updateVisibility, passiveCapture);
    }
    listen(window, 'resize', updateVisibility, { passive: true });
    listen(document, 'visibilitychange', () => {
      if (document.hidden) {
        pointers.clear();
        suspend();
      } else {
        // Visibility may resume without a separate focus event on mobile.
        pageFocused = true;
        updateVisibility();
      }
    });
    if (!isolated) listen(window, 'blur', () => {
      // Focusing this document's map frame is still interaction with this page.
      if (renderer instanceof window.HTMLIFrameElement && document.activeElement === renderer) return;
      pageFocused = false;
      pointers.clear();
      suspend();
    });
    if (!isolated) listen(window, 'focus', () => {
      pageFocused = true;
      updateVisibility();
    });

    const dispose = () => {
      if (disposed) return;
      suspend();
      clearTimeout(clickTimer);
      disposed = true;
      renderer?.remove();
      renderer = null;
      pointers.clear();
      visibilityObserver?.disconnect();
      menuObserver.disconnect();
      for (const remove of removers) remove();
      delete element.dataset.mapSuspended;
      onDispose?.();
    };
    listen(window, 'pagehide', event => {
      pageActive = false;
      clearTimeout(clickTimer);
      suspend();
      if (!event.persisted) dispose();
    });
    listen(window, 'pageshow', () => {
      pageActive = true;
      pageFocused = true;
      navigating = false;
      pointers.clear();
      updateVisibility();
    });
    updateVisibility();

    return {
      setRenderer(nextRenderer) {
        if (disposed) return;
        suspend();
        if (renderer !== nextRenderer) renderer?.remove();
        renderer = nextRenderer;
        if (!renderer) delete element.dataset.mapSuspended;
        else sync();
      },
      setEnabled(nextEnabled) {
        enabled = nextEnabled;
        sync();
      },
      setActive(nextActive) {
        active = nextActive;
        sync();
      },
      dispose,
    };
  }

  function addGoogleMapControls(element, execute) {
    const ui = MAP_UI_LABELS[getMapLanguage()] || MAP_UI_LABELS.de;
    const lat = Number(element.dataset.lat);
    const lng = Number(element.dataset.lng);
    const mapControls = document.createElement('div');
    mapControls.className = 'contact-map-controls';
    mapControls.setAttribute('role', 'group');
    mapControls.setAttribute('aria-label', element.dataset.mapModeControlLabel || 'Map controls');

    const addControlButton = (label, icon, command, modifier = '') => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `contact-map-control map-nav-control ${modifier}`.trim();
      button.dataset.navPill = 'map-control';
      button.setAttribute('aria-label', label);
      button.title = label;
      button.innerHTML = `<span class="contact-map-control-icon">${icon}</span>`;
      button.addEventListener('click', () => {
        void execute(command).catch(() => { element.dataset.mapControlError = '1'; });
      });
      mapControls.appendChild(button);
    };
    addControlButton(ui.north, MAP_CONTROL_ICONS.north, 'north', 'contact-map-control-compass');
    addControlButton(ui.recenter, MAP_CONTROL_ICONS.recenter, 'recenter');
    addControlButton(ui.zoomIn, MAP_CONTROL_ICONS.zoomIn, 'zoom-in');
    addControlButton(ui.zoomOut, MAP_CONTROL_ICONS.zoomOut, 'zoom-out');

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
    addMapModeControls(element, getModeLabels(element), mode => execute('mode', mode));
  }

  async function initGoogleMap(element, apiKey, renderLease) {
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
    renderLease.setRenderer(map);
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
      renderLease.setEnabled(false);
      roadMapElement.style.visibility = '';
      roadMapElement.style.opacity = '';
      roadMapElement.style.pointerEvents = '';
      roadMapElement.inert = false;
      if (roadMapElement.parentNode !== element) element.appendChild(roadMapElement);
      activeMode = 'ROADMAP';
      requestAnimationFrame(() => {
        window.google.maps.event.trigger(roadMap, 'resize');
        roadMap.setCenter({ lat, lng });
      });
    }

    const setMode = async mode => {
      if (mode === 'HYBRID') {
        if (roadMapElement) {
          roadMapElement.style.visibility = 'hidden';
          roadMapElement.style.opacity = '0';
          roadMapElement.style.pointerEvents = 'none';
          roadMapElement.inert = true;
        }
        renderLease.setEnabled(true);
        activeMode = 'HYBRID';
        element.dataset.mapMode = 'hybrid';
        return;
      }
      await showRoadMap();
      element.dataset.mapMode = mode.toLowerCase();
    };
    return {
      getMode: () => activeMode.toLowerCase(),
      async execute(command, mode) {
        if (command === 'mode') await setMode(mode);
        else if (command === 'north') {
          if (activeMode === 'HYBRID') flyTo({ heading: 0 });
          else roadMap?.setHeading?.(0);
        } else if (command === 'recenter') {
          if (activeMode === 'HYBRID') { Object.assign(camera, defaultCamera); flyTo({}); }
          else roadMap?.panTo?.({ lat, lng });
        } else if (command === 'zoom-in') {
          if (activeMode === 'HYBRID') flyTo({ range: Math.max(160, camera.range * 0.72) });
          else roadMap?.setZoom?.(Math.min(22, (roadMap.getZoom?.() || 17) + 1));
        } else if (command === 'zoom-out') {
          if (activeMode === 'HYBRID') flyTo({ range: Math.min(1800, camera.range / 0.72) });
          else roadMap?.setZoom?.(Math.max(3, (roadMap.getZoom?.() || 17) - 1));
        }
        return activeMode.toLowerCase();
      },
    };
  }

  async function initGoogleEmbed(element, url) {
    const frame = document.createElement('iframe');
    frame.className = 'map-embed-google';
    frame.title = element.getAttribute('aria-label') || 'HUNDESALON NIKA — Google Maps';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.allowFullscreen = true;
    const loaded = new Promise((resolve, reject) => {
      frame.addEventListener('load', resolve, { once: true });
      frame.addEventListener('error', () => reject(new Error('Google Maps embed failed to load')), { once: true });
    });
    frame.src = url;
    element.replaceChildren(frame);
    await withTimeout(loaded, GOOGLE_MAPS_TIMEOUT_MS, 'Google Maps embed timed out');
    element.dataset.mapReady = '1';
    element.dataset.mapProvider = 'google-embed';
    element.dataset.mapMode = 'roadmap';
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

  async function initializeRenderer(element, onLease) {
    let config = { apiKey: '', embedUrl: '' };
    try {
      config = await getGoogleMapsConfig();
    } catch {
      // The public configuration endpoint may be temporarily unavailable.
    }

      if (config.embedUrl) {
        try {
          await initGoogleEmbed(element, config.embedUrl);
          return { provider: 'google-embed', mode: 'roadmap', api: null };
        } catch {
          // Fall through to the configured API or the localized unavailable state.
        }
      }
      if (config.apiKey) {
        const renderLease = createMapRenderLease(element, { isolated: true });
        onLease(renderLease);
        try {
          const api = await initGoogleMap(element, config.apiKey, renderLease);
          if (api) return { provider: 'google', mode: 'hybrid', api };
        } catch {
          // Continue to the localized Google Maps unavailable state below.
        }
        renderLease.dispose();
      }
      showMapUnavailable(element);
      return { provider: 'unavailable', mode: null, api: null };
  }

  const message = (type, payload = {}) => ({ channel: FRAME_CHANNEL, version: FRAME_VERSION, type, ...payload });
  const isMessage = data => data && typeof data === 'object' && data.channel === FRAME_CHANNEL && data.version === FRAME_VERSION;
  const isMode = mode => mode === 'hybrid' || mode === 'roadmap';

  function startRenderFrame() {
    if (window.parent === window) { showMapUnavailable(MAP_ELEMENTS[0]); return; }
    let initialized = false;
    let visible = false;
    let lease;
    let session;
    let commands = Promise.resolve();
    const send = (type, data) => window.parent.postMessage(message(type, data), FRAME_ORIGIN);
    const receive = event => {
      if (event.origin !== FRAME_ORIGIN || event.source !== window.parent || !isMessage(event.data)) return;
      const data = event.data;
      if (data.type === 'init' && !initialized) {
        const attributes = data.attributes;
        if (!['de', 'en', 'ru', 'uk'].includes(data.locale) || typeof data.visible !== 'boolean' || typeof data.light !== 'boolean'
          || !attributes || typeof attributes !== 'object'
          || !['lat', 'lng', 'zoom', 'modeControlLabel', 'hybridLabel', 'roadmapLabel', 'label'].every(key => typeof attributes[key] === 'string' && attributes[key].length <= 200)) return;
        const lat = Number(attributes.lat), lng = Number(attributes.lng), zoom = Number(attributes.zoom);
        if (!attributes.lat.trim() || !attributes.lng.trim() || !attributes.zoom.trim()
          || !Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lng) || Math.abs(lng) > 180 || !Number.isInteger(zoom) || zoom < 3 || zoom > 22) return;
        initialized = true;
        visible = data.visible;
        document.documentElement.lang = data.locale;
        document.title = attributes.label;
        document.body.classList.toggle('light', data.light);
        const element = MAP_ELEMENTS[0];
        Object.assign(element.dataset, { lat: attributes.lat, lng: attributes.lng, zoom: attributes.zoom,
          mapModeControlLabel: attributes.modeControlLabel, mapHybridLabel: attributes.hybridLabel, mapRoadmapLabel: attributes.roadmapLabel });
        element.setAttribute('aria-label', attributes.label);
        void initializeRenderer(element, nextLease => { lease = nextLease; lease.setActive(visible); }).then(result => {
          session = result;
          lease?.setActive(visible);
          send('ready', { provider: result.provider, mode: result.mode });
        }).catch(() => { showMapUnavailable(element); send('ready', { provider: 'unavailable', mode: null }); });
      } else if (data.type === 'visibility' && initialized && typeof data.visible === 'boolean' && typeof data.light === 'boolean') {
        visible = data.visible;
        document.body.classList.toggle('light', data.light);
        lease?.setActive(visible);
      } else if (data.type === 'command' && session?.api && Number.isSafeInteger(data.id) && data.id > 0
        && ['north', 'recenter', 'zoom-in', 'zoom-out', 'mode'].includes(data.command)
        && (data.command === 'mode' ? ['HYBRID', 'ROADMAP'].includes(data.mode) : data.mode === undefined)) {
        commands = commands.then(() => session.api.execute(data.command, data.mode)).then(mode => send('result', { id: data.id, ok: true, mode }))
          .catch(() => send('result', { id: data.id, ok: false, mode: session.api.getMode() }));
      }
    };
    window.addEventListener('message', receive);
    window.addEventListener('pagehide', event => { if (!event.persisted) window.removeEventListener('message', receive); });
  }

  async function initializeMapHost(element) {
    const frame = document.createElement('iframe');
    frame.className = 'contact-map-render-frame';
    frame.title = element.getAttribute('aria-label') || 'HUNDESALON NIKA — Google Maps';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    const url = new URL('/assets/frames/contact-map.html', location.href);
    if (scriptVersion) url.searchParams.set('v', scriptVersion);
    let ready = false;
    let disposed = false;
    let visible = false;
    let lastVisibility;
    let nextId = 0;
    const pending = new Map();
    const send = (type, payload) => { if (!disposed) frame.contentWindow?.postMessage(message(type, payload), FRAME_ORIGIN); };
    const currentTheme = () => document.body.classList.contains('light');
    const syncVisibility = nextVisible => {
      visible = nextVisible;
      const state = `${visible}:${currentTheme()}`;
      if (state === lastVisibility) return;
      lastVisibility = state;
      send('visibility', { visible, light: currentTheme() });
    };
    const attributes = { lat: element.dataset.lat || '', lng: element.dataset.lng || '', zoom: element.dataset.zoom || '17',
      modeControlLabel: element.dataset.mapModeControlLabel || 'Map controls', hybridLabel: element.dataset.mapHybridLabel || 'Hybrid',
      roadmapLabel: element.dataset.mapRoadmapLabel || 'Map', label: frame.title };
    const initialize = () => send('init', { locale: getMapLanguage(), attributes, visible, light: currentTheme() });
    let resolveReady;
    const readyPromise = new Promise(resolve => { resolveReady = resolve; });
    const receive = event => {
      if (event.origin !== FRAME_ORIGIN || event.source !== frame.contentWindow || !isMessage(event.data)) return;
      const data = event.data;
      if (data.type === 'ready' && !ready && ['google', 'google-embed', 'unavailable'].includes(data.provider)
        && (data.provider === 'unavailable' ? data.mode === null : isMode(data.mode))) {
        ready = true;
        element.dataset.mapReady = '1';
        element.dataset.mapProvider = data.provider;
        if (data.mode) element.dataset.mapMode = data.mode;
        resolveReady(data.provider);
      } else if (data.type === 'result' && Number.isSafeInteger(data.id) && typeof data.ok === 'boolean' && isMode(data.mode)) {
        // A throttled tab can deliver a valid reply after the local timeout.
        if (data.id > 0 && data.id <= nextId) reflectMapMode(element, data.mode);
        const request = pending.get(data.id);
        if (!request) return;
        pending.delete(data.id);
        clearTimeout(request.timer);
        if (data.ok) { element.dataset.mapMode = data.mode; delete element.dataset.mapControlError; request.resolve(); }
        else request.reject(new Error('Map control unavailable'));
      }
    };
    const lease = createMapRenderLease(element, { onVisibility: syncVisibility, onDispose: () => {
      disposed = true;
      resolveReady(null);
      window.removeEventListener('message', receive);
      frame.removeEventListener('load', initialize);
      for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error('Map closed')); }
      pending.clear();
    } });
    window.addEventListener('message', receive);
    frame.addEventListener('load', initialize);
    frame.src = url.href;
    element.replaceChildren(frame);
    lease.setRenderer(frame);
    try {
      const provider = await withTimeout(readyPromise, CONFIG_TIMEOUT_MS * 2 + GOOGLE_MAPS_TIMEOUT_MS * 2, 'Map frame timed out');
      if (disposed || provider !== 'google') return;
      addGoogleMapControls(element, (command, mode) => new Promise((resolve, reject) => {
        if (disposed || pending.size >= 16) { reject(new Error('Map control unavailable')); return; }
        const id = ++nextId;
        const timer = setTimeout(() => { pending.delete(id); reject(new Error('Map control timed out')); }, GOOGLE_MAPS_TIMEOUT_MS * 2);
        pending.set(id, { resolve, reject, timer });
        send('command', { id, command, ...(mode ? { mode } : {}) });
      }));
    } catch {
      if (disposed) return;
      lease.dispose();
      showMapUnavailable(element);
    }
  }

  async function initializeMapHosts() {
    await waitUntilNearViewport(MAP_ELEMENTS[0]);
    await Promise.all([...MAP_ELEMENTS].map(initializeMapHost));
  }
  if (IS_RENDER_FRAME) startRenderFrame();
  else void initializeMapHosts();
})();
