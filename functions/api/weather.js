import {
  applyCorsResponseHeaders,
  enforceRateLimit,
  getPublicReadCorsOrigin,
  jsonResponse,
} from '../_lib/http-security.js';

const BRIGHT_SKY_CURRENT_ENDPOINT = 'https://api.brightsky.dev/current_weather';
const MET_LOCATIONFORECAST_ENDPOINT = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';
const PHOTON_SEARCH_ENDPOINT = 'https://photon.komoot.io/api/';
const NOMINATIM_SEARCH_ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const WEATHER_CACHE_TTL_SECONDS = 5 * 60;
const CLIENT_CACHE_TTL_SECONDS = 60;
const PROVIDER_TIMEOUT_MS = 8500;
const DEFAULT_TIME_ZONE = 'Europe/Berlin';
const PROVIDER_USER_AGENT =
  'HundesalonNikaWeather/1.0 (+https://hundesalon-nika.com/kontakty.html)';

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(Number(value || 0) * factor) / factor;
}

function celsiusToFahrenheit(value) {
  return round(Number(value || 0) * (9 / 5) + 32);
}

function kilometresToMiles(value) {
  return round(Number(value || 0) * 0.621371);
}

function millimetresToInches(value) {
  return round(Number(value || 0) * 0.0393701);
}

function hpaToInches(value) {
  return round(Number(value || 0) * 0.0295299830714);
}

function windDirectionLabel(value) {
  const normalized = ((Number(value || 0) % 360) + 360) % 360;
  const labels = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return labels[Math.round(normalized / 22.5) % labels.length];
}

export function parseWeatherCoordinates(latitudeValue, longitudeValue) {
  const latitude = finiteNumber(latitudeValue);
  const longitude = finiteNumber(longitudeValue);
  if (
    latitude === null ||
    longitude === null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }
  return { latitude, longitude };
}

export function parseWeatherLocation(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) {
    return null;
  }
  return parseWeatherCoordinates(match[1], match[2]);
}

function normalizeLanguage(value) {
  const language = String(value || '')
    .trim()
    .toLowerCase()
    .split(/[-_]/)[0];
  return ['de', 'en', 'ru', 'uk'].includes(language) ? language : 'de';
}

