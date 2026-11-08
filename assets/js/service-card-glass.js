/* Optical edge and moving light for opted-in service tiles. */
(function () {
  'use strict';

  const solarCheckScript = document.currentScript?.src;
  if (solarCheckScript && window.location?.search) {
    try {
      if (new URLSearchParams(window.location.search).get('solar-check') === '1') {
        const sourceUrl = new URL(solarCheckScript, window.location.href);
        const moduleUrl = new URL('./weather-sun-check.js', sourceUrl);
        if (moduleUrl.origin === window.location.origin) {
          if (sourceUrl.searchParams.has('v')) moduleUrl.searchParams.set('v', sourceUrl.searchParams.get('v'));
          import(moduleUrl.href).then(module => module.mountWeatherSunCheck()).catch(() => {});
        }
      }
    } catch {
      // Optional diagnostics must never interrupt the service cards.
    }
  }

  function initServiceGlass() {
    const grid = document.querySelector('.services-grid[data-service-glass]');
    if (!grid || grid.dataset.serviceGlass === 'ready') return;
    grid.dataset.serviceGlass = 'ready';

    const cards = Array.from(grid.children).filter(card => card.classList.contains('service-card'));
    if (!cards.length) return;
    const scrollRoot = document.querySelector('.site-scroll-root') || window;
    const preferences = [
      '(prefers-reduced-motion: reduce)',
      '(prefers-reduced-transparency: reduce)',
      '(prefers-contrast: more)',
      '(forced-colors: active)',
    ].map(query => window.matchMedia(query));
    const states = cards.map(card => {
      const lens = document.createElement('span');
      lens.className = 'service-glass__lens';
      lens.setAttribute('aria-hidden', 'true');
      card.prepend(lens);
      return { card, lens, visible: true, x: 50, y: 24, angle: 135, pointer: null };
    });
    let frame = 0;
    let timer = 0;
    let previousTime = 0;
    let suspended = false;

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const enabled = () => !suspended && !document.hidden && !preferences.some(query => query.matches);
    const stop = () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      frame = 0;
      timer = 0;
      previousTime = 0;
    };
    const releaseTouch = event => {
      const pointerRelease = event?.type === 'pointerup' || event?.type === 'pointercancel';
      let changed = false;
      states.forEach(state => {
        if (pointerRelease && state.pointer?.pointerId !== event.pointerId) return;
        changed ||= state.pointer !== null;
        state.pointer = null;
        state.card.classList.remove('is-glass-touch');
      });
      if (changed) schedule();
    };

    function schedule() {
      window.clearTimeout(timer);
      timer = 0;
      if (!frame && enabled()) frame = window.requestAnimationFrame(render);
    }

    // Only the known, decorative CSS background is sampled. No page/text capture.
    function readSurface() {
      const surface = window.getComputedStyle(document.body, '::before');
      const width = parseFloat(surface.width) || window.innerWidth * 1.24;
      const height = parseFloat(surface.height) || window.innerHeight * 1.24;
      let matrix = { a: 1, d: 1, e: 0, f: 0 };
      if (surface.transform !== 'none' && window.DOMMatrixReadOnly) {
        matrix = new window.DOMMatrixReadOnly(surface.transform);
      }
      const boxWidth = width * matrix.a;
      const boxHeight = height * matrix.d;
      const size = surface.backgroundSize.split(',')[0].trim().split(/\s+/);
      const scaleX = size[0].endsWith('%') ? parseFloat(size[0]) / 100 : 1;
      const scaleY = (size[1] || size[0]).endsWith('%') ? parseFloat(size[1] || size[0]) / 100 : 1;
      const sceneWidth = boxWidth * scaleX;
      const sceneHeight = boxHeight * scaleY;
      const positionX = parseFloat(surface.backgroundPositionX) / 100 || 0;
      const positionY = parseFloat(surface.backgroundPositionY) / 100 || 0;
      return {
        image: surface.backgroundImage,
        width: sceneWidth,
        height: sceneHeight,
        left: (parseFloat(surface.left) || 0) + width * (1 - matrix.a) / 2 + matrix.e +
          (boxWidth - sceneWidth) * positionX,
        top: (parseFloat(surface.top) || 0) + height * (1 - matrix.d) / 2 + matrix.f +
          (boxHeight - sceneHeight) * positionY,
        animated: surface.animationName !== 'none' && surface.animationPlayState !== 'paused',
      };
    }

    function render(time) {
      frame = 0;
      if (!enabled()) return;
      const easing = 1 - Math.exp(-Math.min(64, previousTime ? time - previousTime : 16) / 100);
      previousTime = time;
      // Complete layout reads before writing the card styles.
      const measured = states.filter(state => state.visible)
        .map(state => ({ state, rect: state.card.getBoundingClientRect() }))
        .filter(({ rect }) => rect.bottom > 0 && rect.top < window.innerHeight && rect.width > 0);
      if (!measured.length) {
        previousTime = 0;
        return;
      }
      const surface = readSurface();
      let settling = false;
      measured.forEach(({ state, rect }) => {
        let targetX = clamp((window.innerWidth * 0.28 - rect.left) / rect.width * 100, 8, 92);
        let targetY = clamp(100 - (rect.top + rect.height / 2) / window.innerHeight * 100, 6, 94);
        if (state.pointer) {
          const touchX = clamp((state.pointer.clientX - rect.left) / rect.width * 100, 0, 100);
          const touchY = clamp((state.pointer.clientY - rect.top) / rect.height * 100, 0, 100);
          targetX = targetX * 0.35 + touchX * 0.65;
          targetY = targetY * 0.35 + touchY * 0.65;
        }
        const targetAngle = 120 + clamp((rect.top + rect.height / 2) / window.innerHeight, 0, 1) * 55;
        state.x += (targetX - state.x) * easing;
        state.y += (targetY - state.y) * easing;
        state.angle += (targetAngle - state.angle) * easing;
        if (Math.abs(targetX - state.x) <= 0.1) state.x = targetX;
        if (Math.abs(targetY - state.y) <= 0.1) state.y = targetY;
        if (Math.abs(targetAngle - state.angle) <= 0.1) state.angle = targetAngle;
        settling ||= Math.abs(targetY - state.y) > 0.1 || Math.abs(targetX - state.x) > 0.1 ||
          Math.abs(targetAngle - state.angle) > 0.1;
        const style = state.card.style;
        const write = (property, value) => {
          if (style.getPropertyValue(property) !== value) style.setProperty(property, value);
        };
        write('--glass-light-x', `${state.x.toFixed(2)}%`);
        write('--glass-light-y', `${state.y.toFixed(2)}%`);
        write('--glass-angle', `${state.angle.toFixed(2)}deg`);
        // Only the decorative background bends in the bevel; glyphs stay untouched.
        // A moving focal point changes the sample rather than sliding a painted glow.
        const magnification = 1.1 + state.y * 0.0007;
        const focusX = (rect.width - 2) * state.x / 100;
        const focusY = (rect.height - 2) * state.y / 100;
        write('--glass-scene-width', `${(surface.width * magnification).toFixed(2)}px`);
        write('--glass-scene-height', `${(surface.height * magnification).toFixed(2)}px`);
        write('--glass-scene-x', `${(magnification * (surface.left - rect.left - 1) +
          (1 - magnification) * focusX).toFixed(2)}px`);
        write('--glass-scene-y', `${(magnification * (surface.top - rect.top - 1) +
          (1 - magnification) * focusY).toFixed(2)}px`);
        if (state.image !== surface.image) {
          state.lens.style.backgroundImage = surface.image;
          state.image = surface.image;
        }
      });
      if (settling) schedule();
      else {
        previousTime = 0;
        if (surface.animated) timer = window.setTimeout(schedule, 250);
      }
    }

    if ('IntersectionObserver' in window) {
      const observer = new window.IntersectionObserver(entries => {
        entries.forEach(entry => {
          const state = states.find(item => item.card === entry.target);
          if (state) state.visible = entry.isIntersecting;
        });
        if (states.some(state => state.visible)) schedule();
        else stop();
      }, { root: scrollRoot === window ? null : scrollRoot, rootMargin: '80px' });
      states.forEach(({ card }) => observer.observe(card));
    }
    if ('ResizeObserver' in window) {
      const observer = new window.ResizeObserver(schedule);
      observer.observe(grid);
    }
    scrollRoot.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    window.visualViewport?.addEventListener('resize', schedule, { passive: true });
    states.forEach(state => {
      const { card } = state;
      const track = event => {
        if (event.pointerType === 'mouse' || !enabled()) return;
        if (state.pointer && state.pointer.pointerId !== event.pointerId) return;
        if (event.type === 'pointermove' && !state.pointer) return;
        state.pointer = { clientX: event.clientX, clientY: event.clientY, pointerId: event.pointerId };
        card.classList.add('is-glass-touch');
        schedule();
      };
      card.addEventListener('pointerdown', track, { passive: true });
      card.addEventListener('pointermove', track, { passive: true });
    });
    window.addEventListener('pointerup', releaseTouch, { passive: true });
    window.addEventListener('pointercancel', releaseTouch, { passive: true });
    window.addEventListener('blur', releaseTouch);
    document.addEventListener('visibilitychange', () => {
      stop();
      releaseTouch();
      schedule();
    });
    window.addEventListener('pagehide', () => {
      suspended = true;
      stop();
      releaseTouch();
    });
    window.addEventListener('pageshow', () => {
      suspended = false;
      schedule();
    });
    preferences.forEach(query => {
      const change = () => {
        stop();
        releaseTouch();
        schedule();
      };
      if (query.addEventListener) query.addEventListener('change', change);
      else query.addListener(change);
    });
    new window.MutationObserver(schedule).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    schedule();
  }

  // Deferred scripts run while interactive, before main.js creates the scroll root.
  if (document.readyState === 'complete') initServiceGlass();
  else {
    document.addEventListener('DOMContentLoaded', initServiceGlass, { once: true });
    window.addEventListener('load', initServiceGlass, { once: true });
  }
})();
