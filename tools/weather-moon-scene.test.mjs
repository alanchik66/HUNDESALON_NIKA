import test from 'node:test';
import assert from 'node:assert/strict';
import { lunarLighting } from '../assets/js/weather-lunar-time.js';
import { renderLunarPixels, lunarSurfaceNormal, lunarTerrainVisibility, canonicalLunarView, createHeaderWeatherMoonScene } from '../assets/js/header-weather-moon-scene.js';

const RADIUS = 1737.4;
const dot = (a,b) => a.x*b.x+a.y*b.y+a.z*b.z;
const norm = v => Math.hypot(v.x,v.y,v.z);
const difference = (a,b) => Math.abs((a-b+540)%360-180);

function mapsFor(profile=()=>0,width=128,height=64) {
  const maps={width,height,albedo:new Uint8Array(width*height*3).fill(150),heightData:new Uint16Array(width*height)};
  for(let row=0;row<height;row++)for(let column=0;column<width;column++){
    const lon=((column+.5)/width-.5)*2*Math.PI,lat=(.5-(row+.5)/height)*Math.PI;
    maps.heightData[row*width+column]=Math.round(20000+2000*profile(lon,lat));
  }
  return maps;
}

function idealLighting(fraction,side=1) {
  // Explicit geometry: body0°E faces the observer; 90°E is screen right.
  const z=2*fraction-1,x=side*Math.sqrt(Math.max(0,1-z*z));
  return {valid:true,illuminatedFraction:fraction,lightDirection:{x,y:0,z},sunDirectionBody:{x:z,y:x,z:0},
    observerDirectionBody:{x:1,y:0,z:0},northDirection:{x:0,y:1,z:0},
    bodyToView:{x:{x:0,y:0,z:1},y:{x:1,y:0,z:0},z:{x:0,y:1,z:0}}};
}

const pixel = (image,x,y) => [...image.data.slice((y*image.width+x)*4,(y*image.width+x)*4+4)];
function litArea(image) {
  let opaque=0,lit=0,sumX=0;
  for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){
    const p=pixel(image,x,y);if(p[3]<250)continue;opaque++;
    if(Math.max(...p.slice(0,3))>0){lit++;sumX+=x+.5-image.width/2;}
  }
  return {fraction:lit/opaque,centroidX:sumX/lit,opaque,lit};
}

test('flat sphere projected illuminated area follows actual phase, including both crescent directions',()=>{
  const maps=mapsFor();
  for(const side of [-1,1])for(const fraction of [0,.02,.25,.5,.75,.98,1]){
    const image=renderLunarPixels(idealLighting(fraction,side),maps,{size:257,discFraction:.86,earthshine:false,terrain:false});
    const measured=litArea(image);
    assert.ok(Math.abs(measured.fraction-fraction)<.008,`${side}/${fraction}: ${measured.fraction}`);
    if(fraction===.5)assert.ok(side*measured.centroidX>35,'quarter illumination is on the physical Sun side');
  }
});

test('transparent exterior and opaque unlit lunar surface are independent of image brightness',()=>{
  const maps=mapsFor(),dark=renderLunarPixels(idealLighting(0),maps,{size:257,earthshine:false,terrain:false});
  const bright=renderLunarPixels(idealLighting(1),maps,{size:257,earthshine:false,terrain:false});
  assert.deepEqual(pixel(dark,128,128),[0,0,0,255]);
  assert.equal(pixel(bright,128,128)[3],255);assert.ok(pixel(bright,128,128)[0]>100);
  assert.deepEqual(pixel(dark,0,0),[0,0,0,0]);
  for(let index=3;index<dark.data.length;index+=4)assert.equal(dark.data[index],bright.data[index]);
  const alphas=new Set(dark.data.filter((_,index)=>index%4===3));
  assert.ok(alphas.size>2,'antialiasing affects geometry, not a black-key transparency threshold');
});

test('Earthshine is faint and cool, strongest near new Moon, and cannot change phase or silhouette alpha',()=>{
  const maps=mapsFor();
  const dark=renderLunarPixels(idealLighting(0),maps,{size:129,earthshine:false,terrain:false});
  const earth=renderLunarPixels(idealLighting(0),maps,{size:129,terrain:false});
  const quarter=renderLunarPixels(idealLighting(.5),maps,{size:129,terrain:false});
  const full=renderLunarPixels(idealLighting(1),maps,{size:129,terrain:false});
  const fullWithout=renderLunarPixels(idealLighting(1),maps,{size:129,earthshine:false,terrain:false});
  const [red,green,blue,alpha]=pixel(earth,64,64),sunlit=pixel(full,64,64)[0];
  assert.ok(red>0&&red<green&&green<blue);assert.equal(alpha,255);
  assert.ok(blue<sunlit*.25,'Earthshine stays faint relative to direct sunlight');
  assert.ok(earth.stats.earthshine>quarter.stats.earthshine&&quarter.stats.earthshine>full.stats.earthshine);
  assert.equal(earth.stats.sunlit,0);assert.equal(dark.stats.sunlit,0);
  assert.deepEqual(full.data,fullWithout.data);
  for(let index=3;index<earth.data.length;index+=4)assert.equal(earth.data[index],dark.data[index]);
});