function normalizeTimeZone(value) {
  const candidate = String(value || '').trim();
  if (!candidate || candidate.length > 80) {
    return DEFAULT_TIME_ZONE;
  }
  try {
    new Intl.DateTimeFormat('en', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': PROVIDER_USER_AGENT,
        ...(options.headers || {}),
      },
    });
    if (!response.ok) {
      throw new Error(`Provider returned ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

function firstText(...values) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) {
      return text;
    }
  }
  return '';
}

function normalizePhotonLocation(feature) {
  const properties = feature?.properties || {};
  const coordinates = feature?.geometry?.coordinates || [];
  const parsed = parseWeatherCoordinates(coordinates[1], coordinates[0]);
  if (!parsed) {
    return null;
  }
  return {
    ...parsed,
    name: firstText(properties.name, properties.city, properties.district, properties.county),
    region: firstText(properties.state, properties.county),
    country: firstText(properties.country),
    countryCode: String(properties.countrycode || '').toUpperCase(),
  };
}

function normalizeNominatimLocation(result) {
  const parsed = parseWeatherCoordinates(result?.lat, result?.lon);
  if (!parsed) {
    return null;
  }
  const address = result?.address || {};
  return {
    ...parsed,
    name: firstText(
      address.city,
      address.town,
      address.village,
      address.municipality,
      result?.name,
      result?.display_name
    ),
    region: firstText(address.state, address.region, address.county),
    country: firstText(address.country),
    countryCode: String(address.country_code || '').toUpperCase(),
  };
}

async function resolveNamedLocation(query, language) {
  const photonUrl = new URL(PHOTON_SEARCH_ENDPOINT);
  photonUrl.searchParams.set('q', query);
  photonUrl.searchParams.set('limit', '1');
  photonUrl.searchParams.set('lang', language);

  try {
    const photonPayload = await fetchJson(photonUrl);
    const location = normalizePhotonLocation(photonPayload?.features?.[0]);
    if (location) {
      return location;
    }
  } catch {
    // Continue with Nominatim when Photon is unavailable.
  }

  const nominatimUrl = new URL(NOMINATIM_SEARCH_ENDPOINT);
  nominatimUrl.searchParams.set('q', query);
  nominatimUrl.searchParams.set('format', 'jsonv2');
  nominatimUrl.searchParams.set('addressdetails', '1');
  nominatimUrl.searchParams.set('limit', '1');
  nominatimUrl.searchParams.set('accept-language', language);
  const nominatimPayload = await fetchJson(nominatimUrl, {
    headers: { Referer: 'https://hundesalon-nika.com/' },
  });
  return normalizeNominatimLocation(nominatimPayload?.[0]);
}

export function calculateApparentTemperature(temperatureValue, humidityValue, windSpeedKphValue) {
  const temperature = finiteNumber(temperatureValue);
  const humidity = finiteNumber(humidityValue);
  const windSpeedKph = finiteNumber(windSpeedKphValue);
  if (temperature === null) {
    return null;
  }
  if (humidity === null || windSpeedKph === null) {
    return round(temperature);
  }

  const windSpeedMs = Math.max(0, windSpeedKph / 3.6);
  const vapourPressure =
    (humidity / 100) * 6.105 * Math.exp((17.27 * temperature) / (237.7 + temperature));
  return round(temperature + 0.33 * vapourPressure - 0.7 * windSpeedMs - 4);
}

function isDayFromToken(value, fallback = 1) {
  const token = String(value || '').toLowerCase();
  if (token.includes('night')) return 0;
  if (token.includes('day')) return 1;
  return fallback;
}

export function weatherCodeFromBrightSky(iconValue, cloudCoverValue) {
  const icon = String(iconValue || '').toLowerCase();
  if (icon.includes('thunder')) return 95;
  if (icon.includes('hail')) return 96;
  if (icon.includes('snow')) return 73;
  if (icon.includes('sleet')) return 67;
  if (icon.includes('rain')) return 63;
  if (icon.includes('fog')) return 45;
  if (icon.includes('partly-cloudy')) return 2;
  if (icon.includes('cloudy')) return 3;
  if (icon.includes('clear')) return 0;

  const cloudCover = finiteNumber(cloudCoverValue);
  if (cloudCover !== null) {
    if (cloudCover >= 85) return 3;
    if (cloudCover >= 35) return 2;
    if (cloudCover >= 12) return 1;
  }
  return 0;
}

export function weatherCodeFromMetSymbol(symbolValue, cloudCoverValue) {
  const symbol = String(symbolValue || '').toLowerCase();
  if (symbol.includes('thunder')) return 95;
  if (symbol.includes('snow')) return symbol.includes('showers') ? 85 : 73;
  if (symbol.includes('sleet')) return symbol.includes('showers') ? 81 : 67;
  if (symbol.includes('rain')) {
    if (symbol.includes('showers')) return 80;
    if (symbol.includes('heavy')) return 65;
    if (symbol.includes('light')) return 61;
    return 63;
  }
  if (symbol.includes('fog')) return 45;
  if (symbol.includes('partlycloudy')) return 2;
  if (symbol.includes('cloudy')) return 3;
  if (symbol.includes('fair')) return 1;
  if (symbol.includes('clearsky')) return 0;
  return weatherCodeFromBrightSky('', cloudCoverValue);
}

function weatherApiCondition(weatherCode, isDay = 1) {
  const code = Number(weatherCode);
  const iconDay = Number(isDay) === 1 ? 'day' : 'night';
  let text = 'Cloudy';
  let apiCode = 1006;
  let iconCode = 119;

  if (code <= 1) {
    text = code === 0 ? 'Clear sky' : 'Mainly clear';
    apiCode = 1000;
    iconCode = 113;
  } else if (code === 2) {
    text = 'Partly cloudy';
    apiCode = 1003;
    iconCode = 116;
  } else if (code === 3) {
    text = 'Overcast';
    apiCode = 1009;
    iconCode = 122;
  } else if ([45, 48].includes(code)) {
    text = 'Fog';
    apiCode = 1030;
    iconCode = 248;
  } else if ([51, 53, 55, 56, 57].includes(code)) {
    text = 'Drizzle';
    apiCode = 1153;
    iconCode = 296;
  } else if ([61, 63, 65, 66, 67].includes(code)) {
    text = 'Rain';
    apiCode = 1183;
    iconCode = 308;
  } else if ([80, 81, 82].includes(code)) {
    text = 'Rain showers';
    apiCode = 1240;
    iconCode = 353;
  } else if ([71, 73, 75, 77, 85, 86].includes(code)) {
    text = 'Snow';
    apiCode = 1210;
    iconCode = 338;
  } else if ([95, 96, 99].includes(code)) {
    text = 'Thunderstorm';
    apiCode = 1273;
    iconCode = 389;
  }

  return {
    text,
    code: apiCode,
    icon: `//cdn.weatherapi.com/weather/64x64/${iconDay}/${iconCode}.png`,
  };
}

