import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'espree';
import { lunarLighting } from '../assets/js/weather-lunar-time.js';
import { moonPosition } from '../assets/js/weather-solar-time.js';

function withMoonPosition(source, position) {
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module', range: true });
  const targets = ast.body.filter(node => {
    const declaration = node.declarations?.[0], binding = declaration?.id;
    const property = binding?.properties?.[0];
    return node.type === 'VariableDeclaration' && node.kind === 'const' && node.declarations.length === 1 &&
      binding.type === 'ObjectPattern' && binding.properties.length === 1 &&
      property.type === 'Property' && !property.computed &&
      property.key.name === 'moonPosition' && property.value.name === 'moonPosition' &&
      declaration.init?.type === 'AwaitExpression' && declaration.init.argument.type === 'ImportExpression';
  });
  assert.equal(targets.length, 1, 'expected one parsed moonPosition dependency');
  const [start, end] = targets[0].range;
  return source.slice(0, start) + `const moonPosition = () => (${JSON.stringify(position)});` + source.slice(end);
}

test('the lunar orbit fixture replaces one dependency and rejects missing or duplicate targets', () => {
  const dependency = "const { moonPosition } = await import('orbit');";
  const before = '// retained prefix\n', after = '\nexport const retained = 1;';
  const position = { elevationDeg: 90, azimuthDeg: 17, distanceKm: 384400 };
  assert.equal(withMoonPosition(before + dependency + after, position),
    `${before}const moonPosition = () => (${JSON.stringify(position)});${after}`);
  for (const source of [before + after, dependency.replace('moonPosition', 'otherPosition'), `${dependency}\n${dependency}`]) {
    assert.throws(() => withMoonPosition(source, position), 'an unverified code transform cannot silently proceed');
  }
});

test('the lunar orbit dependency inherits the complete caller cache revision', async () => {
  const source = await readFile(new URL('../assets/js/weather-lunar-time.js', import.meta.url), 'utf8');
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module', range: true });
  const declaration = ast.body.find(node => node.type === 'VariableDeclaration' && node.declarations[0]?.init?.type === 'AwaitExpression');
  const expression = declaration?.declarations[0].init.argument;
  assert.equal(expression?.type, 'ImportExpression', 'updated lunar lighting must not reuse an unversioned cached orbit');
  const readUrl = new Function('moduleUrl', `return ${source.slice(...expression.source.range).replaceAll('import.meta.url', 'moduleUrl')};`);
  for (const url of ['https://preview.example/assets/js/weather-lunar-time.js?v=lunar-v9&moon-retry=2', 'file:///C:/site/assets/js/weather-lunar-time.js?v=qa', 'https://preview.example/assets/js/weather-lunar-time.js']) {
    const caller = new URL(url), dependency = new URL(readUrl(url));
    assert.equal(dependency.href, new URL(`./weather-solar-time.js${caller.search}`, caller).href);
  }
});

