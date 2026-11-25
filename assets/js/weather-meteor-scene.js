/* The same short meteor, shared by the quiet night sky and temporary loading scenes. */
const METEOR_STYLES = `
.weather-header-shooting-star {
  display: block;
  position: absolute;
  width: var(--shooting-star-length, 42px);
  height: 22px;
  z-index: 1;
  transform-origin: 90% 50%;
  background: radial-gradient(
    ellipse var(--shooting-star-head-long, 1.5px) var(--shooting-star-head-short, 0.9px) at 90% 50%,
    #fff 8%, rgba(var(--shooting-star-color, 232, 241, 255), 0.8) 43%, transparent 100%
  );
  opacity: 0;
  pointer-events: none !important;
}
.weather-header-shooting-star--foreground { z-index: 11 !important; }
.weather-header-shooting-star::before {
  content: '';
  position: absolute;
  left: 90%;
  top: 50%;
  width: var(--shooting-star-flare-size, 8px);
  height: var(--shooting-star-flare-size, 8px);
  border-radius: 50%;
  background: radial-gradient(circle, #fff 7%, rgba(var(--shooting-star-color, 232, 241, 255), 0.58) 24%, transparent 69%);
  pointer-events: none;
  animation: weatherShootingStarGlint var(--shooting-star-duration, 520ms) linear both;
}
.weather-header-shooting-star::after {
  content: '';
  position: absolute;
  left: 3%;
  right: 10%;
  top: calc(50% - var(--shooting-star-trail-width, 1.2px) / 2);
  height: var(--shooting-star-trail-width, 1.2px);
  background: linear-gradient(90deg, transparent, rgba(var(--shooting-star-color, 232, 241, 255), 0.17) 48%,
    rgba(var(--shooting-star-color, 232, 241, 255), 0.74) 100%);
  clip-path: polygon(0 50%, 76% 39%, 100% 10%, 100% 90%, 76% 61%);
  transform-origin: right center;
  pointer-events: none;
  animation: weatherShootingStarTrail var(--shooting-star-duration, 520ms) linear both;
}
@keyframes weatherShootingStarGlint {
  0%, 24% { opacity: 0; transform: translate(-50%, -50%) scale(0.45); }
  38% { opacity: var(--shooting-star-flash, 0.25); transform: translate(-50%, -50%) scale(1); }
  52% { opacity: 0; transform: translate(-50%, -50%) scale(0.7); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
}
@keyframes weatherShootingStarTrail {
  0% { opacity: 0; transform: scaleX(0.6) scaleY(0.6); }
  26% { opacity: 0.78; transform: scaleX(1) scaleY(1); }
  100% { opacity: 0; transform: scaleX(0.82) scaleY(0.5); }
}
`;

function installStyles(stage, ownerDocument) {
  const root = stage.getRootNode?.();
  const container = root?.nodeType === 9 ? ownerDocument.head : root;
  if (!container?.querySelector || container.querySelector('style[data-weather-meteor-style]')) return;
  const style = ownerDocument.createElement('style');
  style.setAttribute('data-weather-meteor-style', '');
  style.textContent = METEOR_STYLES;
  container.appendChild(style);
}