function nearestBrightSkySource(payload, sourceId) {
  const sources = Array.isArray(payload?.sources) ? payload.sources : [];
  return sources.find(source => Number(source?.id) === Number(sourceId)) || sources[0] || null;
}

export function normalizeBrightSkyCurrent(payload, coordinates, timeZone, nowMs = Date.now()) {
  const current = payload?.weather;
  const temperature = finiteNumber(current?.temperature);
  if (!current || temperature === null) {
    return null;
  }

  const humidity = finiteNumber(current.relative_humidity);
  const cloudCover = finiteNumber(current.cloud_cover);
  const windSpeedKph =
    finiteNumber(current.wind_speed_10) ??
    finiteNumber(current.wind_speed_30) ??
    finiteNumber(current.wind_speed_60);
  const windDirection =
    finiteNumber(current.wind_direction_10) ??
    finiteNumber(current.wind_direction_30) ??
    finiteNumber(current.wind_direction_60);
  const gustKph =
    finiteNumber(current.wind_gust_speed_10) ??
    finiteNumber(current.wind_gust_speed_30) ??
    finiteNumber(current.wind_gust_speed_60);
  const pressureMsl = finiteNumber(current.pressure_msl);
  const weatherCode = weatherCodeFromBrightSky(current.icon, cloudCover);
  const station = nearestBrightSkySource(payload, current.source_id);

  return {
    source: 'dwd-bright-sky',
    providerLabel: 'DWD via Bright Sky',
    attributionUrl: 'https://brightsky.dev/',
    time: typeof current.timestamp === 'string' ? current.timestamp : new Date(nowMs).toISOString(),
    fetchedAt: nowMs,
    timezone: timeZone,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    weatherCode,
    cloudCover,
    precipitation:
      finiteNumber(current.precipitation_10) ??
      finiteNumber(current.precipitation_30) ??
      finiteNumber(current.precipitation_60),
    humidity,
    temperature,
    apparentTemperature: calculateApparentTemperature(temperature, humidity, windSpeedKph),
    isDay: isDayFromToken(current.icon),
    pressureMsl,
    surfacePressure: null,
    pressureMmHg: pressureMsl === null ? null : Math.round(pressureMsl * 0.750061683),
    windSpeedKph,
    windDirection,
    gustKph,
    visibilityMeters: finiteNumber(current.visibility),
    stationName: firstText(station?.station_name),
    stationDistanceMeters: finiteNumber(station?.distance),
  };
}

function getMetTimeseries(payload) {
  return Array.isArray(payload?.properties?.timeseries) ? payload.properties.timeseries : [];
}