// Independently fetched 2026-11-06 from JPL Horizons DE441/MOON_ME, AIRLESS,
// Earth-surface geodetic sites, quantities10,14,15,16,17,24. Full requests/raw
// responses: output/solar-cycle-2026-11-06/lunar-v9/jpl-reference.json.
// https://ssd.jpl.nasa.gov/horizons/manual.html#observer-table
// date,lat,lon,fraction,subobserverlon/lat,subsolarlon/lat,SunPA,polePA,phaseangle.
const references = [
  ['2000-01-01T12:00:00Z',51.23,6.78,.2317509,4.744986,-5.863297,242.181074,.619964,110.03,17.0251,122.4425],
  ['2024-02-29T23:59:59Z',51.23,6.78,.7487033,354.436826,3.362297,294.390255,-.940598,109.92,16.8992,60.1742],
  ['2026-11-06T11:00:00Z',51.23,6.78,.0821339,5.479966,5.475175,218.621593,-1.514484,106.57,22.1654,146.6875],
  ['2026-11-06T18:00:00Z',51.23,6.78,.0674133,5.190089,5.695263,215.063453,-1.5175,105.16,21.995,149.8976],
  ['2026-11-09T07:00:00Z',51.23,6.78,.0023559,4.734225,7.062377,184.049643,-1.540166,9.64,16.6595,174.4365],
  ['2026-11-17T11:00:00Z',51.23,6.78,.500821,354.618269,.890999,84.499991,-1.552924,250.37,341.9224,89.906],
  ['2026-11-24T14:00:00Z',51.23,6.78,.9987915,357.675263,-5.494931,357.965096,-1.521103,343.89,347.9859,3.9839],
  ['2026-12-01T07:00:00Z',51.23,6.78,.4969549,6.80231,2.511123,276.517359,-1.469201,112,20.5433,90.349],
  ['2050-07-01T12:00:00Z',51.23,6.78,.8725369,354.142365,-.441404,35.975057,-1.181446,283.18,14.4543,41.8304],
  ['2026-03-20T12:00:00Z',-33.8688,151.2093,.0273999,356.041112,-4.963723,157.480668,.5353,235.71,338.5807,160.9494],
  ['2026-06-21T12:00:00Z',-33.8688,151.2093,.4507658,6.557537,2.407152,102.272867,1.366164,293.5,21.891,95.6515],
  ['2026-11-06T11:00:00Z',-33.8688,151.2093,.0832948,5.127624,4.097073,218.621597,-1.514484,108.67,22.1098,146.4459],
  ['2026-06-21T00:00:00Z',69.6492,18.9553,.4068854,7.567735,2.855575,108.386608,1.36769,293.44,21.5075,100.7339],
  ['2026-12-21T12:00:00Z',69.6492,18.9553,.9037958,354.591506,-5.64931,30.538116,-1.252526,260.83,345.1963,36.1341],
  ['2026-11-06T11:00:00Z',90,0,.0806517,5.794726,5.487521,218.621595,-1.514484,106.46,22.153,146.998],
  ['2026-11-06T11:00:00Z',-90,0,.0833736,5.092727,3.766411,218.621594,-1.514484,109.16,22.0964,146.4296],
  ['2026-11-06T11:00:00Z',0,0,.0834182,5.156604,4.871485,218.621592,-1.514484,107.53,22.1462,146.4205],
  ['2026-11-24T14:00:00Z',0,0,.9984655,357.942406,-6.011008,357.965098,-1.521103,347.81,348.0295,4.4899],
];
const radians = value => value * Math.PI / 180;
const array = v => [v.x,v.y,v.z];
const dot = (a,b) => a.reduce((sum,value,i)=>sum+value*b[i],0);
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const difference = (a,b) => Math.abs((a-b+540)%360-180);
const separation = (a,b) => Math.acos(Math.max(-1,Math.min(1,dot(a,b))))*180/Math.PI;
const lonLat = (lon,lat) => [Math.cos(radians(lat))*Math.cos(radians(lon)),Math.cos(radians(lat))*Math.sin(radians(lon)),Math.sin(radians(lat))];
const phaseVector = (phase,pa) => [Math.sin(radians(phase))*Math.sin(radians(pa)),Math.sin(radians(phase))*Math.cos(radians(pa)),Math.cos(radians(phase))];

for (const [date,lat,lon,fraction,observerLon,observerLat,sunLon,sunLat,sunPA,polePA,phase] of references) {
  test(`independent JPL surface/light vectors: ${date}, ${lat}/${lon}`, () => {
    const actual = lunarLighting(Date.parse(date),lat,lon);
    assert.equal(actual.valid,true);
    assert.ok(Math.abs(actual.illuminatedFraction-fraction)<.0005);
    assert.ok(Math.abs(actual.phaseAngleDeg-phase)<.07);
    assert.ok(separation(array(actual.observerDirectionBody),lonLat(observerLon,observerLat))<.10,'subobserver direction and texture seam');
    assert.ok(separation(array(actual.sunDirectionBody),lonLat(sunLon,sunLat))<.02,'Sun direction relative to lunar terrain');
    assert.ok(difference(actual.polePositionAngleDeg,polePA)<.05);
    // PA alone becomes ill-conditioned close to full/new. Compare the full
    // illumination vector so a near-zero projected limb is not overweighted.
    assert.ok(separation(phaseVector(actual.phaseAngleDeg,actual.brightLimbPositionAngleDeg),phaseVector(phase,sunPA))<.12);
  });
}

