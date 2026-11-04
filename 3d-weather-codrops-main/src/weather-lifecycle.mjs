export const WEATHER_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

export const HEADER_WEATHER_RECOVERY_STYLES = `
:host([data-weather-variant='header']) .weather-header-preview .weather-header-state--recovery {
  position: absolute !important; inset: 0 !important; width: 100% !important; height: 100% !important;
  min-width: 0 !important; min-height: 0 !important; box-sizing: border-box !important;
  padding: 4px 8px !important; overflow: hidden !important; pointer-events: none !important; z-index: 50 !important;
}
:host([data-weather-variant='header']) .weather-header-preview .weather-header-state--recovery .weather-header-state__inner {
  display: flex !important; align-items: center !important; justify-content: center !important;
  width: 100% !important; min-width: 0 !important; max-height: 100% !important;
  padding: 0 !important; overflow: hidden !important; pointer-events: none !important;
}
:host([data-weather-variant='header']) .weather-header-preview .weather-header-state--recovery .weather-header-state__inner--error .weather-header-state__notice {
  margin: 0 !important; padding: 0 !important; overflow-wrap: anywhere; text-align: center;
  font-size: 10px !important; line-height: 1.25 !important; letter-spacing: 0 !important; text-transform: none !important;
}
`;

export function resolveWeatherLocationNotice(state, copy) {
  if (state.geoStatus === 'pending') return null;
  const keys = {
    denied: ['locationDeniedStatus', 'locationPermissionDenied'],
    timeout: ['locationTimeoutStatus', 'locationTimeout'],
    unavailable: ['locationUnavailableStatus', 'locationUnavailable'],
    aborted: ['locationUnavailableStatus', 'locationUnavailable'],
  };
  if (keys[state.geoStatus]) return keys[state.geoStatus].map(key => copy[key]).find(Boolean);
  return state.error ? copy.unavailable || copy.loadError : null;
}

const locationKey = location => typeof location === 'string'
  ? location.trim()
  : `${Number(location?.latitude)},${Number(location?.longitude)}`;

export function createWeatherController({ service, locale = 'en', initialLocation = '', fallbackLocation = 'Leipzig', useGeolocation = false, requireLocation = false, now = Date.now }) {
  let location = initialLocation || null;
  let generation = 0;
  let pending = null;
  let locating = null;
  let disposed = false;
  const listeners = new Set();
  let state = { weather: null, location, lastUpdatedAt: 0, loading: false, error: null, geoStatus: requireLocation && !location ? 'pending' : null };
  const publish = patch => {
    state = { ...state, ...patch };
    for (const listener of listeners) listener(state);
  };
  const request = target => {
    if (disposed) return Promise.reject(new Error('Weather widget is unmounted.'));
    const key = locationKey(target);
    if (pending?.key === key) return pending.promise;
    location = target;
    const token = ++generation;
    publish({ loading: true, error: null, geoStatus: null });
    const promise = Promise.resolve().then(() => service.getCurrentWeather(target, { locale, forceRefresh: true })).then(weather => {
      if (disposed || token !== generation) return false;
      if (!weather?.current || !Array.isArray(weather.forecast?.forecastday)) throw new Error('Incomplete weather response.');
      if (weather.stale) {
        if (!state.weather) publish({ weather });
        throw new Error('Only stale weather is available.');
      }
      publish({ weather, location: target, lastUpdatedAt: now(), error: null });
      return weather;
    }).catch(error => {
      if (disposed || token !== generation) return false;
      publish({ error });
      throw error;
    }).finally(() => {
      if (!disposed && token === generation) publish({ loading: false });
      if (pending?.promise === promise) pending = null;
    });
    pending = { key, promise };
    return promise;
  };
  const currentLocation = () => {
    if (disposed) return Promise.reject(new Error('Weather widget is unmounted.'));
    if (locating) return locating;
    const token = ++generation;
    pending = null;
    publish({ loading: true, error: null, geoStatus: 'pending' });
    const promise = Promise.resolve().then(() => service.getCurrentLocation()).then(target => {
      if (disposed || token !== generation) return false;
      return request(target);
    }, error => {
      if (disposed || token !== generation) return false;
      publish({ loading: false, geoStatus: error?.code === 1 ? 'denied' : error?.code === 3 ? 'timeout' : 'unavailable' });
      throw error;
    }).finally(() => { if (locating === promise) locating = null; });
    locating = promise;
    return promise;
  };
  return {
    refresh: () => {
      if (!location && requireLocation) {
        const error = new Error('Device location is required.');
        return Promise.reject(error);
      }
      return location ? request(location) : useGeolocation ? currentLocation() : request(fallbackLocation);
    },
    setLocation: request,
    setLocationStatus({ status, code } = {}) {
      if (disposed) return;
      if (status === 'none' || status === 'aborted') {
        publish({ geoStatus: null });
        return;
      }
      const geoStatus = status === 'pending' ? 'pending' : status === 'denied' || code === 1 ? 'denied' : status === 'timeout' || code === 3 ? 'timeout' : 'unavailable';
      publish({ geoStatus });
    },
    currentLocation,
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
    cancel() {
      generation += 1;
      pending = null;
      locating = null;
    },
    dispose() {
      disposed = true;
      generation += 1;
      pending = null;
      locating = null;
      listeners.clear();
    },
  };
}