function getMetSymbol(entry) {
  return firstText(
    entry?.data?.next_1_hours?.summary?.symbol_code,
    entry?.data?.next_6_hours?.summary?.symbol_code,
    entry?.data?.next_12_hours?.summary?.symbol_code
  );
}

export function normalizeMetCurrent(payload, coordinates, timeZone, nowMs = Date.now()) {
  const entry = getMetTimeseries(payload)[0];
  const details = entry?.data?.instant?.details || {};
  const temperature = finiteNumber(details.air_temperature);
  if (!entry || temperature === null) {
    return null;
  }

  const humidity = finiteNumber(details.relative_humidity);
  const cloudCover = finiteNumber(details.cloud_area_fraction);
  const windSpeedMs = finiteNumber(details.wind_speed);
  const windSpeedKph = windSpeedMs === null ? null : windSpeedMs * 3.6;
  const pressureMsl = finiteNumber(details.air_pressure_at_sea_level);
  const symbol = getMetSymbol(entry);

  return {
    source: 'met-norway-locationforecast',
    providerLabel: 'MET Norway',
    attributionUrl: 'https://api.met.no/weatherapi/locationforecast/2.0/documentation',
    time: typeof entry.time === 'string' ? entry.time : new Date(nowMs).toISOString(),
    fetchedAt: nowMs,
    timezone: timeZone,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    weatherCode: weatherCodeFromMetSymbol(symbol, cloudCover),
    cloudCover,
    precipitation: finiteNumber(entry?.data?.next_1_hours?.details?.precipitation_amount),
    humidity,
    temperature,
    apparentTemperature: calculateApparentTemperature(temperature, humidity, windSpeedKph),
    isDay: isDayFromToken(symbol),
    pressureMsl,
    surfacePressure: null,
    pressureMmHg: pressureMsl === null ? null : Math.round(pressureMsl * 0.750061683),
    windSpeedKph,
    windDirection: finiteNumber(details.wind_from_direction),
    gustKph:
      finiteNumber(details.wind_speed_of_gust) === null
        ? windSpeedKph
        : finiteNumber(details.wind_speed_of_gust) * 3.6,
    visibilityMeters: null,
    stationName: '',
    stationDistanceMeters: null,
  };
}

function formatDateParts(timestamp, timeZone) {
  const date = new Date(timestamp);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    dateTime: `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`,
  };
}

function conditionSeverity(weatherCode) {
  if ([95, 96, 99].includes(weatherCode)) return 9;
  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) return 8;
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode)) return 7;
  if ([51, 53, 55, 56, 57].includes(weatherCode)) return 6;
  if ([45, 48].includes(weatherCode)) return 5;
  if (weatherCode === 3) return 4;
  if (weatherCode === 2) return 3;
  if (weatherCode === 1) return 2;
  return 1;
}