test('renderer contract is a proper non-mirrored rotation and consistent lighting',()=>{
  for(const [date,lat,lon]of references){
    const state=lunarLighting(Date.parse(date),lat,lon),axes=Object.values(state.bodyToView).map(array);
    for(const axis of axes)assert.ok(Math.abs(Math.hypot(...axis)-1)<1e-12);
    assert.ok(Math.abs(dot(axes[0],axes[1]))<1e-12);
    assert.ok(Math.abs(dot(cross(axes[0],axes[1]),axes[2])-1)<1e-12);
    const sun=array(state.sunDirectionBody),view=axes[0].map((_,i)=>axes.reduce((sum,axis,j)=>sum+axis[i]*sun[j],0));
    assert.ok(separation(view,array(state.lightDirection))<.000002);
    assert.ok(Math.abs((1+state.lightDirection.z)/2-state.illuminatedFraction)<1e-12);
    assert.deepEqual(state.northDirection,state.bodyToView.z);
    assert.ok(state.earthshine>=0&&state.earthshine<=1);
  }
});

test('same UTC phase is shared while observer tilt and parallax change between hemispheres',()=>{
  const time=Date.parse('2026-11-06T11:00:00Z');
  const a=lunarLighting(time,51.23,6.78),b=lunarLighting(time,-33.8688,151.2093);
  assert.ok(Math.abs(a.illuminatedFraction-b.illuminatedFraction)<.003);
  assert.equal(a.waxing,false);assert.equal(b.waxing,false);
  assert.ok(difference(a.brightLimbAngleDeg,b.brightLimbAngleDeg)>40);
  assert.ok(separation(array(a.observerDirectionBody),array(b.observerDirectionBody))>.2);
});

test('local screen north has the JPL pole angle plus observer parallactic orientation, without a hemisphere mirror',()=>{
  // Expected local angles use the independent JPL apparent RA/DEC and pole PA
  // above, with the spherical parallactic-angle relation q−PA. Derivation and
  // full18-case comparison are in the ignored JPL receipt, not runtime code.
  const cases=[
    ['2000-01-01T12:00:00Z',51.23,6.78,17.848975],
    ['2026-11-06T11:00:00Z',51.23,6.78,-2.533226],
    ['2026-11-06T18:00:00Z',51.23,6.78,12.113529],
    ['2026-11-06T11:00:00Z',-33.8688,151.2093,149.379073],
    ['2026-06-21T12:00:00Z',-33.8688,151.2093,104.402082],
    ['2026-11-06T11:00:00Z',90,0,-22.153],
    ['2026-11-06T11:00:00Z',-90,0,157.9036],
    ['2026-11-06T11:00:00Z',0,0,49.753602],
  ];
  for(const [date,lat,lon,expected]of cases){
    const north=lunarLighting(Date.parse(date),lat,lon).northDirection;
    assert.ok(difference(Math.atan2(north.x,north.y)*180/Math.PI,expected)<.10);
  }
});

test('dome portrait-up follows a finite difference of the stereographic sky at all observer latitudes', () => {
  let above = 0, below = 0;
  for (const [date, latitude, longitude] of references) {
    const time = Date.parse(date), position = moonPosition(time, latitude, longitude);
    const state = lunarLighting(time, latitude, longitude), roll = state.skyDomeRollRad;
    assert.ok(Number.isFinite(roll));
    const a = radians(position.azimuthDeg);
    const actualUp = [Math.sin(roll), -Math.cos(roll)];
    let expectedUp;
    if (position.elevationDeg < 0) {
      below++;
      // An off-sky marker keeps its real azimuth; portrait-up points from the
      // horizon boundary toward the zenith, not toward its hidden lower-sky point.
      expectedUp = [Math.sin(a), Math.cos(a)];
    } else {
      above++;
      const project = h => {
        const radius = Math.tan((Math.PI / 2 - h) / 2);
        return [-radius * Math.sin(a), -radius * Math.cos(a)];
      };
      const h = radians(position.elevationDeg), before = project(h - 1e-6), after = project(h + 1e-6);
      const tangent = after.map((value, index) => value - before[index]), length = Math.hypot(...tangent);
      expectedUp = tangent.map(value => value / length);
    }
    assert.ok(Math.hypot(...actualUp.map((value, index) => value - expectedUp[index])) < 1e-9,
      `${date}, ${latitude}/${longitude}: local vertical must point inward without a mirror`);
  }
  assert.ok(above > 0 && below > 0, 'exercise both visible portraits and below-horizon markers');
});