test('canonical north-up raster plus CSS clockwise rotation reconstructs observer view in both hemispheres',()=>{
  for(const [lat,lon]of [[51.23,6.78],[-33.8688,151.2093],[90,0],[-90,0],[0,0]]){
    const lighting=lunarLighting(Date.parse('2026-11-06T11:00:00Z'),lat,lon),view=canonicalLunarView(lighting);
    assert.ok(Math.abs(view.z.x)<1e-12&&view.z.y>0);
    const c=Math.cos(view.angle),s=Math.sin(view.angle);
    for(const key of ['x','y','z']){
      const v=view[key],reconstructed={x:c*v.x+s*v.y,y:-s*v.x+c*v.y,z:v.z};
      assert.ok(Math.hypot(...['x','y','z'].map(k=>reconstructed[k]-lighting.bodyToView[key][k]))<1e-12);
    }
  }
  const germany=canonicalLunarView(lunarLighting(Date.parse('2026-11-06T11:00:00Z'),51.23,6.78));
  const sydney=canonicalLunarView(lunarLighting(Date.parse('2026-11-06T11:00:00Z'),-33.8688,151.2093));
  assert.ok(difference(germany.angle*180/Math.PI,-2.533226)<.1);
  assert.ok(difference(sydney.angle*180/Math.PI,149.379073)<.1);
});

test('east-positive albedo landmarks and lunar north are mapped without a mirror',()=>{
  const maps=mapsFor();
  for(let row=0;row<maps.height;row++)for(let column=0;column<maps.width;column++){
    const lon=((column+.5)/maps.width-.5)*2*Math.PI,lat=(.5-(row+.5)/maps.height)*Math.PI,i=(row*maps.width+column)*3;
    maps.albedo[i]=Math.round(130+80*Math.sin(lon));maps.albedo[i+1]=Math.round(130+80*Math.sin(lat));maps.albedo[i+2]=100;
  }
  const image=renderLunarPixels(idealLighting(1),maps,{size:257,discFraction:.86,earthshine:false,terrain:false});
  assert.ok(pixel(image,175,128)[0]>pixel(image,81,128)[0]+30,'east feature is on the right');
  assert.ok(pixel(image,128,81)[1]>pixel(image,128,175)[1]+30,'north feature is above the equator');
});

test('half-metre DEM units produce the physical radial-graph surface normal and wrap at the map seam',()=>{
  const flat=mapsFor(),normal=lunarSurfaceNormal(flat,.7,-.3);
  const expected={x:Math.cos(.3)*Math.cos(.7),y:Math.cos(.3)*Math.sin(.7),z:-Math.sin(.3)};
  assert.ok(Math.hypot(normal.x-expected.x,normal.y-expected.y,normal.z-expected.z)<1e-12);
  const tilted=mapsFor((lon,lat)=>8*Math.sin(lon)*Math.cos(lat)+4*Math.sin(lat),1024,512);
  const n=lunarSurfaceNormal(tilted,0,0),length=Math.hypot(1,8/RADIUS,4/RADIUS);
  assert.ok(Math.abs(n.x-1/length)<.000002);
  // Half-metre source quantization bounds a finite-difference slope error by
  // DNstep/(2*pixelAngle*radius), about2.35e−5 at this map resolution.
  const slopeTolerance=.0005/(2*(Math.PI/512)*RADIUS)+.000002;
  assert.ok(Math.abs(n.y+8/RADIUS/length)<slopeTolerance);
  assert.ok(Math.abs(n.z+4/RADIUS/length)<slopeTolerance);
  assert.ok(dot(n,{x:1,y:0,z:0})>0);
  const seamA=lunarSurfaceNormal(tilted,-Math.PI,0),seamB=lunarSurfaceNormal(tilted,Math.PI,0);
  assert.ok(Math.hypot(seamA.x-seamB.x,seamA.y-seamB.y,seamA.z-seamB.z)<1e-12);
  for(const lat of [-Math.PI/2,Math.PI/2])assert.ok(Math.abs(norm(lunarSurfaceNormal(tilted,0,lat))-1)<1e-12);
});

