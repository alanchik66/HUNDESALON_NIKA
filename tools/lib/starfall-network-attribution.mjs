const ownedStack = value => /\/assets\/js\/site-shell\.js(?:[?:]|$)/.test(value || '');
const finiteCoordinate = (value, bound) => value !== null && value !== '' && Number.isFinite(Number(value)) && Math.abs(Number(value)) <= bound;

function knownClockCall(call) {
  try {
    const url = new URL(call.url);
    const documentUrl = new URL(call.documentUrl);
    if (url.origin === 'https://api.sunrise-sunset.org' && url.pathname === '/json' &&
        [...url.searchParams.keys()].every(key => ['lat', 'lng', 'date', 'formatted', 'tzid'].includes(key)) &&
        finiteCoordinate(url.searchParams.get('lat'), 90) && finiteCoordinate(url.searchParams.get('lng'), 180) &&
        /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get('date') || '') && url.searchParams.get('formatted') === '0') {
      return { url, consumer: 'resolveHeaderWeatherAstro consumes provider failures with Promise.allSettled and the local solar model.' };
    }
    if (url.origin === documentUrl.origin && documentUrl.hostname === '127.0.0.1' && url.pathname === '/api/weather' &&
        [...url.searchParams.keys()].every(key => ['latitude', 'longitude', 'timezone', 'lang'].includes(key)) &&
        finiteCoordinate(url.searchParams.get('latitude'), 90) && finiteCoordinate(url.searchParams.get('longitude'), 180) &&
        ['de', 'en', 'ru', 'uk'].includes(url.searchParams.get('lang'))) {
      return { url, consumer: 'syncHeaderWeatherOrbOverlay consumes resolveHeaderWeatherCurrent failures with its existing try/catch.' };
    }
  } catch {}
  return null;
}

export function attributeEntryNetworkErrors(entry, network) {
  entry.network = network;
  const nativeErrors = network.nativeEvents.filter(event => event.kind === 'error');
  const unhandled = network.nativeEvents.filter(event => event.kind === 'unhandledrejection');
  const handledNetwork = [];
  const unknown = [];
  for (const error of entry.rawPageErrors || []) {
    const text = `${error.name}: ${error.message}`;
    const candidates = network.nativeEvents.filter(call => {
      if (call.kind !== 'fetch-call' || !ownedStack(call.stack) || Math.abs(call.wall - error.at) > 100) return false;
      const known = knownClockCall(call);
      return known && text.includes(`${known.url.host}${known.url.pathname}${known.url.search}`);
    }).sort((first, second) => Math.abs(first.wall - error.at) - Math.abs(second.wall - error.at));
    const call = candidates[0];
    const documentNative = call && network.nativeEvents.filter(event => event.documentUrl === call.documentUrl && ['error', 'unhandledrejection'].includes(event.kind));
    if (network.engine === 'webkit' && /access control checks/i.test(text) && ownedStack(error.stack) && call && !documentNative.length) {
      const requests = network.requests.filter(request => request.url === call.url && Math.abs(request.at - call.wall) <= 100);
      handledNetwork.push({ raw: error, fetchCall: call, callCorrelationMs: Math.abs(call.wall - error.at), requests,
        networkObservation: requests.length ? 'network-event-recorded' : 'pre-network/no-event',
        cause: 'UNATTRIBUTED', consumer: knownClockCall(call).consumer,
        classification: 'Known handled clock fetch; exact URL and owned caller, raw owned stack, initiation within100ms, native document ErrorEvent/unhandledrejection0. Raw WebKit reporter entry retained; no claim of a production CORS defect or live API success.' });
    } else {
      unknown.push(error);
    }
  }
  entry.pageErrorAttribution = { nativeErrorEvents: nativeErrors.length, nativeUnhandledRejections: unhandled.length,
    handledNetwork, unknown, fetchInitiationCorrelationWindowMs: 100 };
  // All native errors, including other documents and late events, still fail the overall scenario.
  entry.unclassifiedErrors = [...unknown.map(error => error.message), ...nativeErrors.map(error => error.message), ...unhandled.map(error => error.message)];
}