test('dome roll uses the nonsingular celestial-north basis at the exact zenith', async () => {
  const source = await readFile(new URL('../assets/js/weather-lunar-time.js', import.meta.url), 'utf8');
  let reference;
  for (const azimuthDeg of [0, 90, 180, 270]) {
    // At the zenith every azimuth denotes the same direction. Inject only the
    // orbit boundary value, leaving the actual observer/body/light transforms intact.
    const position = { elevationDeg: 90, azimuthDeg, distanceKm: 384400 };
    const fixture = withMoonPosition(source, position);
    const { lunarLighting: lighting } = await import(`data:text/javascript;base64,${Buffer.from(fixture).toString('base64')}`);
    const state = lighting(Date.parse('2026-11-06T11:00:00Z'), 0, 0);
    assert.equal(state.orientationMode, 'celestial-north');
    assert.ok(Math.abs(state.skyDomeRollRad) < 1e-12);
    const portraitAngle = Math.atan2(state.northDirection.x, state.northDirection.y) + state.skyDomeRollRad;
    if (reference !== undefined) assert.ok(Math.abs(Math.atan2(Math.sin(portraitAngle - reference), Math.cos(portraitAngle - reference))) < 1e-12);
    reference = portraitAngle;
  }
});

test('continuous phase, terrain and local orientation cross midnight, leap day, New Year and DST instants',()=>{
  for(const date of ['2024-03-01T00:00:00Z','2026-03-29T01:00:00Z','2026-10-25T01:00:00Z','2027-01-01T00:00:00Z']){
    const time=Date.parse(date),a=lunarLighting(time-1,51.23,6.78),b=lunarLighting(time+1,51.23,6.78);
    assert.ok(Math.abs(a.illuminatedFraction-b.illuminatedFraction)<1e-7);
    assert.ok(separation(array(a.sunDirectionBody),array(b.sunDirectionBody))<.00002);
    assert.ok(separation(array(a.observerDirectionBody),array(b.observerDirectionBody))<.00002);
    assert.ok(difference(a.brightLimbAngleDeg,b.brightLimbAngleDeg)<.0001);
  }
});

test('surface nearside and lunar phases evolve over a month rather than repeating each night',()=>{
  const start=Date.parse('2026-11-01T00:00:00Z'),fractions=[];
  for(let day=0;day<30;day++){
    const state=lunarLighting(start+day*86400000,51.23,6.78);fractions.push(state.illuminatedFraction);
    assert.ok(Math.abs(state.librationLongitudeDeg)<10);
    assert.ok(Math.abs(state.librationLatitudeDeg)<9);
  }
  assert.ok(Math.min(...fractions)<.005&&Math.max(...fractions)>.995);
  assert.ok(Math.abs(fractions[0]-fractions[1])>.01);
  assert.equal(lunarLighting(Date.parse('2026-11-17T11:00:00Z'),51.23,6.78).waxing,true);
  assert.equal(lunarLighting(Date.parse('2026-12-01T07:00:00Z'),51.23,6.78).waxing,false);
});

test('invalid inputs do not invent a full Moon and exact geographic poles remain finite',()=>{
  for(const args of [[NaN,0,0],[Infinity,0,0],[0,91,0],[0,0,181],[0,NaN,0],[8.65e15,0,0]])assert.deepEqual(lunarLighting(...args),{valid:false});
  for(const lat of [-90,90]){
    const state=lunarLighting(Date.parse('2026-11-06T11:00:00Z'),lat,0);
    for(const vector of [state.lightDirection,state.northDirection,state.observerDirectionBody,state.sunDirectionBody])assert.ok(Object.values(vector).every(Number.isFinite));
  }
});