test('flat spherical terrain cannot cast a false shadow with the whole Sun above its horizon',()=>{
  const maps=mapsFor();
  for(const altitude of [.01,.02,.08]){
    const sun={x:altitude,y:Math.sqrt(1-altitude*altitude),z:0};
    assert.equal(lunarTerrainVisibility(maps,{x:1,y:0,z:0},sun,0),1);
  }
});

test('a realistic crater rim casts a shadow onto a Sun-facing floor, which disappears at higher Sun elevation',()=>{
  const flat=mapsFor(()=>0,1024,512);
  const crater=mapsFor((lon,lat)=>{
    const r=RADIUS*Math.acos(Math.max(-1,Math.min(1,Math.cos(lat)*Math.cos(lon))));
    return -3*Math.exp(-((r/55)**4))+1.8*Math.exp(-(((r-80)/12)**2));
  },1024,512);
  const position={x:1,y:0,z:0},lowSun={x:.02,y:Math.sqrt(1-.02**2),z:0},highSun={x:.08,y:Math.sqrt(1-.08**2),z:0};
  assert.ok(dot(lunarSurfaceNormal(crater,0,0),lowSun)>.019,'floor normal itself faces the Sun');
  assert.equal(lunarTerrainVisibility(flat,position,lowSun,0),1);
  assert.equal(lunarTerrainVisibility(crater,position,lowSun,-3),0);
  assert.equal(lunarTerrainVisibility(crater,position,highSun,-3),1);
  const lighting=idealLighting(.51),options={size:257,earthshine:false};
  const shadow=renderLunarPixels(lighting,crater,options),withoutTerrain=renderLunarPixels(lighting,crater,{...options,terrain:false});
  assert.deepEqual(pixel(shadow,128,128),[0,0,0,255]);
  assert.ok(pixel(withoutTerrain,128,128)[0]>30);
  assert.ok(shadow.stats.terrainShadow>0);
});

test('fixed UTC rendering is deterministic for northern/southern observers and invalid lighting is transparent',()=>{
  const maps=mapsFor();
  for(const [lat,lon]of [[51.23,6.78],[-33.8688,151.2093]]){
    const lighting=lunarLighting(Date.parse('2026-11-06T11:00:00Z'),lat,lon),options={size:97,terrain:false};
    assert.deepEqual(renderLunarPixels(lighting,maps,options).data,renderLunarPixels(lighting,maps,options).data);
  }
  const invalid=renderLunarPixels(lunarLighting(NaN,0,0),null,{size:33});
  assert.equal(invalid.data.length,33*33*4);assert.ok(invalid.data.every(value=>value===0));
});

