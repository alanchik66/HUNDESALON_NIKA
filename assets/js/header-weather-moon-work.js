/* One off-thread lunar renderer per map pair/window. The main-thread maps stay
 * intact for browsers that restrict module workers or lose a worker. */
const brokers = new WeakMap();
const deadlineMs = 10000;
const isCurrent = callback => { try { return callback?.() !== false; } catch { return false; } };

class LunarWorkBroker {
  constructor(view, maps, remove) {
    this.view = view; this.maps = maps; this.remove = remove;
    this.clients = new Set(); this.pending = new Map(); this.sequence = 0;
    this.worker = null; this.active = 0; this.ready = false; this.broken = false;
    this.later = view.setTimeout?.bind(view) || globalThis.setTimeout;
    this.clear = view.clearTimeout?.bind(view) || globalThis.clearTimeout;
    this.visibility = () => { if (view.document?.hidden) this.stop(false); };
    view.document?.addEventListener('visibilitychange', this.visibility);
  }

  finish(id, frame = null) {
    const request = this.pending.get(id);
    if (!request) return;
    this.pending.delete(id); this.clear(request.timer);
    if (request.client.pending === id) request.client.pending = 0;
    request.resolve(frame && isCurrent(request.current) ? frame : null);
  }

  stop(broken) {
    if (broken) this.broken = true;
    this.clear(this.startTimer); this.clear(this.workTimer);
    this.startTimer = this.workTimer = null;
    const worker = this.worker;
    this.worker = null; this.ready = false; this.active = 0;
    if (worker) {
      worker.removeEventListener('message', this.message);
      worker.removeEventListener('error', this.error);
      worker.removeEventListener('messageerror', this.error);
      try { worker.terminate(); } catch {}
    }
    for (const id of this.pending.keys()) this.finish(id);
  }

  start() {
    if (this.broken || this.view.document?.hidden) return false;
    if (this.worker) return true;
    try {
      const url = new URL(`./header-weather-moon-worker.js${new URL(import.meta.url).search}`, import.meta.url);
      const worker = new this.view.Worker(url, { type: 'module', name: 'nika-lunar-surface' });
      this.worker = worker;
      this.error = event => {
        event?.preventDefault?.();
        if (this.worker === worker) this.stop(true);
      };
      this.message = event => {
        if (this.worker !== worker) return;
        const data = event.data;
        if (data?.type === 'ready') {
          this.clear(this.startTimer); this.startTimer = null; this.ready = true; this.flush(); return;
        }
        if (data?.type === 'error') { this.stop(true); return; }
        if (data?.type !== 'frame' || data.id !== this.active) return;
        this.clear(this.workTimer); this.workTimer = null; this.active = 0;
        const request = this.pending.get(data.id), frame = data.frame;
        if (request) {
          const size = request.options.size ?? 384;
          if (frame?.width !== size || frame.height !== size || !(frame.data instanceof Uint8ClampedArray)
            || frame.data.length !== size * size * 4 || !frame.stats || typeof frame.stats !== 'object') {
            this.stop(true); return;
          }
          this.finish(data.id, frame);
        }
        this.flush();
      };
      worker.addEventListener('message', this.message);
      worker.addEventListener('error', this.error);
      worker.addEventListener('messageerror', this.error);
      this.startTimer = this.later(() => this.stop(true), deadlineMs);
      // Structured cloning copies these arrays once. Never detach the fallback.
      worker.postMessage({ type: 'init', maps: this.maps });
      return true;
    } catch { this.stop(true); return false; }
  }

  flush() {
    if (!this.ready || this.active || !this.worker) return;
    for (const [id, request] of this.pending) {
      if (!isCurrent(request.current)) { this.finish(id); continue; }
      this.active = id;
      this.workTimer = this.later(() => this.stop(true), deadlineMs);
      try { this.worker.postMessage({ type: 'render', id, lighting: request.lighting, options: request.options }); }
      catch { this.stop(true); }
      return;
    }
  }

  render(client, lighting, options, current) {
    if (client.pending) this.finish(client.pending);
    return new Promise(resolve => {
      const id = ++this.sequence;
      client.pending = id;
      this.pending.set(id, { client, lighting, options, current, resolve,
        timer: this.later(() => this.stop(true), deadlineMs) });
      if (!this.start()) this.finish(id);
      else this.flush();
    });
  }

  release(client) {
    if (client.pending) this.finish(client.pending);
    this.clients.delete(client);
    if (!this.clients.size) {
      this.stop(false); this.view.document?.removeEventListener('visibilitychange', this.visibility); this.remove();
    }
  }
}

export function createLunarWorkClient(view) {
  let broker = null, disposed = false;
  const client = { pending: 0 };
  return {
    render(lighting, maps, options = {}, current) {
      if (client.pending) broker?.finish(client.pending);
      if (disposed || !isCurrent(current) || typeof view?.Worker !== 'function' || !maps || typeof maps !== 'object') return Promise.resolve(null);
      if (view.document?.hidden) { broker?.stop(false); return Promise.resolve(null); }
      if (broker && broker.maps !== maps) { broker.release(client); broker = null; }
      if (!broker) {
        let views = brokers.get(maps);
        if (!views) { views = new WeakMap(); brokers.set(maps, views); }
        broker = views.get(view);
        if (!broker) {
          broker = new LunarWorkBroker(view, maps, () => views.delete(view)); views.set(view, broker);
        }
        broker.clients.add(client);
      }
      return broker.render(client, lighting, options, current);
    },
    dispose() { if (!disposed) { disposed = true; broker?.release(client); broker = null; } },
  };
}