export function createMeteorScene({ getTargets, mode = 'ambient', random = (min, max) => min + (max - min) * Math.random() }) {
  const initialTargets = getTargets() || [];
  const ownerDocument = initialTargets[0]?.stage?.ownerDocument || document;
  const view = ownerDocument.defaultView || window;
  const loading = mode === 'loading';
  const active = new Set();
  let timer = null;
  let disposed = false;
  let unsupported = false;
  let firstPass = true;
  let generation = 0;

  const targets = () => disposed || unsupported || ownerDocument.hidden ? [] :
    (getTargets() || []).filter(target => target.stage?.isConnected !== false && target.stage);
  const capacity = target => loading ? Math.min(3, Math.max(1, target.maxActive || 2)) : 1;
  const candidates = list => loading
    ? list.filter(target => [...active].filter(entry => entry.stage === target.stage).length < capacity(target))
    : active.size ? [] : list;
  const cancel = entry => {
    active.delete(entry);
    entry.animation.cancel();
    entry.element.remove();
  };
  const stop = () => {
    generation += 1;
    if (timer !== null) view.clearTimeout(timer);
    timer = null;
    for (const entry of [...active]) cancel(entry);
  };
  const schedule = () => {
    if (timer !== null || !candidates(targets()).length) return;
    const delay = loading ? random(130, 340) : random(firstPass ? 4500 : 28000, firstPass ? 9500 : 68000);
    timer = view.setTimeout(spawn, delay);
  };
  const spawn = () => {
    timer = null;
    const available = candidates(targets());
    if (!available.length) return;
    firstPass = false;
    const target = available[Math.min(available.length - 1, Math.floor(random(0, available.length)))];
    const { stage } = target;
    const rect = target.rect || stage.getBoundingClientRect();
    const bounds = target.bounds || rect;
    const left = Math.max(rect.left, bounds.left);
    const top = Math.max(rect.top, bounds.top);
    const right = Math.min(rect.right, bounds.right);
    const bottom = Math.min(rect.bottom, bounds.bottom);
    const angle = random(0, 360);
    const radians = angle * Math.PI / 180;
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    const trailLimit = Math.min(84, (right - left) * 0.25,
      (bottom - top) * 0.28 / Math.max(Math.abs(sine), 0.001));
    const length = trailLimit * (0.54 + 0.46 * random(0, 1) ** 1.4);
    const corners = [Math.min(-0.9 * length, -11), Math.max(0.1 * length, 11)].flatMap(x =>
      [-11, 11].map(y => ({ x: x * cosine - y * sine, y: x * sine + y * cosine }))
    );
    const minX = left - Math.min(...corners.map(point => point.x)) + 6;
    const maxX = right - Math.max(...corners.map(point => point.x)) - 6;
    const minY = top - Math.min(...corners.map(point => point.y)) + 6;
    const maxY = bottom - Math.max(...corners.map(point => point.y)) - 6;
    const distance = Math.min(
      (maxX - minX) / Math.max(Math.abs(cosine), 0.001),
      (maxY - minY) / Math.max(Math.abs(sine), 0.001)
    ) * random(0.45, 0.9);
    if (length <= 0 || maxX <= minX || maxY <= minY || distance < 12 || !Number.isFinite(distance)) {
      schedule();
      return;
    }
    const dx = cosine * distance;
    const dy = sine * distance;
    const x = random(minX - Math.min(dx, 0), maxX - Math.max(dx, 0));
    const y = random(minY - Math.min(dy, 0), maxY - Math.max(dy, 0));
    installStyles(stage, ownerDocument);
    const element = ownerDocument.createElement('span');
    element.className = 'weather-header-shooting-star weather-header-shooting-star--foreground';
    element.setAttribute('aria-hidden', 'true');
    element.setAttribute('data-weather-meteor-depth', 'front');
    const screenSpeed = (right - left) * random(0.55, 1.55);
    const duration = Math.max(260, Math.min(780, 1000 * distance / screenSpeed));
    const brightnessRank = random(0, 1);
    const luminance = brightnessRank ** 2.6;
    const strength = 0.43 + 0.57 * luminance;
    const flash = brightnessRank >= 0.985 ? 0.83 : 0.05 + 0.34 * luminance;
    const color = random(0, 1) < 0.18 ? '255, 232, 194' : '232, 241, 255';
    element.style.setProperty('--shooting-star-color', color);
    element.style.setProperty('--shooting-star-head-long', `${(1.05 + 2.1 * luminance).toFixed(2)}px`);
    element.style.setProperty('--shooting-star-head-short', `${(0.55 + 1.25 * luminance).toFixed(2)}px`);
    element.style.setProperty('--shooting-star-trail-width', `${(0.75 + 2.25 * luminance).toFixed(2)}px`);
    element.style.setProperty('--shooting-star-flare-size', `${(4.6 + 10.6 * luminance).toFixed(2)}px`);
    element.style.setProperty('--shooting-star-flash', flash.toFixed(3));
    element.style.setProperty('--shooting-star-length', `${length.toFixed(2)}px`);
    element.style.setProperty('--shooting-star-duration', `${duration.toFixed(2)}ms`);
    element.style.left = `${(x - rect.left - length * 0.9).toFixed(2)}px`;
    element.style.top = `${(y - rect.top - 11).toFixed(2)}px`;
    stage.appendChild(element);
    const transform = progress => `translate3d(${(dx * progress).toFixed(2)}px, ${(dy * progress).toFixed(2)}px, 0) rotate(${angle.toFixed(2)}deg) scale(1)`;
    let animation;
    try {
      animation = element.animate([
        { transform: transform(0), offset: 0, easing: 'linear' },
        { opacity: 0, offset: 0, easing: 'ease-in-out' },
        { opacity: 0.34 * strength, offset: 0.12, easing: 'ease-in-out' },
        { opacity: strength, offset: 0.38, easing: 'ease-in-out' },
        { opacity: 0.42 * strength, offset: 0.58, easing: 'ease-in-out' },
        { opacity: 0.1 * strength, offset: 0.84, easing: 'ease-in-out' },
        { transform: transform(1), opacity: 0, offset: 1 },
      ], { duration, easing: 'linear', fill: 'forwards' });
    } catch {
      element.remove();
      unsupported = true;
      stop();
      return;
    }
    const token = generation;
    const entry = { stage, element, animation };
    active.add(entry);
    const finish = () => {
      element.remove();
      if (token !== generation || disposed || !active.delete(entry)) return;
      schedule();
    };
    animation.finished.then(finish, finish);
    if (loading) schedule();
  };
  const sync = (restart = false) => {
    const eligible = targets();
    if (restart || !eligible.length || [...active].some(entry =>
      !eligible.some(target => target.stage === entry.stage) || entry.element.isConnected === false)) stop();
    if (!eligible.length || disposed || unsupported) return;
    if (loading && !active.size && timer === null) spawn();
    else schedule();
  };
  const onVisibility = () => ownerDocument.hidden ? stop() : sync();
  const onPageHide = () => stop();
  ownerDocument.addEventListener?.('visibilitychange', onVisibility);
  view.addEventListener?.('pagehide', onPageHide);
  return {
    sync,
    stop,
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      ownerDocument.removeEventListener?.('visibilitychange', onVisibility);
      view.removeEventListener?.('pagehide', onPageHide);
    },
  };
}
