export const WEATHER_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

export function resolveForecastCloudCover(forecastDay) {
  const percent = value => value === null || value === undefined || (typeof value === 'string' && !value.trim()) || !Number.isFinite(Number(value))
    ? null : Math.max(0, Math.min(100, Number(value)));
  for (const value of [forecastDay?.day?.cloud, forecastDay?.day?.cloud_cover, forecastDay?.day?.avgcloud]) {
    const cloud = percent(value);
    if (cloud !== null) return cloud;
  }
  const hours = Array.isArray(forecastDay?.hour) ? forecastDay.hour : [];
  const clouds = hours.map(hour => percent(hour?.cloud ?? hour?.cloud_cover)).filter(value => value !== null);
  return clouds.length ? clouds.reduce((sum, cloud) => sum + cloud, 0) / clouds.length : null;
}

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
.weather-scene-recovery,
:host([data-weather-variant='header']) .weather-header-preview .weather-scene-recovery,
:host([data-weather-variant='header']) .weather-header-dropdown .weather-scene-recovery {
  position: absolute; inset: 0; overflow: hidden !important; pointer-events: none; isolation: isolate;
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 24%, #000 76%, transparent) !important;
  mask-image: linear-gradient(90deg, transparent, #000 24%, #000 76%, transparent) !important;
}
.weather-scene-recovery__clouds { position: absolute; inset: -18% -8% 0; }
.weather-scene-recovery__cloud {
  position: absolute; top: 0; left: -16%; width: 72%; height: 94%;
  background: url('/assets/images/weather/cloud-9225a9f1.png') center / contain no-repeat;
  opacity: .5; filter: brightness(1.1) drop-shadow(0 6px 10px #101c2b55);
  animation: weatherRecoveryCloudDrift 18s ease-in-out infinite alternate;
}
.weather-scene-recovery__cloud:nth-child(2) { left: 24%; top: 8%; opacity: .45; animation-duration: 23s; animation-delay: -11s; }
.weather-scene-recovery__cloud:nth-child(3) { left: 62%; top: -8%; opacity: .4; animation-duration: 27s; animation-delay: -18s; }
.weather-scene-recovery--foggy .weather-scene-recovery__clouds { opacity: .7; filter: blur(8px); }
.weather-scene-recovery__orb {
  position: absolute; left: 50%; top: 18%; width: min(26%, 120px); aspect-ratio: 1;
  border-radius: 50%; transform: translateX(-50%);
  background: radial-gradient(circle at 35% 30%, #fffde5 0%, #ffdc81 42%, #ee9e31 76%, #d77525 100%);
  box-shadow: 0 0 22px #ffce6055, 0 0 48px #f1b74222;
  animation: weatherRecoveryOrbGlow 5s ease-in-out infinite alternate;
}
.weather-scene-recovery--night .weather-scene-recovery__orb {
  background: radial-gradient(circle at 28% 36%, #adb2ba 0 6%, transparent 7%), radial-gradient(circle at 65% 60%, #9299a4 0 9%, transparent 10%), radial-gradient(circle at 38% 30%, #f3f1e5, #a8b0bd 75%, #6f7c8b);
  box-shadow: 0 0 20px #dce9ff33;
}
.weather-scene-recovery__precipitation { position: absolute; inset: 25% 0 0; opacity: .65; }
.weather-scene-recovery--rainy .weather-scene-recovery__precipitation,
.weather-scene-recovery--stormy .weather-scene-recovery__precipitation {
  background: linear-gradient(105deg, transparent 45%, #b6d7ed 46% 48%, transparent 49%) 0 0 / 24px 42px;
  animation: weatherRecoveryRain .8s linear infinite;
}
.weather-scene-recovery--snowy .weather-scene-recovery__precipitation {
  background: radial-gradient(circle, #edf5ff 0 1.5px, transparent 2px) 0 0 / 31px 43px;
  animation: weatherRecoverySnow 5s linear infinite;
}
.weather-scene-recovery--stormy::after,
:host([data-weather-variant='header']) .weather-header-preview .weather-scene-recovery--stormy::after {
  content: ''; position: absolute; top: 28%; left: 58%; width: 9%; height: 35%; opacity: 0;
  clip-path: polygon(50% 0, 10% 58%, 45% 55%, 25% 100%, 95% 35%, 56% 40%, 78% 0) !important;
  background: #eef4ff; filter: drop-shadow(0 0 8px #c4e6ff); animation: weatherRecoveryLightning 6s linear infinite;
}
@keyframes weatherRecoveryCloudDrift { from { transform: translate3d(-7%, 0, 0) scale(1); } to { transform: translate3d(12%, 4%, 0) scale(1.07); } }
@keyframes weatherRecoveryOrbGlow { from { filter: brightness(.96); } to { filter: brightness(1.08); } }
@keyframes weatherRecoveryRain { to { background-position: -12px 42px; } }
@keyframes weatherRecoverySnow { to { background-position: 12px 86px; } }
@keyframes weatherRecoveryLightning { 0%, 70%, 73%, 76%, 100% { opacity: 0; } 71%, 74% { opacity: .8; } }
`;

export function resolveWeatherSceneFallback(weather) {
  if (!weather?.current) return null;
  const current = weather.current;
  const code = Number(current.condition?.code);
  const text = String(current.condition?.text || '').toLowerCase();
  const hour = Number(weather.location?.localtime?.match(/[T ](\d{2}):\d{2}/)?.[1]);
  const night = current.is_day === 0 || current.is_day === '0' ||
    (current.is_day == null && Number.isFinite(hour) && (hour >= 19 || hour <= 6));
  const kind = [1087, 1273, 1276, 1279, 1282].includes(code) || /thunder|storm/.test(text) ? 'stormy'
    : [1066, 1069, 1114, 1117, 1204, 1207, 1210, 1213, 1216, 1219, 1222, 1225, 1237, 1249, 1252, 1255, 1258, 1261, 1264].includes(code) || /snow|sleet|blizzard|ice pellet/.test(text) ? 'snowy'
      : [1063, 1072, 1150, 1153, 1168, 1171, 1180, 1183, 1186, 1189, 1192, 1195, 1198, 1201, 1240, 1243, 1246].includes(code) || /rain|drizzle|shower/.test(text) ? 'rainy'
        : [1030, 1135, 1147].includes(code) || /fog|mist/.test(text) ? 'foggy'
          : code === 1000 || /sunny|clear/.test(text) ? 'clear' : 'cloudy';
  return { kind, night, clouds: kind !== 'clear', orb: kind === 'clear' || code === 1003 || /partly/.test(text), precipitation: ['rainy', 'snowy', 'stormy'].includes(kind) };
}

export function renderWeatherSceneFallback(jsx, { weatherData, embedded, variant } = {}, loadingFallback) {
  const model = resolveWeatherSceneFallback(weatherData);
  if (!model) return loadingFallback;
  const children = [];
  // The header panel's Sun and Moon are shared shell overlays, not duplicate icons.
  if (model.orb && !(embedded && variant === 'header-panel')) children.push(jsx('span', { className: 'weather-scene-recovery__orb' }, 'orb'));
  if (model.clouds) children.push(jsx('div', { className: 'weather-scene-recovery__clouds', children: [0, 1, 2].map(key => jsx('span', { className: 'weather-scene-recovery__cloud' }, key)) }, 'clouds'));
  if (model.precipitation) children.push(jsx('div', { className: 'weather-scene-recovery__precipitation' }, 'precipitation'));
  return jsx('div', {
    className: `weather-scene-recovery weather-scene-recovery--${model.kind}${model.night ? ' weather-scene-recovery--night' : ''}`,
    'data-weather-fallback-kind': model.kind,
    'aria-hidden': true,
    children,
  });
}

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
      this.state = { error: null, contextLost: false, readyWeather: null, readiness: 0, Scene: React.lazy(load), version: 0 };
      this.attempts = 0;
      this.lossTimers = new Map();
      this.retry = () => {
        if (!this.mounted || !this.state.error || document?.hidden) return;
        window.clearTimeout(this.retryTimer);
        for (const timer of this.lossTimers.values()) window.clearTimeout(timer);
        this.lossTimers.clear();
        load.reset?.();
        this.setState(state => ({ error: null, contextLost: false, readyWeather: null, readiness: state.readiness + 1, Scene: React.lazy(load), version: state.version + 1 }));
      };
      this.resume = () => {
        if (document?.hidden) return;
        this.attempts = 0;
        this.retry();
      };
      this.lost = event => {
        event.preventDefault?.();
        const canvas = event.target;
        if (this.lossTimers.has(canvas)) return;
        this.setState(state => ({ contextLost: true, readyWeather: null, readiness: state.readiness + 1 }));
        this.lossTimers.set(canvas, window.setTimeout(() => {
          this.lossTimers.delete(canvas);
          if (!this.mounted) return;
          this.setState({ error: new Error('Weather WebGL context did not restore.') }, () => this.scheduleRetry());
        }, 5000));
      };
      this.restored = event => {
        window.clearTimeout(this.lossTimers.get(event.target));
        this.lossTimers.delete(event.target);
        this.setState({ contextLost: this.lossTimers.size > 0 });
      };
      this.sceneReady = (weather, readiness) => {
        if (!this.mounted || this.state.error || this.state.contextLost || readiness !== this.state.readiness ||
            !weather?.current || weather !== this.props.weatherData || this.state.readyWeather === weather) return;
        this.setState({ readyWeather: weather });
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
      const visualFallback = renderWeatherSceneFallback(jsx, props, fallback);
      const readiness = this.state.readiness;
      const awaitingFrame = Boolean(props.weatherData?.current && this.state.readyWeather !== props.weatherData);
      const scene = jsx(React.Suspense, {
        fallback: awaitingFrame ? null : visualFallback,
        children: jsx(this.state.Scene, { ...props, sceneRecoveryVersion: readiness,
          onSceneReady: weather => this.sceneReady(weather, readiness) }, this.state.version),
      });
      return jsx('div', {
        ref: node => { this.node = node; },
        style: { position: 'relative', width: '100%', height: '100%' },
        children: this.state.error ? visualFallback : this.state.contextLost || awaitingFrame ? [scene, visualFallback] : scene,
      });
    }
  };
}