function buildMetForecastDays(payload, timeZone, currentMeta) {
  const groups = new Map();
  const oldestAllowed = Date.now() - 60 * 60 * 1000;

  for (const entry of getMetTimeseries(payload)) {
    const timestamp = Date.parse(entry?.time || '');
    if (!Number.isFinite(timestamp) || timestamp < oldestAllowed) {
      continue;
    }
    const { date } = formatDateParts(timestamp, timeZone);
    if (!groups.has(date)) {
      groups.set(date, []);
    }
    groups.get(date).push(entry);
  }

  const forecastDays = [];
  for (const [date, entries] of groups) {
    if (forecastDays.length >= 3) break;

    const temperatures = [];
    const humidities = [];
    const visibilities = [];
    const windSpeeds = [];
    const precipitation = [];
    let representativeCode = 0;
    let representativeSeverity = 0;

    for (const entry of entries) {
      const details = entry?.data?.instant?.details || {};
      const temperature = finiteNumber(details.air_temperature);
      const humidity = finiteNumber(details.relative_humidity);
      const windSpeed = finiteNumber(details.wind_speed);
      const cloudCover = finiteNumber(details.cloud_area_fraction);
      const rain = finiteNumber(entry?.data?.next_1_hours?.details?.precipitation_amount);
      const code = weatherCodeFromMetSymbol(getMetSymbol(entry), cloudCover);
      const severity = conditionSeverity(code);

      if (temperature !== null) temperatures.push(temperature);
      if (humidity !== null) humidities.push(humidity);
      if (windSpeed !== null) windSpeeds.push(windSpeed * 3.6);
      if (rain !== null) precipitation.push(rain);
      if (currentMeta?.visibilityMeters !== null && Number.isFinite(currentMeta?.visibilityMeters)) {
        visibilities.push(currentMeta.visibilityMeters / 1000);
      }
      if (severity > representativeSeverity) {
        representativeSeverity = severity;
        representativeCode = code;
      }
    }

    if (!temperatures.length) {
      continue;
    }

    const maximum = values => Math.max(...values);
    const minimum = values => Math.min(...values);
    const average = values => values.reduce((sum, value) => sum + value, 0) / values.length;
    const averageTemperature = average(temperatures);
    const totalPrecipitation = precipitation.reduce((sum, value) => sum + value, 0);
    const maxWindKph = windSpeeds.length ? maximum(windSpeeds) : 0;
    const averageVisibility = visibilities.length ? average(visibilities) : 0;
    const averageHumidity = humidities.length ? average(humidities) : 0;

    forecastDays.push({
      date,
      date_epoch: Math.floor(Date.parse(`${date}T12:00:00Z`) / 1000),
      day: {
        maxtemp_c: round(maximum(temperatures)),
        maxtemp_f: celsiusToFahrenheit(maximum(temperatures)),
        mintemp_c: round(minimum(temperatures)),
        mintemp_f: celsiusToFahrenheit(minimum(temperatures)),
        avgtemp_c: round(averageTemperature),
        avgtemp_f: celsiusToFahrenheit(averageTemperature),
        maxwind_mph: kilometresToMiles(maxWindKph),
        maxwind_kph: round(maxWindKph),
        totalprecip_mm: round(totalPrecipitation),
        totalprecip_in: millimetresToInches(totalPrecipitation),
        totalsnow_cm: 0,
        avgvis_km: round(averageVisibility),
        avgvis_miles: kilometresToMiles(averageVisibility),
        avghumidity: Math.round(averageHumidity),
        daily_will_it_rain: totalPrecipitation > 0 ? 1 : 0,
        daily_chance_of_rain: totalPrecipitation > 0 ? 100 : 0,
        daily_will_it_snow: [71, 73, 75, 77, 85, 86].includes(representativeCode) ? 1 : 0,
        daily_chance_of_snow: [71, 73, 75, 77, 85, 86].includes(representativeCode) ? 100 : 0,
        condition: weatherApiCondition(representativeCode, 1),
        uv: 0,
      },
    });
  }

  return forecastDays;
}

function currentMetaToWeatherApi(meta) {
  const temperature = finiteNumber(meta.temperature) ?? 0;
  const apparentTemperature = finiteNumber(meta.apparentTemperature) ?? temperature;
  const windSpeedKph = finiteNumber(meta.windSpeedKph) ?? 0;
  const gustKph = finiteNumber(meta.gustKph) ?? windSpeedKph;
  const visibilityKm = (finiteNumber(meta.visibilityMeters) ?? 0) / 1000;
  const pressureMsl = finiteNumber(meta.pressureMsl) ?? 0;
  const precipitation = finiteNumber(meta.precipitation) ?? 0;
  const observedAt = Date.parse(meta.time || '') || Date.now();

  return {
    last_updated_epoch: Math.floor(observedAt / 1000),
    last_updated: formatDateParts(observedAt, meta.timezone).dateTime,
    temp_c: round(temperature),
    temp_f: celsiusToFahrenheit(temperature),
    is_day: Number(meta.isDay) === 0 ? 0 : 1,
    condition: weatherApiCondition(meta.weatherCode, meta.isDay),
    wind_mph: kilometresToMiles(windSpeedKph),
    wind_kph: round(windSpeedKph),
    wind_degree: Math.round(finiteNumber(meta.windDirection) ?? 0),
    wind_dir: windDirectionLabel(meta.windDirection),
    pressure_mb: round(pressureMsl),
    pressure_in: hpaToInches(pressureMsl),
    precip_mm: round(precipitation),
    precip_in: millimetresToInches(precipitation),
    humidity: Math.round(finiteNumber(meta.humidity) ?? 0),
    cloud: Math.round(finiteNumber(meta.cloudCover) ?? 0),
    feelslike_c: round(apparentTemperature),
    feelslike_f: celsiusToFahrenheit(apparentTemperature),
    vis_km: round(visibilityKm),
    vis_miles: kilometresToMiles(visibilityKm),
    uv: 0,
    gust_mph: kilometresToMiles(gustKph),
    gust_kph: round(gustKph),
  };
}

