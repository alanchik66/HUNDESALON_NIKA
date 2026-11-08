/** Local lunar lighting for the existing UTC/topocentric Moon position.
 * Orbit: weather-solar-time.js; solar ellipse: https://stjarnhimlen.se/comp/ppcomp.html
 * Body frame: IAU_MOON mean-Earth/polar-axis trigonometric approximation, not
 * the high-precision DE441 libration integration used by JPL Horizons:
 * https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc
 * UTC approximates UT1; TT is UTC+69.184 s (current offset, frozen for future
 * dates). IAU1976 precession joins J2000 body axes to the orbit's mean-of-date
 * frame. Nutation/aberration, eclipses, terrain and atmospheric refraction are
 * not modeled here. Reference samples span2000–2050, without a uniform
 * precision-ephemeris error guarantee.
 */
const { moonPosition } = await import(new URL(`./weather-solar-time.js${new URL(import.meta.url).search}`, import.meta.url).href);

const RAD = Math.PI / 180, DEG = 180 / Math.PI, DAY = 86400000;
const AU_KM = 149597870.7, EARTH_KM = 6378.137;
// NASA NSSDCA volumetric mean radii (km), checked2026-11-07:
// https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html
// https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html
const MOON_RADIUS_KM = 1737.4, SUN_RADIUS_KM = 695700;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const scale = (a, k) => a.map(value => value * k);
const add = (a, b) => a.map((value, i) => value + b[i]);
const unit = a => scale(a, 1 / Math.hypot(...a));
const clamp = value => Math.max(-1, Math.min(1, value));
const wrap = value => (value % 360 + 360) % 360;
const vector = a => ({ x: a[0], y: a[1], z: a[2] });
const angle = (a, east, north) => wrap(Math.atan2(dot(a, east), dot(a, north)) * DEG);

function precessToDate(v, centuries) {
  const t = centuries, arcsec = RAD / 3600;
  const zeta = (2306.2181 * t + .30188 * t * t + .017998 * t ** 3) * arcsec;
  const z = (2306.2181 * t + 1.09468 * t * t + .018203 * t ** 3) * arcsec;
  const theta = (2004.3109 * t - .42665 * t * t - .041833 * t ** 3) * arcsec;
  const x = Math.cos(zeta) * v[0] - Math.sin(zeta) * v[1];
  const y = Math.sin(zeta) * v[0] + Math.cos(zeta) * v[1];
  const b = Math.cos(theta) * x - Math.sin(theta) * v[2];
  return [Math.cos(z) * b - Math.sin(z) * y, Math.sin(z) * b + Math.cos(z) * y,
    Math.sin(theta) * x + Math.cos(theta) * v[2]];
}