export function createRetryableModuleLoader(url, importModule = value => import(value), pause = delay => new Promise(resolve => setTimeout(resolve, delay))) {
  let pending;
  let retry = 0;
  const loader = () => {
    if (pending) return pending;
    const load = async () => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const target = new URL(url);
        if (retry) target.searchParams.set('weather-retry', String(retry));
        try {
          return await importModule(target.href);
        } catch (error) {
          retry += 1;
          if (attempt === 2) throw error;
          await pause(300 * 2 ** attempt);
        }
      }
    };
    pending = load().catch(error => { pending = null; throw error; });
    return pending;
  };
  loader.reset = () => { pending = null; retry += 1; };
  return loader;
}

export function createRecoverableScene(React, jsx, load, environment = globalThis) {
  const window = environment.window || environment;
  const document = environment.document;
  return class WeatherSceneBoundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { error: null, Scene: React.lazy(load), version: 0 };
      this.attempts = 0;
      this.lossTimers = new Map();
      this.retry = () => {
        if (!this.mounted || !this.state.error || document?.hidden) return;
        window.clearTimeout(this.retryTimer);
        for (const timer of this.lossTimers.values()) window.clearTimeout(timer);
        this.lossTimers.clear();
        load.reset?.();
        this.setState(state => ({ error: null, Scene: React.lazy(load), version: state.version + 1 }));
      };
      this.resume = () => {
        if (document?.hidden) return;
        this.attempts = 0;
        this.retry();
      };
      this.lost = event => {
        const canvas = event.target;
        if (this.lossTimers.has(canvas)) return;
        this.lossTimers.set(canvas, window.setTimeout(() => {
          this.lossTimers.delete(canvas);
          if (!this.mounted) return;
          this.setState({ error: new Error('Weather WebGL context did not restore.') }, () => this.scheduleRetry());
        }, 5000));
      };
      this.restored = event => {
        window.clearTimeout(this.lossTimers.get(event.target));
        this.lossTimers.delete(event.target);
      };
    }
    static getDerivedStateFromError(error) { return { error }; }
    componentDidCatch() { this.scheduleRetry(); }
    scheduleRetry() {
      window.clearTimeout(this.retryTimer);
      if (!this.mounted || this.attempts >= 3 || document?.hidden) return;
      this.retryTimer = window.setTimeout(this.retry, [1000, 4000, 12000][this.attempts++]);
    }
    componentDidMount() {
      this.mounted = true;
      window.addEventListener?.('online', this.resume);
      document?.addEventListener('visibilitychange', this.resume);
      this.node?.addEventListener('webglcontextlost', this.lost, true);
      this.node?.addEventListener('webglcontextrestored', this.restored, true);
    }
    componentWillUnmount() {
      this.mounted = false;
      window.clearTimeout(this.retryTimer);
      for (const timer of this.lossTimers.values()) window.clearTimeout(timer);
      this.lossTimers.clear();
      window.removeEventListener?.('online', this.resume);
      document?.removeEventListener('visibilitychange', this.resume);
      this.node?.removeEventListener('webglcontextlost', this.lost, true);
      this.node?.removeEventListener('webglcontextrestored', this.restored, true);
    }
    render() {
      const { fallback, ...props } = this.props;
      return jsx('div', {
        ref: node => { this.node = node; },
        style: { width: '100%', height: '100%' },
        children: this.state.error ? fallback : jsx(React.Suspense, {
          fallback,
          children: jsx(this.state.Scene, { ...props }, this.state.version),
        }),
      });
    }
  };
}