// NASA volumetric mean radii:1737.4km Moon and695700km Sun, checked2026-11-07.
// https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html
// https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html
test('apparent diameters use the observer distance in kilometres and sphere tangent geometry', () => {
  for (const [date, latitude, longitude] of references) {
    const time = Date.parse(date), state = lunarLighting(time, latitude, longitude);
    assert.equal(state.moonDistanceKm, moonPosition(time, latitude, longitude).distanceKm, 'the Moon distance is already topocentric');
    for (const [diameter, radius, distance] of [[state.moonAngularDiameterDeg, 1737.4, state.moonDistanceKm], [state.sunAngularDiameterDeg, 695700, state.sunDistanceKm]]) {
      const tangentAngle = 2 * Math.atan2(radius, Math.sqrt(distance * distance - radius * radius)) * 180 / Math.PI;
      assert.ok(Math.abs(diameter - tangentAngle) < 1e-14, 'radians must be converted to degrees for the full diameter');
    }
    assert.equal(state.apparentDiameterRatio, state.moonAngularDiameterDeg / state.sunAngularDiameterDeg);
    assert.ok(state.moonAngularDiameterDeg > .48 && state.moonAngularDiameterDeg < .57);
    assert.ok(state.sunAngularDiameterDeg > .52 && state.sunAngularDiameterDeg < .55);
  }
});

test('apparent diameters vary with the lunar orbit and annual Sun distance within physical bounds', () => {
  const start = Date.parse('2026-01-01T09:00:00Z'), states = [];
  for (let day = 0; day < 365; day++) {
    const state = lunarLighting(start + day * 86400000, 51.16, 6.87); states.push(state);
    // NASA geocentric lunar extrema plus the Earth observer radius; these are
    // broad physical bounds, not a high-precision ephemeris error guarantee.
    assert.ok(state.moonDistanceKm > 350000 && state.moonDistanceKm < 414000);
    assert.ok(state.sunDistanceKm > 146900000 && state.sunDistanceKm < 152300000);
    assert.ok(state.apparentDiameterRatio > .88 && state.apparentDiameterRatio < 1.12);
  }
  const ratios = states.map(state => state.apparentDiameterRatio);
  assert.ok(Math.max(...ratios) - Math.min(...ratios) > .1, 'the relative size cannot remain a fixed artistic multiplier');
  const january = lunarLighting(Date.parse('2026-01-03T12:00:00Z'), 51.16, 6.87);
  const july = lunarLighting(Date.parse('2026-07-04T12:00:00Z'), 51.16, 6.87);
  assert.ok(july.sunDistanceKm - january.sunDistanceKm > 4800000);
  assert.ok(january.sunAngularDiameterDeg > .54 && july.sunAngularDiameterDeg < .53);
  const current = lunarLighting(Date.parse('2026-11-07T09:00:00Z'), 51.16, 6.87);
  assert.ok(current.apparentDiameterRatio > .94 && current.apparentDiameterRatio < .97, 'this reference instant has a Moon slightly smaller than the solar disc');
});

test('angular size evolves smoothly across calendar/time-zone boundaries and depends on the observation site', () => {
  for (const date of ['2024-03-01T00:00:00Z', '2026-03-29T01:00:00Z', '2026-10-25T01:00:00Z', '2027-01-01T00:00:00Z']) {
    const time = Date.parse(date), before = lunarLighting(time - 1, 51.16, 6.87), after = lunarLighting(time + 1, 51.16, 6.87);
    assert.ok(Math.abs(before.moonDistanceKm - after.moonDistanceKm) < .01);
    assert.ok(Math.abs(before.sunDistanceKm - after.sunDistanceKm) < .01);
    for (const key of ['moonAngularDiameterDeg', 'sunAngularDiameterDeg', 'apparentDiameterRatio']) assert.ok(Math.abs(before[key] - after[key]) < 1e-7, key);
  }
  const time = Date.parse('2026-11-07T09:00:00Z');
  const a = lunarLighting(time, 51.16, 6.87), b = lunarLighting(time, -33.8688, 151.2093);
  assert.ok(Math.abs(a.moonDistanceKm - b.moonDistanceKm) > 1000);
  assert.ok(Math.abs(a.apparentDiameterRatio - b.apparentDiameterRatio) > .001);
});