test('native scene respects owner/dispose/visibility/abort boundaries and forecast appearance UTC',async()=>{
  const originals=new Map(['document','fetch','createImageBitmap'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  let requests=0,closed=0;
  try{
    globalThis.fetch=async url=>{requests++;return {ok:true,blob:async()=>new Blob([],{type:String(url).includes('moon-height')?'height':'albedo'})};};
    globalThis.createImageBitmap=async blob=>({width:64,height:32,kind:blob.type,close(){closed++;}});
    globalThis.document={createElement(){let current;return {width:0,height:0,getContext(){return {drawImage(image){current=image;},clearRect(){},getImageData(){const data=new Uint8ClampedArray(64*32*4);for(let i=0;i<64*32;i++){data.set(current.kind==='height'?[78,32,0,255]:[150,150,150,255],i*4);}return {data};}};}};}};
    let writes=0,clears=0,reduced=false,current=true,clock=Date.parse('2026-11-06T11:00:00Z');
    const context={createImageData(width,height){return {data:new Uint8ClampedArray(width*height*4)};},putImageData(){writes++;},clearRect(){clears++;}};
    const canvas={isConnected:true,width:0,height:0,dataset:{},ownerDocument:{hidden:false,defaultView:{matchMedia(){return {matches:reduced};}}},style:{setProperty(key,value,priority){this[key]=value;this[`${key}Priority`]=priority;},removeProperty(key){delete this[key];}},getContext(){return context;}};
    const options={size:65,geoState:{latitude:51.23,longitude:6.78,timeMs:clock},getTimeMs:()=>clock,isCurrent:()=>current};
    const first=await createHeaderWeatherMoonScene(canvas,options);assert.equal(writes,2,'phase-only loading frame then decoded terrain frame');assert.equal(requests,2);assert.equal(closed,2);
    assert.equal(canvas.style.transition,'rotate 1s linear');assert.equal(canvas.style.transitionPriority,'important','local rotation must override the shared canvas opacity transition');
    first.renderFrame();assert.equal(writes,2,'unchanged sky reuses its raster');
    const forecast=Date.parse('2026-11-24T14:53:00Z');first.setGeoState({...options.geoState,appearanceTimeMs:forecast});
    await first.whenRendered;
    assert.equal(first.getLightingState().timeMs,forecast);assert.equal(Number(canvas.dataset.moonRenderedAt),forecast);
    const settled=writes;canvas.ownerDocument.hidden=true;assert.equal(first.renderFrame(true),false);assert.equal(writes,settled);
    canvas.ownerDocument.hidden=false;reduced=true;first.renderFrame(true);assert.equal(canvas.style.transition,'none');assert.equal(canvas.style.transitionPriority,'important');
    current=false;const beforeObsolete=writes;assert.equal(first.renderFrame(true),false);assert.equal(writes,beforeObsolete);current=true;
    const second=await createHeaderWeatherMoonScene(canvas,options),secondWrites=writes;
    assert.equal(first.renderFrame(true),false);assert.equal(writes,secondWrites,'old owner cannot overwrite the new instance');
    first.dispose();assert.equal(clears,0,'old disposal cannot clear the new surface');
    second.dispose();second.dispose();assert.equal(clears,1);assert.equal(second.renderFrame(true),false);
    const controller=new AbortController();controller.abort();await assert.rejects(createHeaderWeatherMoonScene(canvas,{...options,signal:controller.signal}),{name:'AbortError'});
    canvas.isConnected=false;await assert.rejects(createHeaderWeatherMoonScene(canvas,options),{name:'AbortError'});
  }finally{for(const[key,descriptor]of originals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
});

let factoryFixtureId=0;
async function withDeferredFactory(run) {
  const originals=new Map(['document','fetch','createImageBitmap'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const pending=[],state={requests:[],closed:0,decoded:0,failHeight:false};
  let release;const gate=new Promise(resolve=>{release=resolve;});
  try{
    globalThis.fetch=async url=>{
      const kind=String(url).includes('moon-height')?'height':'albedo';state.requests.push(kind);
      await gate;
      if(kind==='height'&&state.failHeight)throw new Error('Fixture height transfer failed.');
      return {ok:true,blob:async()=>new Blob([],{type:kind})};
    };
    globalThis.createImageBitmap=async blob=>{state.decoded++;return {width:64,height:32,kind:blob.type,close(){state.closed++;}};};
    globalThis.document={createElement(){let current;return {width:0,height:0,getContext(){return {
      drawImage(image){current=image;},clearRect(){},getImageData(){
        const data=new Uint8ClampedArray(64*32*4);
        for(let row=0;row<32;row++)for(let column=0;column<64;column++){
          // A visible landmark proves decoded maps replaced the uniform loader.
          const shade=column<32?90:210;
          data.set(current.kind==='height'?[78,32,0,255]:[shade,shade,shade,255],(row*64+column)*4);
        }
        return {data};
      },
    };}};}};
    const {createHeaderWeatherMoonScene:factory}=await import(`../assets/js/header-weather-moon-scene.js?factory-fixture=${factoryFixtureId++}`);
    const mount=(...args)=>{const promise=factory(...args);promise.catch(()=>{});pending.push(promise);return promise;};
    const target=()=>{
      const frames=[];let clears=0,pixels;
      const context={createImageData(width,height){return {data:new Uint8ClampedArray(width*height*4)};},
        putImageData(image){pixels=image.data.slice();frames.push(pixels);},clearRect(){clears++;pixels=new Uint8ClampedArray(canvas.width*canvas.height*4);}};
      const canvas={hidden:true,isConnected:true,width:0,height:0,dataset:{},ownerDocument:{hidden:false,defaultView:{matchMedia(){return {matches:false};}}},
        style:{setProperty(key,value){this[key]=value;},removeProperty(key){delete this[key];}},getContext(){return context;}};
      return {canvas,frames,get clears(){return clears;},get pixels(){return pixels;}};
    };
    await run({mount,target,state,release});
  }finally{
    release();await Promise.allSettled(pending);
    for(const[key,descriptor]of originals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
  }
}

const loadingOptions=timeMs=>({size:97,geoState:{latitude:51.23,longitude:6.78,timeMs},getTimeMs:()=>timeMs});

test('dome scenes add the sky roll without changing the laboratory portrait or lunar raster', async () => {
  await withDeferredFactory(async ({ mount, target, release }) => {
    const time = Date.parse('2026-11-06T11:00:00Z'), laboratory = target(), dome = target();
    const labPending = mount(laboratory.canvas, loadingOptions(time));
    const domePending = mount(dome.canvas, { ...loadingOptions(time), skyProjection: 'dome' });
    const lighting = lunarLighting(time, 51.23, 6.78), view = canonicalLunarView(lighting);
    assert.ok(Math.abs(parseFloat(laboratory.canvas.style.rotate) - view.angle) < 1e-12);
    assert.ok(Math.abs(parseFloat(dome.canvas.style.rotate) - view.angle - lighting.skyDomeRollRad) < 1e-12);
    assert.deepEqual(dome.frames[0], laboratory.frames[0], 'the roll is CSS presentation, never altered physical phase or terrain');
    release();
    const [labScene, domeScene] = await Promise.all([labPending, domePending]);
    assert.deepEqual(dome.pixels, laboratory.pixels, 'decoded original maps and native raster are identical');
    let previous = parseFloat(dome.canvas.style.rotate), previousExpected = view.angle + lighting.skyDomeRollRad, seams = 0;
    for (let hour = 1; hour <= 24; hour++) {
      const appearanceTimeMs = time + hour * 3600000;
      domeScene.setGeoState({ ...loadingOptions(time).geoState, appearanceTimeMs });
      const state = domeScene.getLightingState(), expected = canonicalLunarView(state).angle + state.skyDomeRollRad;
      const actual = parseFloat(dome.canvas.style.rotate);
      if (Math.abs(expected - previousExpected) > Math.PI) seams++;
      assert.ok(Math.abs(Math.atan2(Math.sin(actual - expected), Math.cos(actual - expected))) < 1e-12);
      assert.ok(Math.abs(actual - previous) <= Math.PI + 1e-12, 'crossing the angular seam takes the short rotation');
      previous = actual; previousExpected = expected;
      await domeScene.whenRendered;
    }
    assert.ok(seams > 0, 'the daily sequence actually crosses a wrapped angular seam');
    labScene.dispose(); domeScene.dispose();
  });
});

test('deferred shared map download immediately paints the correct featureless phase on both canvases, then replaces it once',async()=>{
  await withDeferredFactory(async({mount,target,state,release})=>{
    const time=Date.parse('2026-11-06T11:00:00Z'),a=target(),b=target(),options=loadingOptions(time);
    const one=mount(a.canvas,options),two=mount(b.canvas,options);
    assert.equal(a.frames.length,1);assert.equal(b.frames.length,1);
    assert.equal(a.canvas.hidden,false);assert.equal(a.canvas.dataset.moonDetail,'loading');
    const lighting=lunarLighting(time,51.23,6.78),displayFraction=Number(a.canvas.dataset.moonIlluminated);
    assert.ok(Math.abs(displayFraction-lighting.illuminatedFraction)<.000001,'loading consumes the same exact UTC appearance state');
    assert.ok(Math.abs(displayFraction-.0821339)<.0005,'the independent JPL bound confirms a thin crescent rather than a full placeholder');
    const flat=renderLunarPixels(lighting,mapsFor(()=>0,2,1),{size:97,terrain:false});
    assert.deepEqual(a.frames[0],flat.data,'the loading frame contains no invented crater/height texture');
    assert.equal(state.requests.length,2,'two simultaneous canvases share one request per map');
    assert.equal(state.closed,0);
    release();const [first,second]=await Promise.all([one,two]);
    assert.equal(a.frames.length,2);assert.equal(b.frames.length,2);assert.equal(state.closed,2);
    assert.equal(a.canvas.dataset.moonDetail,'terrain');
    assert.notDeepEqual(a.frames[0],a.frames[1],'the decoded albedo landmark replaces the uniform loading surface');
    assert.equal(first.getLightingState().timeMs,time);assert.equal(second.getLightingState().timeMs,time);
    first.dispose();second.dispose();
  });
});

test('an obsolete aborted owner cannot repaint or erase a newer loading owner when shared maps arrive',async()=>{
  await withDeferredFactory(async({mount,target,state,release})=>{
    const t=target(),controller=new AbortController();
    const old=mount(t.canvas,{...loadingOptions(Date.parse('2026-11-06T11:00:00Z')),signal:controller.signal});
    const oldFrame=t.frames[0];controller.abort();
    const newerTime=Date.parse('2026-11-24T14:53:00Z'),newer=mount(t.canvas,loadingOptions(newerTime));
    assert.equal(t.frames.length,2);assert.notDeepEqual(oldFrame,t.frames[1]);
    assert.ok(Number(t.canvas.dataset.moonIlluminated)>.99);
    release();await assert.rejects(old,{name:'AbortError'});const scene=await newer;
    assert.equal(state.requests.length,2);assert.equal(t.frames.length,3,'only the current owner paints decoded maps');
    assert.equal(t.clears,0,'stale abort must not clear the newer phase');
    assert.equal(Number(t.canvas.dataset.moonRenderedAt),newerTime);assert.equal(t.canvas.dataset.moonDetail,'terrain');
    scene.dispose();assert.equal(t.clears,1);
  });
});

test('abort during a deferred load clears only its own surface while preserving the completed shared map cache',async()=>{
  await withDeferredFactory(async({mount,target,state,release})=>{
    const t=target(),controller=new AbortController(),options=loadingOptions(Date.parse('2026-11-06T11:00:00Z'));
    const pending=mount(t.canvas,{...options,signal:controller.signal});assert.equal(t.frames.length,1);
    controller.abort();release();await assert.rejects(pending,{name:'AbortError'});
    assert.equal(t.frames.length,1);assert.equal(t.clears,1);assert.equal(t.canvas.__moonSurfaceOwner,undefined);
    assert.equal(state.closed,2);
    const next=target(),scene=await mount(next.canvas,options);
    assert.equal(state.requests.length,2,'one aborted consumer must not poison a successfully loaded shared cache');
    assert.equal(next.frames.length,2);scene.dispose();
  });
});

test('map transfer failure preserves the phase frame, closes decoded resources, and permits a deduplicated retry',async()=>{
  await withDeferredFactory(async({mount,target,state,release})=>{
    const t=target(),options=loadingOptions(Date.parse('2026-11-06T11:00:00Z'));state.failHeight=true;
    const pending=mount(t.canvas,options);const loading=t.frames[0].slice();release();
    await assert.rejects(pending,/Fixture height transfer failed/);
    assert.equal(t.canvas.dataset.moonDetail,'fallback');assert.equal(t.canvas.hidden,false);
    assert.equal(t.frames.length,1);assert.equal(t.clears,0);assert.deepEqual(t.pixels,loading);
    assert.equal(state.closed,state.decoded,'all decoded resources are closed; an early peer failure may prevent decoding altogether');
    const closedBeforeRetry=state.closed;
    state.failHeight=false;const peer=target(),one=mount(t.canvas,options),two=mount(peer.canvas,options);
    const [first,second]=await Promise.all([one,two]);
    assert.equal(state.requests.length,4,'retry starts exactly one new shared pair');assert.equal(state.closed,closedBeforeRetry+2);
    assert.equal(t.canvas.dataset.moonDetail,'terrain');assert.equal(peer.canvas.dataset.moonDetail,'terrain');
    assert.equal(t.frames.length,3);assert.equal(peer.frames.length,2);
    assert.notDeepEqual(t.pixels,loading);assert.equal(first.getLightingState().timeMs,options.geoState.timeMs);
    first.dispose();second.dispose();
  });
});

test('finite terrain jobs discard superseded timestamps and hidden/aborted work instead of painting stale pixels',async()=>{
  await withDeferredFactory(async({mount,target,release})=>{
    release();const t=target(),controller=new AbortController(),time=Date.parse('2026-11-06T11:00:00Z');
    const options={...loadingOptions(time),signal:controller.signal},scene=await mount(t.canvas,options);
    assert.equal(t.frames.length,2);
    scene.setGeoState({...options.geoState,appearanceTimeMs:time+86400000});const superseded=scene.whenRendered;
    scene.setGeoState({...options.geoState,appearanceTimeMs:time+2*86400000});const latest=scene.whenRendered;
    assert.equal(await superseded,false);assert.equal(await latest,true);
    assert.equal(t.frames.length,3,'only one complete latest raster is committed');
    assert.equal(Number(t.canvas.dataset.moonRenderedAt),time+2*86400000);
    scene.setGeoState({...options.geoState,appearanceTimeMs:time+3*86400000});const hidden=scene.whenRendered;
    t.canvas.ownerDocument.hidden=true;assert.equal(await hidden,false);assert.equal(t.frames.length,3);
    t.canvas.ownerDocument.hidden=false;assert.equal(scene.renderFrame(),true);assert.equal(await scene.whenRendered,true);assert.equal(t.frames.length,4);
    scene.setGeoState({...options.geoState,appearanceTimeMs:time+4*86400000});const detached=scene.whenRendered;
    t.canvas.isConnected=false;assert.equal(await detached,false);assert.equal(t.frames.length,4);
    t.canvas.isConnected=true;assert.equal(scene.renderFrame(),true);assert.equal(await scene.whenRendered,true);assert.equal(t.frames.length,5);
    scene.setGeoState({...options.geoState,appearanceTimeMs:time+5*86400000});const aborted=scene.whenRendered;
    controller.abort();assert.equal(await aborted,false);assert.equal(t.frames.length,5);
    scene.dispose();
  });
});

test('replacing a scene while its four-scanline job is pending prevents the old owner from committing',async()=>{
  await withDeferredFactory(async({mount,target,release})=>{
    release();const t=target(),time=Date.parse('2026-11-06T11:00:00Z'),options=loadingOptions(time);
    const first=await mount(t.canvas,options);first.setGeoState({...options.geoState,appearanceTimeMs:time+86400000});
    const obsolete=first.whenRendered,newTime=Date.parse('2026-11-24T14:53:00Z');
    const newer=mount(t.canvas,loadingOptions(newTime));assert.equal(t.frames.length,3,'replacement paints its phase synchronously');
    assert.equal(await obsolete,false);const scene=await newer;
    assert.equal(t.frames.length,4);assert.equal(Number(t.canvas.dataset.moonRenderedAt),newTime);assert.equal(t.clears,0);
    first.dispose();assert.equal(t.clears,0);scene.dispose();assert.equal(t.clears,1);
  });
});

test('maps arriving while hidden replace the featureless raster immediately on visibility resume at unchanged UTC',async()=>{
  await withDeferredFactory(async({mount,target,release})=>{
    const t=target(),options=loadingOptions(Date.parse('2026-11-06T11:00:00Z')),pending=mount(t.canvas,options);
    assert.equal(t.frames.length,1);const loading=t.pixels.slice();
    t.canvas.ownerDocument.hidden=true;release();const scene=await pending;
    assert.equal(t.frames.length,1,'hidden document does not start terrain work');
    assert.notEqual(t.canvas.dataset.moonDetail,'terrain','ready must describe a committed terrain frame, not merely downloaded maps');
    t.canvas.ownerDocument.hidden=false;
    assert.equal(scene.renderFrame(),true,'ready maps invalidate the loading raster despite unchanged clock/geometry');
    assert.equal(await scene.whenRendered,true);assert.equal(t.frames.length,2);assert.notDeepEqual(t.pixels,loading);
    scene.dispose();
  });
});

async function withHeldRasterTurns(run) {
  const original = globalThis.setTimeout, turns = [];
  globalThis.setTimeout = (callback, delay, ...args) => delay === 0 ? (turns.push(() => callback(...args)), turns.length) : original(callback, delay, ...args);
  const drain = async () => {
    for (let turn = 0; turn < 500; turn++) {
      await new Promise(resolve => setImmediate(resolve));
      if (!turns.length) return;
      turns.splice(0).forEach(callback => callback());
    }
    throw new Error('Lunar work queue did not settle.');
  };
  try { await run({ turns, drain }); }
  finally { globalThis.setTimeout = original; turns.splice(0).forEach(callback => callback()); }
}

test('live clock ticks cannot starve a terrain job that takes longer than the raster refresh interval', async () => {
  await withDeferredFactory(async ({ mount, target, release }) => {
    release(); let clock = Date.parse('2026-11-06T11:00:00Z');
    const t = target(), options = { ...loadingOptions(clock), getTimeMs: () => clock }, scene = await mount(t.canvas, options);
    await withHeldRasterTurns(async ({ drain }) => {
      clock += 16000; scene.setGeoState({ ...options.geoState, timeMs: clock }); const first = scene.whenRendered;
      for (let tick = 0; tick < 40; tick++) { clock += 1000; scene.setGeoState({ ...options.geoState, timeMs: clock }); }
      await drain();
      assert.equal(await first, true, 'ordinary live ticks must allow the in-flight detailed frame to commit');
      await scene.whenRendered;
      assert.equal(Number(t.canvas.dataset.moonRenderedAt), clock, 'a coalesced successor must then catch up to the latest live time');
      assert.equal(t.frames.length, 4, 'initial phase + initial terrain + completed in-flight frame + one latest successor');
    });
    scene.dispose();
  });
});

test('a city or selected-time change during initial terrain work commits only the latest requested context', async () => {
  await withDeferredFactory(async ({ mount, target, release }) => {
    let selected = loadingOptions(Date.parse('2026-11-06T11:00:00Z')).geoState;
    const t = target();
    await withHeldRasterTurns(async ({ turns, drain }) => {
      const pending = mount(t.canvas, { ...loadingOptions(selected.timeMs), getGeoState: () => selected });
      release(); await new Promise(resolve => setImmediate(resolve));
      assert.ok(turns.length, 'the old-context terrain job has started and yielded');
      selected = { latitude: -33.8688, longitude: 151.2093, timeMs: selected.timeMs, appearanceTimeMs: Date.parse('2026-11-24T14:53:00Z') };
      await drain(); const scene = await pending;
      assert.equal(Number(t.canvas.dataset.moonRenderedAt), selected.appearanceTimeMs);
      assert.deepEqual(scene.getLightingState(), lunarLighting(selected.appearanceTimeMs, selected.latitude, selected.longitude));
      assert.equal(t.frames.length, 2, 'old initial terrain must not be committed before the correct selected surface');
      scene.dispose();
    });
  });
});

test('a short explicit time change supersedes pending work even inside the ordinary15s raster cache', async () => {
  await withDeferredFactory(async ({ mount, target, release }) => {
    release(); const time = Date.parse('2026-11-06T11:00:00Z'), t = target(), options = loadingOptions(time);
    const scene = await mount(t.canvas, options);
    await withHeldRasterTurns(async ({ drain }) => {
      scene.renderFrame(true); const old = scene.whenRendered;
      scene.setGeoState({ ...options.geoState, appearanceTimeMs: time + 1 }); const latest = scene.whenRendered;
      await drain();
      assert.equal(await old, false, 'explicit selection must invalidate the old request even when its pixels are nearly identical');
      assert.equal(await latest, true);
      assert.equal(Number(t.canvas.dataset.moonRenderedAt), time + 1);
    });
    scene.dispose();
  });
});

test('private work channels close after both a completed raster and an obsolete owner', async () => {
  await withDeferredFactory(async ({ mount, target, release }) => {
    release(); const t = target(), options = loadingOptions(Date.parse('2026-11-06T11:00:00Z'));
    let opened = 0, closed = 0;
    t.canvas.ownerDocument.defaultView.MessageChannel = class {
      constructor() {
        opened++;
        this.port1 = { close() { closed++; } };
        this.port2 = { postMessage: () => setImmediate(() => this.port1.onmessage?.()), close() { closed++; } };
      }
    };
    const scene = await mount(t.canvas, options);
    assert.ok(opened > 0); assert.equal(closed, opened * 2);
    scene.setGeoState({ ...options.geoState, appearanceTimeMs: options.geoState.timeMs + 86400000 });
    const obsolete = scene.whenRendered; scene.dispose();
    assert.equal(await obsolete, false);
    assert.equal(closed, opened * 2, 'both ports of abandoned work must be released');
  });
});

test('a scene first mounted while hidden paints its current phase synchronously on resume', async () => {
  await withDeferredFactory(async ({ mount, target, release }) => {
    const t = target(), options = loadingOptions(Date.parse('2026-11-06T11:00:00Z'));
    t.canvas.ownerDocument.hidden = true; const pending = mount(t.canvas, options); release(); const scene = await pending;
    assert.equal(t.frames.length, 0); assert.equal(t.canvas.dataset.moonDetail, 'paused');
    t.canvas.ownerDocument.hidden = false; scene.renderFrame();
    assert.equal(t.frames.length, 1, 'the first visible task must show a phase before detailed work yields');
    assert.equal(t.canvas.dataset.moonDetail, 'loading');
    assert.ok(t.pixels.some(value => value));
    await scene.whenRendered; assert.equal(t.frames.length, 2); assert.equal(t.canvas.dataset.moonDetail, 'terrain');
    scene.dispose();
  });
});

test('a selected context cancelled while hidden stays invalidated after visibility resumes', async () => {
  await withDeferredFactory(async ({ mount, target, release }) => {
    release(); const t = target(), time = Date.parse('2026-11-06T11:00:00Z'), options = loadingOptions(time), scene = await mount(t.canvas, options);
    scene.setGeoState({ ...options.geoState, appearanceTimeMs: time + 1 }); const interrupted = scene.whenRendered;
    t.canvas.ownerDocument.hidden = true; assert.equal(await interrupted, false);
    t.canvas.ownerDocument.hidden = false;
    assert.equal(scene.renderFrame(), true, 'an uncommitted context cannot reuse the preceding context cache');
    assert.equal(await scene.whenRendered, true); assert.equal(Number(t.canvas.dataset.moonRenderedAt), time + 1);
    scene.dispose();
  });
});

test('deferred terrain exposes a live phase scene that accepts selections during map loading', async () => {
  await withDeferredFactory(async ({ mount, target, release }) => {
    const t = target(), options = loadingOptions(Date.parse('2026-11-06T11:00:00Z'));
    const scene = await mount(t.canvas, { ...options, deferTerrain: true });
    assert.equal(t.canvas.dataset.moonDetail, 'loading'); assert.equal(t.frames.length, 1);
    const selected = Date.parse('2026-11-24T14:53:00Z');
    scene.setGeoState({ ...options.geoState, appearanceTimeMs: selected });
    assert.equal(Number(t.canvas.dataset.moonRenderedAt), selected, 'fallback phase must follow selection without waiting for maps');
    release(); assert.equal(await scene.whenReady, scene);
    assert.equal(t.canvas.dataset.moonDetail, 'terrain'); assert.equal(Number(t.canvas.dataset.moonRenderedAt), selected);
    scene.dispose();
  });
});