function lunarBodyAxes(timeMs, distanceKm) {
  // Evaluate lunar orientation at emission, about1.3s before reception.
  const d = (timeMs + 69184 - distanceKm / 299792.458 * 1000) / DAY + 2440587.5 - 2451545;
  const t = d / 36525;
  const phases = [[125.045, -.0529921], [250.089, -.1059842], [260.008, 13.0120009],
    [176.625, 13.3407154], [357.529, .9856003], [311.589, 26.4057084], [134.963, 13.0649930],
    [276.617, .3287146], [34.226, 1.7484877], [15.134, -.1589763], [119.743, .0036096],
    [239.961, .1643573], [25.053, 12.9590088]].map(([base, rate]) => wrap(base + rate * d) * RAD);
  const sum = (coefficients, trig) => coefficients.reduce((value, coefficient, i) => value + coefficient * trig(phases[i]), 0);
  const ra = (269.9949 + .0031 * t + sum([-3.8787, -.1204, .0700, -.0172, 0, .0072, 0, 0, 0, -.0052, 0, 0, .0043], Math.sin)) * RAD;
  const dec = (66.5392 + .0130 * t + sum([1.5419, .0239, -.0278, .0068, 0, -.0029, .0009, 0, 0, .0008, 0, 0, -.0009], Math.cos)) * RAD;
  const w = wrap(38.3213 + 13.17635815 * d - 1.4e-12 * d * d
    + sum([3.5610, .1208, -.0642, .0158, .0252, -.0066, -.0047, -.0046, .0028, .0052, .0040, .0019, -.0044], Math.sin)) * RAD;
  const pole = [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
  const node = [-Math.sin(ra), Math.cos(ra), 0], meridian = cross(pole, node);
  return [add(scale(node, Math.cos(w)), scale(meridian, Math.sin(w))),
    add(scale(node, -Math.sin(w)), scale(meridian, Math.cos(w))), pole];
}

/** Body axes x=0°E/0°N, y=90°E/0°N, z=lunar north; longitude is east-positive.
 * bodyToView contains the THREE COLUMNS of that proper rotation.
 * View +x=screen right,+y=up,+z=toward the observer. Its up is the projection
 * of the observer's geodetic zenith, not an artificially repositioned UI Sun.
 * At the exact zenith/nadir that up is undefined: celestial north is the
 * deterministic fallback, reported by orientationMode.
 * earthshine is only a normalized Earth-illumination DRIVER (0..1), not
 * measured lunar radiance. The renderer chooses its small ambient strength.
 */
export function lunarLighting(timeMs, latitude, longitude) {
  const moon = moonPosition(timeMs, latitude, longitude);
  if (!Number.isFinite(moon.distanceKm)) return { valid: false };
  const days = timeMs / DAY + 2440587.5 - 2451543.5;
  const jd2000 = timeMs / DAY + 2440587.5 - 2451545, t = jd2000 / 36525;
  const sidereal = wrap(280.46061837 + 360.98564736629 * jd2000 + .000387933 * t * t - t ** 3 / 38710000 + longitude) * RAD;
  const phi = latitude * RAD, sinPhi = Math.sin(phi), cosPhi = Math.cos(phi);
  const east = [-Math.sin(sidereal), Math.cos(sidereal), 0];
  const north = [-sinPhi * Math.cos(sidereal), -sinPhi * Math.sin(sidereal), cosPhi];
  const zenith = [cosPhi * Math.cos(sidereal), cosPhi * Math.sin(sidereal), sinPhi];
  const enu = v => [dot(v, east), dot(v, north), dot(v, zenith)];
  const equatorial = v => add(add(scale(east, v[0]), scale(north, v[1])), scale(zenith, v[2]));
  const flattening = 1 / 298.257223563, e2 = flattening * (2 - flattening);
  const n = EARTH_KM / Math.sqrt(1 - e2 * sinPhi * sinPhi);
  const observer = enu([n * cosPhi * Math.cos(sidereal), n * cosPhi * Math.sin(sidereal), n * (1 - e2) * sinPhi]);
  const elevation = moon.elevationDeg * RAD, azimuth = moon.azimuthDeg * RAD;
  const moonDirection = [Math.cos(elevation) * Math.sin(azimuth), Math.cos(elevation) * Math.cos(azimuth), Math.sin(elevation)];
  const moonVector = scale(moonDirection, moon.distanceKm);

  // The existing lunar orbit uses this smooth solar ellipse internally. Using
  // the same ellipse avoids a calendar-year boundary in the lunar phase.
  const anomaly = wrap(356.0470 + .9856002585 * days) * RAD, eccentricity = .016709 - 1.151e-9 * days;
  let eccentricAnomaly = anomaly + eccentricity * Math.sin(anomaly) * (1 + eccentricity * Math.cos(anomaly));
  for (let i = 0; i < 4; i++) eccentricAnomaly -= (eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly) - anomaly) / (1 - eccentricity * Math.cos(eccentricAnomaly));
  const sx = Math.cos(eccentricAnomaly) - eccentricity, sy = Math.sqrt(1 - eccentricity * eccentricity) * Math.sin(eccentricAnomaly);
  const sunLongitude = Math.atan2(sy, sx) + wrap(282.9404 + .0000470935 * days) * RAD;
  const radius = Math.hypot(sx, sy) * AU_KM, obliquity = (23.4393 - .0000003563 * days) * RAD;
  const sun = enu([radius * Math.cos(sunLongitude), radius * Math.sin(sunLongitude) * Math.cos(obliquity), radius * Math.sin(sunLongitude) * Math.sin(obliquity)]);
  const observerSun = add(sun, scale(observer, -1));
  const moonDistanceKm = moon.distanceKm, sunDistanceKm = Math.hypot(...observerSun);
  const moonAngularDiameterDeg = 2 * Math.asin(MOON_RADIUS_KM / moonDistanceKm) * DEG;
  const sunAngularDiameterDeg = 2 * Math.asin(SUN_RADIUS_KM / sunDistanceKm) * DEG;
  const light = unit(add(observerSun, scale(moonVector, -1)));
  const viewZ = scale(moonDirection, -1), vertical = add([0, 0, 1], scale(viewZ, -viewZ[2]));
  const celestialPole = enu([0, 0, 1]);
  const celestialNorth = unit(add(celestialPole, scale(viewZ, -dot(celestialPole, viewZ))));
  const celestialEast = cross(viewZ, celestialNorth);
  const localUp = Math.hypot(...vertical) > 1e-8;
  const viewY = localUp ? unit(vertical) : celestialNorth, viewX = cross(viewY, viewZ);
  // Differentiate the zenith stereographic chart q=(-E,-N)/(1+U) along viewY;
  // CSS roll maps local portrait-up to that tangent, including at the zenith.
  // https://proj.org/en/stable/operations/projections/stere.html
  const denominator = 1 + moonDirection[2];
  const domeUpX = -(viewY[0] * denominator - moonDirection[0] * viewY[2]);
  const domeUpY = -(viewY[1] * denominator - moonDirection[1] * viewY[2]);
  // Below the horizon only the display marker is clamped; physical lighting stays unchanged.
  const skyDomeRollRad = moon.elevationDeg < 0 ? Math.PI - azimuth : Math.atan2(domeUpX, -domeUpY);
  const view = v => [dot(v, viewX), dot(v, viewY), dot(v, viewZ)];
  const bodyAxes = lunarBodyAxes(timeMs, moon.distanceKm).map(v => enu(precessToDate(v, t)));
  const toBody = v => bodyAxes.map(axis => dot(axis, v));
  const observerBody = toBody(viewZ), sunBody = toBody(light);
  const lightView = view(light), northView = view(bodyAxes[2]);
  const phaseAngle = Math.acos(clamp(dot(light, viewZ))), fraction = (1 + Math.cos(phaseAngle)) / 2;
  const geocentricMoon = equatorial(add(moonVector, observer));
  const moonLongitude = Math.atan2(geocentricMoon[1] * Math.cos(obliquity) + geocentricMoon[2] * Math.sin(obliquity), geocentricMoon[0]);
  return {
    valid: true, timeMs,
    moonDistanceKm, sunDistanceKm, moonAngularDiameterDeg, sunAngularDiameterDeg,
    apparentDiameterRatio: moonAngularDiameterDeg / sunAngularDiameterDeg,
    illuminatedFraction: fraction, phaseAngleDeg: phaseAngle * DEG,
    waxing: wrap((moonLongitude - sunLongitude) * DEG) < 180,
    lightDirection: vector(lightView), northDirection: vector(northView),
    bodyToView: { x: vector(view(bodyAxes[0])), y: vector(view(bodyAxes[1])), z: vector(northView) },
    observerDirectionBody: vector(observerBody), sunDirectionBody: vector(sunBody),
    librationLongitudeDeg: Math.atan2(observerBody[1], observerBody[0]) * DEG,
    librationLatitudeDeg: Math.asin(clamp(observerBody[2])) * DEG,
    subsolarLongitudeDeg: Math.atan2(sunBody[1], sunBody[0]) * DEG,
    subsolarLatitudeDeg: Math.asin(clamp(sunBody[2])) * DEG,
    brightLimbAngleDeg: wrap(Math.atan2(lightView[0], lightView[1]) * DEG),
    brightLimbPositionAngleDeg: angle(light, celestialEast, celestialNorth),
    polePositionAngleDeg: angle(bodyAxes[2], celestialEast, celestialNorth),
    orientationMode: localUp ? 'local-zenith' : 'celestial-north',
    skyDomeRollRad,
    earthshine: 1 - fraction,
  };
}