function buildWeatherPayload(location, currentMeta, metPayload, timeZone) {
  const now = Date.now();
  const local = formatDateParts(now, timeZone);
  const forecastDays = metPayload ? buildMetForecastDays(metPayload, timeZone, currentMeta) : [];
  if (!forecastDays.length) {
    const current = currentMetaToWeatherApi(currentMeta);
    forecastDays.push({
      date: local.date,
      date_epoch: Math.floor(Date.parse(`${local.date}T12:00:00Z`) / 1000),
      day: {
        maxtemp_c: current.temp_c,
        maxtemp_f: current.temp_f,
        mintemp_c: current.temp_c,
        mintemp_f: current.temp_f,
        avgtemp_c: current.temp_c,
        avgtemp_f: current.temp_f,
        maxwind_mph: current.wind_mph,
        maxwind_kph: current.wind_kph,
        totalprecip_mm: current.precip_mm,
        totalprecip_in: current.precip_in,
        totalsnow_cm: 0,
        avgvis_km: current.vis_km,
        avgvis_miles: current.vis_miles,
        avghumidity: current.humidity,
        daily_will_it_rain: current.precip_mm > 0 ? 1 : 0,
        daily_chance_of_rain: current.precip_mm > 0 ? 100 : 0,
        daily_will_it_snow: 0,
        daily_chance_of_snow: 0,
        condition: current.condition,
        uv: 0,
      },
    });
  }

  return {
    location: {
      name: location.name || `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`,
      region: location.region || '',
      country: location.country || '',
      country_code: location.countryCode || '',
      lat: location.latitude,
      lon: location.longitude,
      tz_id: timeZone,
      localtime_epoch: Math.floor(now / 1000),
      localtime: local.dateTime,
    },
    current: currentMetaToWeatherApi(currentMeta),
    forecast: { forecastday: forecastDays },
    weatherMeta: {
      ...currentMeta,
      forecastProviderLabel: metPayload ? 'MET Norway' : currentMeta.providerLabel,
      forecastAttributionUrl: metPayload
        ? 'https://api.met.no/weatherapi/locationforecast/2.0/documentation'
        : currentMeta.attributionUrl,
    },
    provider: {
      current: currentMeta.providerLabel,
      forecast: metPayload ? 'MET Norway' : currentMeta.providerLabel,
      attributionUrl: currentMeta.attributionUrl,
    },
    cached: false,
  };
}

async function fetchBrightSkyCurrent(coordinates, timeZone) {
  const url = new URL(BRIGHT_SKY_CURRENT_ENDPOINT);
  url.searchParams.set('lat', coordinates.latitude.toFixed(5));
  url.searchParams.set('lon', coordinates.longitude.toFixed(5));
  url.searchParams.set('tz', timeZone);
  url.searchParams.set('units', 'dwd');
  url.searchParams.set('max_dist', '50000');
  return fetchJson(url);
}

async function fetchMetForecast(coordinates) {
  const url = new URL(MET_LOCATIONFORECAST_ENDPOINT);
  url.searchParams.set('lat', coordinates.latitude.toFixed(4));
  url.searchParams.set('lon', coordinates.longitude.toFixed(4));
  return fetchJson(url);
}

