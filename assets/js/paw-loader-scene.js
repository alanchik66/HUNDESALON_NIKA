/* One animal at a time; four planted feet share one coherent walking trajectory. */
(function installPawScene() {
  'use strict';
  if (window.NikaPawScene) return;
  const installations = new WeakMap();
  const entry = document.currentScript?.src || new URL('/assets/js/paw-loader-scene.js', document.baseURI).href;
  const entryUrl = new URL(entry, document.baseURI);
  const atlasUrl = new URL('../images/preloader/paws-atlas-v1.webp', entryUrl);
  if (entryUrl.searchParams.has('v')) atlasUrl.searchParams.set('v', entryUrl.searchParams.get('v'));
  const feet = [
    { name: 'front-left', column: 0, front: true, side: -1 },
    { name: 'front-right', column: 1, front: true, side: 1 },
    { name: 'hind-left', column: 2, front: false, side: -1 },
    { name: 'hind-right', column: 3, front: false, side: 1 },
  ];
  const order = [2, 0, 3, 1];
  // Apparent size, cadence and spacing are artistic scene settings, not a physical simulation.
  const animals = [
    { name: 'dog', row: 0, mobile: 62, desktop: 92, wheelbase: 3.4, track: 1.15, stride: .55, cycle: 1400 },
    { name: 'cat', row: 1, mobile: 49, desktop: 74, wheelbase: 3.5, track: 1.05, stride: .60, cycle: 1280 },
    { name: 'guinea-pig', row: 2, mobile: 29, desktop: 43, wheelbase: 4.8, track: 1.6, stride: .55, cycle: 900 },
  ];
  const random = (min, max) => min + Math.random() * (max - min);
  const footprint = (animal, front) => {
    const count = animal === 'guinea-pig' && !front ? 3 : 4;
    const toes = count === 3 ? [[28, 28], [50, 18], [72, 28]] : [[23, 35], [41, 22], [59, 22], [77, 35]];
    const digits = toes.map(([x, y]) => `<ellipse data-digit="" cx="${x}" cy="${y}" rx="${animal === 'guinea-pig' ? 8 : 10}" ry="${animal === 'guinea-pig' ? 16 : 13}"/>`).join('');
    const claws = animal === 'cat' ? '' : toes.map(([x, y]) => `<path data-claw="" d="M${x - 3} ${y - 16}q3 -12 6 0z"/>`).join('');
    const pad = animal === 'cat'
      ? '<path data-main-pad="" d="M25 65C24 55 34 50 41 51Q50 41 59 51C67 50 76 55 75 65L78 80C82 93 69 100 60 91C58 105 42 105 40 91C31 100 18 93 22 80Z"/>'
      : animal === 'guinea-pig'
        ? `<path data-main-pad="" d="M32 56Q50 44 68 56L73 ${front ? 79 : 87}Q65 103 50 99Q34 102 27 ${front ? 79 : 87}Z"/>`
        : '<path data-main-pad="" d="M29 64Q36 49 45 53Q50 47 56 53Q66 50 72 66L78 83Q76 98 62 94Q50 101 37 94Q21 98 22 83Z"/>';
    return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 112"><g fill="#d7c6a4">${digits}${claws}${pad}</g></svg>`)}")`;
  };
  let atlasPromise;
  const prepareAtlas = view => {
    if (!atlasPromise) atlasPromise = new Promise(resolve => {
      if (typeof view.Image !== 'function') { resolve(false); return; }
      const image = new view.Image();
      let decoding = false;
      image.decoding = 'async';
      image.onload = () => {
        if (decoding) return;
        decoding = true;
        Promise.resolve().then(() => typeof image.decode === 'function' ? image.decode() : undefined)
          .then(() => resolve(true), () => resolve(Boolean(image.naturalWidth)));
      };
      image.onerror = () => resolve(false);
      image.src = atlasUrl.href;
      if (image.complete && image.naturalWidth) image.onload();
    }).catch(() => false);
    return atlasPromise;
  };

  function mount(stage) {
    if (installations.has(stage)) return installations.get(stage);
    const ownerDocument = stage.ownerDocument || document;
    const view = ownerDocument.defaultView || window;
    const motion = view.matchMedia?.('(prefers-reduced-motion: reduce)');
    const groups = [];
    let activeGroup = null, sequence = [];
    const tasks = new Set();
    const animations = new Map();
    const prints = new Set();
    let stopped = false, disposed = false, paused = Boolean(ownerDocument.hidden), epoch = 0;
    let width = 0, height = 0, resizeTask = null, resolveReady;
    const ready = new Promise(resolve => { resolveReady = resolve; });
    const now = () => view.performance?.now() ?? Date.now();
    const arm = task => {
      task.due = now() + task.remaining;
      task.id = view.setTimeout(() => {
        tasks.delete(task);
        task.id = null;
        if (!stopped && !paused) task.callback();
      }, task.remaining);
    };
    const schedule = (callback, delay) => {
      const task = { callback, remaining: delay, due: 0, id: null };
      tasks.add(task);
      if (!paused && !stopped) arm(task);
      return task;
    };
    const clearWork = () => {
      epoch += 1;
      for (const task of tasks) if (task.id !== null) view.clearTimeout(task.id);
      tasks.clear();
      for (const animation of animations.keys()) animation.cancel();
      animations.clear();
      for (const print of prints) print.remove();
      prints.clear();
      resizeTask = null;
    };
    const animate = (node, frames, duration, complete) => {
      const token = epoch;
      let animation;
      try { animation = node.animate(frames, { duration, easing: 'linear', fill: 'forwards' }); }
      catch { schedule(complete, duration); return; }
      animations.set(animation, node);
      if (paused) animation.pause();
      animation.finished.then(() => {
        if (!animations.delete(animation) || stopped || token !== epoch) return;
        complete();
        animation.cancel();
      }, () => animations.delete(animation));
      return animation;
    };
    const transform = (foot, x, y, angle, scale = '1', roll = 0) =>
      `translate3d(${(x - foot.width / 2).toFixed(2)}px, ${(y - foot.height / 2).toFixed(2)}px, 0) rotate(${angle.toFixed(2)}deg) perspective(800px) rotateX(${roll}deg) scale(${scale})`;
    const leavePrint = (group, foot, x = foot.x, y = foot.y) => {
      if (stopped) return;
      const print = ownerDocument.createElement('span');
      print.className = 'paw-loader__print';
      print.dataset.animal = group.spec.name;
      print.dataset.foot = foot.name;
      print.setAttribute('aria-hidden', 'true');
      print.style.width = `${foot.width}px`;
      print.style.height = `${foot.height}px`;
      print.style.backgroundImage = foot.image;
      print.style.transform = transform(foot, x, y, foot.angle, '0.84');
      stage.appendChild(print);
      prints.add(print);
      if (prints.size > 24) {
        const oldest = prints.values().next().value;
        for (const [animation, node] of animations) if (node === oldest) { animations.delete(animation); animation.cancel(); }
        oldest.remove(); prints.delete(oldest);
      }
      animate(print, [{ opacity: .3, offset: 0 }, { opacity: .19, offset: .38 }, { opacity: 0, offset: 1 }],
        random(1350, 1900), () => { prints.delete(print); print.remove(); });
    };
    const pose = (group, foot, lead = 0) => {
      const radians = group.angle * Math.PI / 180;
      const forward = { x: Math.sin(radians), y: -Math.cos(radians) };
      const lateral = { x: Math.cos(radians), y: Math.sin(radians) };
      const longitudinal = (foot.front ? 1 : -1) * group.wheelbase / 2 + lead;
      return {
        x: group.x + forward.x * longitudinal + lateral.x * foot.side * group.track / 2,
        y: group.y + forward.y * longitudinal + lateral.y * foot.side * group.track / 2,
        angle: group.angle + foot.side * (group.spec.name === 'guinea-pig' ? 7 : 3),
      };
    };
    const footVisible = foot => {
      let points = [foot];
      let scaleX = 1, scaleY = 1, padding = 0;
      const flight = foot.flight;
      if (flight?.animation && animations.has(flight.animation)) {
        const progress = Math.max(0, Number(flight.animation.currentTime) || 0) / flight.duration;
        // Bound the entire airborne path, including the slight lateral arc and roll.
        // After contact the target is fixed; no per-frame DOM measurement is needed.
        points = progress < .25 ? [flight.start, flight.target] : [flight.target];
        if (progress < .25) { scaleX = scaleY = 1.04; padding = foot.width * .06; }
        else if (progress < .285) scaleX = 1.012;
      }
      const radians = foot.angle * Math.PI / 180;
      // A planted paw has an exact rotated rectangle, not a generous circle.
      // A circle can keep an already invisible foot "on glass" for a whole stance.
      const extentX = (Math.abs(Math.cos(radians)) * foot.width * scaleX +
        Math.abs(Math.sin(radians)) * foot.height * scaleY) / 2 + padding;
      const extentY = (Math.abs(Math.sin(radians)) * foot.width * scaleX +
        Math.abs(Math.cos(radians)) * foot.height * scaleY) / 2 + padding;
      return Math.max(...points.map(point => point.x)) + extentX >= 0 &&
        Math.min(...points.map(point => point.x)) - extentX <= width &&
        Math.max(...points.map(point => point.y)) + extentY >= 0 &&
        Math.min(...points.map(point => point.y)) - extentY <= height;
    };
    const place = (group, initial) => {
      group.generation = (group.generation || 0) + 1;
      for (const [animation, node] of animations) if (group.feet.some(foot => foot.node === node)) {
        animations.delete(animation); animation.cancel();
      }
      const spec = group.spec;
      let size = (width < 720 ? spec.mobile : spec.desktop) * Math.min(1, width / 360, height / 460);
      // Cross the shorter viewport axis. A small heading variation keeps four
      // coherent feet readable, rather than scattering unrelated prints.
      const vertical = width >= height;
      group.angle = (vertical ? (Math.random() < .5 ? 0 : 180) : (Math.random() < .5 ? 90 : 270)) + random(-12, 12);
      const radians = group.angle * Math.PI / 180;
      const bodyLength = size * (8 / 9) * spec.wheelbase;
      const longSpan = bodyLength * (1 + spec.stride * .75) + size * 1.4;
      const crossSpan = size * (spec.track + 1.4);
      size *= Math.min(1, width * .94 / (Math.abs(Math.sin(radians)) * longSpan + Math.abs(Math.cos(radians)) * crossSpan),
        height * .94 / (Math.abs(Math.cos(radians)) * longSpan + Math.abs(Math.sin(radians)) * crossSpan));
      group.wheelbase = size * (8 / 9) * spec.wheelbase;
      group.track = size * spec.track;
      group.stride = group.wheelbase * spec.stride;
      group.x = 0; group.y = 0;
      group.step = 0;
      for (const foot of group.feet) {
        foot.flight = null;
        const hindScale = !foot.front && spec.name !== 'guinea-pig' ? .92 : 1;
        foot.width = size * hindScale;
        foot.height = size * (8 / 9) * hindScale;
        foot.node.style.width = `${foot.width.toFixed(2)}px`;
        foot.node.style.height = `${foot.height.toFixed(2)}px`;
        // Initialize each foot from its own previous contact. With a 75% stance,
        // every foot traverses +/- .375 stride relative to its shoulder or hip.
        const point = pose(group, foot, group.stride * (order.indexOf(foot.column) / 4 - .375));
        Object.assign(foot, point);
      }
      const radius = foot => Math.hypot(foot.width, foot.height) / 2;
      const minX = Math.min(...group.feet.map(foot => foot.x - radius(foot)));
      const maxX = Math.max(...group.feet.map(foot => foot.x + radius(foot)));
      const minY = Math.min(...group.feet.map(foot => foot.y - radius(foot)));
      const maxY = Math.max(...group.feet.map(foot => foot.y + radius(foot)));
      group.x = random(6 - minX, width - 6 - maxX);
      group.y = random(6 - minY, height - 6 - maxY);
      if (!initial) {
        if (vertical) group.y = Math.cos(radians) > 0
          ? height - size * .3 - Math.min(...group.feet.map(foot => foot.y))
          : size * .3 - Math.max(...group.feet.map(foot => foot.y));
        else group.x = Math.sin(radians) > 0
          ? size * .3 - Math.max(...group.feet.map(foot => foot.x))
          : width - size * .3 - Math.min(...group.feet.map(foot => foot.x));
      }
      for (const foot of group.feet) {
        foot.x += group.x; foot.y += group.y;
        foot.node.style.transform = transform(foot, foot.x, foot.y, foot.angle);
        foot.node.style.opacity = '1';
      }
    };
    const nextGroup = () => {
      if (!sequence.length) {
        sequence = [...groups];
        for (let index = sequence.length - 1; index > 0; index--) {
          const other = Math.floor(Math.random() * (index + 1));
          [sequence[index], sequence[other]] = [sequence[other], sequence[index]];
        }
        if (sequence[0] === activeGroup) sequence.push(sequence.shift());
      }
      return sequence.shift();
    };
    const startRoute = (initial = false, preserveAnimal = false) => {
      clearWork();
      const next = preserveAnimal && activeGroup ? activeGroup : nextGroup();
      for (const group of groups) group.node.hidden = group !== next;
      activeGroup = next;
      stage.dataset.activeAnimal = next.spec.name;
      place(next, initial);
      schedule(() => step(next), 0);
    };
    const step = group => {
      if (stopped || paused) return;
      if (stage.isConnected === false) { stop(); return; }
      const generation = group.generation;
      const foot = group.feet[order[group.step % 4]];
      group.step += 1;
      group.node.dataset.lastFoot = foot.name;
      const radians = group.angle * Math.PI / 180;
      const target = { x: foot.x + Math.sin(radians) * group.stride,
        y: foot.y - Math.cos(radians) * group.stride, angle: foot.angle };
      const start = { x: foot.x, y: foot.y, angle: foot.angle };
      const duration = group.spec.cycle * (motion?.matches ? 1.35 : 1);
      const beat = duration / 4;
      for (const [animation, node] of animations) if (node === foot.node) {
        animations.delete(animation); animation.cancel();
      }
      const movement = (fraction, scale = '1', roll = 0, arc = 0) => transform(foot,
        start.x + (target.x - start.x) * fraction + Math.cos(radians) * arc,
        start.y + (target.y - start.y) * fraction + Math.sin(radians) * arc, start.angle, scale, roll);
      const lift = motion?.matches ? '.985' : '.965';
      const roll = motion?.matches ? 5 : 10;
      const animation = animate(foot.node, [
        { transform: movement(0, '1'), opacity: 1, offset: 0, easing: 'ease-in' },
        { transform: movement(.025, '.99', -roll), opacity: 1, offset: .035, easing: 'cubic-bezier(.35, 0, .55, 1)' },
        { transform: movement(.55, lift, 0, foot.side * group.track * .035), opacity: 1, offset: .14, easing: 'ease-out' },
        { transform: movement(.96, '.99', roll * .6), opacity: 1, offset: .225, easing: 'ease-out' },
        { transform: movement(1, '1.012, .995'), opacity: 1, offset: .25, easing: 'ease-out' },
        { transform: movement(1, '1'), opacity: 1, offset: .285 },
        { transform: movement(1, '1'), opacity: 1, offset: 1 },
      ], duration, () => {
        if (group.generation !== generation) return;
        Object.assign(foot, target);
        foot.node.style.transform = transform(foot, foot.x, foot.y, foot.angle);
        foot.node.style.opacity = '1';
      });
      foot.flight = { animation, start, target, duration };
      schedule(() => {
        if (group.generation !== generation) return;
        Object.assign(foot, target);
        foot.node.style.transform = transform(foot, foot.x, foot.y, foot.angle);
        leavePrint(group, foot);
      }, duration * .25);
      schedule(() => {
        if (group.generation !== generation) return;
        if (group.feet.every(candidate => !footVisible(candidate))) { startRoute(); return; }
        step(group);
      }, beat);
    };
    const layout = () => {
      if (stopped) return;
      const rect = stage.getBoundingClientRect();
      const nextWidth = Math.max(1, rect.width || view.innerWidth || 360);
      const nextHeight = Math.max(1, rect.height || view.innerHeight || 640);
      // Browsers can emit an initial resize after the first painted frame.
      // An unchanged viewport must not teleport the four planted feet.
      if (Math.abs(nextWidth - width) < .5 && Math.abs(nextHeight - height) < .5) return;
      width = nextWidth;
      height = nextHeight;
      startRoute(true, true);
    };
    const onResize = () => {
      if (!stopped && !resizeTask) resizeTask = schedule(() => { resizeTask = null; layout(); }, 70);
    };
    const onVisibility = () => {
      if (stopped || paused === Boolean(ownerDocument.hidden)) return;
      paused = Boolean(ownerDocument.hidden);
      if (paused) {
        for (const task of tasks) {
          task.remaining = Math.max(0, task.due - now());
          if (task.id !== null) view.clearTimeout(task.id);
          task.id = null;
        }
        for (const animation of animations.keys()) animation.pause();
      } else {
        for (const animation of animations.keys()) animation.play();
        for (const task of tasks) arm(task);
      }
    };
    const stop = () => {
      if (stopped) return;
      stopped = true;
      clearWork();
      for (const group of groups) group.node.remove();
      delete stage.dataset.activeAnimal;
      stage.classList.add('paw-loader--stopped');
      ownerDocument.removeEventListener('visibilitychange', onVisibility);
      view.removeEventListener('resize', onResize);
      view.removeEventListener('orientationchange', onResize);
      view.removeEventListener('pagehide', stop);
      resolveReady(false);
    };
    const handle = {
      ready,
      stop,
      dispose() {
        if (disposed) return;
        disposed = true;
        stop();
        installations.delete(stage);
      },
    };
    installations.set(stage, handle);
    stage.classList.add('paw-loader');
    stage.classList.remove('paw-loader--stopped');
    stage.setAttribute('aria-hidden', 'true');
    for (const spec of animals) {
      const node = ownerDocument.createElement('div');
      node.className = 'paw-loader__animal';
      node.dataset.animal = spec.name;
      node.hidden = true;
      const group = { spec, node, feet: [] };
      for (const definition of feet) {
        const paw = ownerDocument.createElement('span');
        paw.className = 'paw-loader__paw';
        paw.dataset.animal = spec.name;
        paw.dataset.foot = definition.name;
        paw.style.setProperty('--paw-column', `${definition.column * 100 / 3}%`);
        paw.style.setProperty('--paw-row', `${spec.row * 50}%`);
        const image = footprint(spec.name, definition.front);
        paw.style.setProperty('--paw-print', image);
        node.appendChild(paw);
        group.feet.push({ ...definition, node: paw, image });
      }
      groups.push(group);
      stage.appendChild(node);
    }
    ownerDocument.addEventListener('visibilitychange', onVisibility);
    view.addEventListener('resize', onResize, { passive: true });
    view.addEventListener('orientationchange', onResize);
    view.addEventListener('pagehide', stop);
    layout();
    prepareAtlas(view).then(decoded => {
      if (stopped || disposed) return;
      if (decoded) {
        stage.style.setProperty('--paw-atlas-image', `url("${atlasUrl.href}")`);
        stage.setAttribute('data-paw-image-ready', '');
      }
      resolveReady(decoded);
    });
    return handle;
  }
  window.NikaPawScene = Object.freeze({ mount });
})();