function apiResponse(payload, { status = 200, cacheStatus = 'MISS', method = 'GET' } = {}) {
  return new Response(method === 'HEAD' ? null : JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `private, max-age=${CLIENT_CACHE_TTL_SECONDS}, stale-while-revalidate=240`,
      'X-Content-Type-Options': 'nosniff',
      'X-Weather-Cache': cacheStatus,
      Vary: 'Accept-Language',
    },
  });
}

function getDefaultCache() {
  return typeof caches !== 'undefined' ? caches.default : null;
}

async function readCachedPayload(cache, cacheKey) {
  if (!cache) return null;
  const response = await cache.match(cacheKey);
  if (!response) return null;
  return response.json().catch(() => null);
}

function storeCachedPayload(context, cache, cacheKey, payload) {
  if (!cache) return;
  const cacheResponse = new Response(JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `max-age=${WEATHER_CACHE_TTL_SECONDS}`,
    },
  });
  const operation = cache.put(cacheKey, cacheResponse);
  if (typeof context.waitUntil === 'function') {
    context.waitUntil(operation);
  }
}

export async function onRequest(context) {
  const { request } = context;
  const corsOrigin = getPublicReadCorsOrigin(request);
  const respond = response => applyCorsResponseHeaders(response, corsOrigin);

  if (!['GET', 'HEAD'].includes(request.method)) {
    return respond(jsonResponse({ error: 'Method not allowed' }, 405));
  }

  const url = new URL(request.url);
  const language = normalizeLanguage(
    url.searchParams.get('lang') || request.headers.get('Accept-Language')
  );
  const timeZone = normalizeTimeZone(url.searchParams.get('timezone'));
  let location = parseWeatherCoordinates(
    url.searchParams.get('latitude'),
    url.searchParams.get('longitude')
  );

  if (!location) {
    const locationQuery = String(url.searchParams.get('location') || '').trim();
    location = parseWeatherLocation(locationQuery);
    if (!location && locationQuery && locationQuery.length <= 160) {
      location = await resolveNamedLocation(locationQuery, language).catch(() => null);
    }
  }

  if (!location) {
    return respond(jsonResponse({ error: 'Valid coordinates or location are required' }, 400));
  }

  const cache = getDefaultCache();
  const cacheKey = new Request(
    `https://weather-cache.hundesalon-nika.internal/v2/${location.latitude.toFixed(4)}/${location.longitude.toFixed(4)}/${encodeURIComponent(timeZone)}/${language}`
  );
  const cachedPayload = await readCachedPayload(cache, cacheKey);
  if (cachedPayload) {
    cachedPayload.cached = true;
    return respond(apiResponse(cachedPayload, { cacheStatus: 'HIT', method: request.method }));
  }

  const rateLimitResponse = await enforceRateLimit(request, {
    route: 'weather-current',
    limit: 24,
    windowSec: 60,
  });
  if (rateLimitResponse) {
    return respond(rateLimitResponse);
  }

  const [brightSkyResult, metResult] = await Promise.allSettled([
    fetchBrightSkyCurrent(location, timeZone),
    fetchMetForecast(location),
  ]);
  const brightSkyPayload = brightSkyResult.status === 'fulfilled' ? brightSkyResult.value : null;
  const metPayload = metResult.status === 'fulfilled' ? metResult.value : null;
  const nowMs = Date.now();
  const currentMeta =
    normalizeBrightSkyCurrent(brightSkyPayload, location, timeZone, nowMs) ||
    normalizeMetCurrent(metPayload, location, timeZone, nowMs);

  if (!currentMeta) {
    return respond(jsonResponse({ error: 'Weather providers are temporarily unavailable' }, 502));
  }

  const payload = buildWeatherPayload(location, currentMeta, metPayload, timeZone);
  storeCachedPayload(context, cache, cacheKey, payload);
  return respond(apiResponse(payload, { method: request.method }));
}
