/* The worker runs the same lunar surface function as the main-thread fallback. */
let maps, rendererImportPromise;
const vector = value => value && ['x', 'y', 'z'].every(key => Number.isFinite(value[key]));

function renderer() {
  if (!rendererImportPromise) {
    rendererImportPromise = import(new URL(`./header-weather-moon-scene.js${new URL(import.meta.url).search}`, import.meta.url).href);
    rendererImportPromise.catch(() => {});
  }
  return rendererImportPromise;
}

async function receive(input) {
  if (input?.type === 'init') {
    const value = input.maps, pixels = value?.width * value?.height;
    if (maps || !Number.isInteger(value?.width) || !Number.isInteger(value?.height) || value.width !== 2 * value.height
      || value.height <= 0 || value.width > 4096 || !(value.albedo instanceof Uint8Array) || value.albedo.length !== pixels * 3
      || !(value.heightData instanceof Uint16Array) || value.heightData.length !== pixels) throw new Error('Invalid lunar worker maps.');
    maps = value; await renderer(); globalThis.postMessage({ type: 'ready' }); return;
  }
  if (input?.type !== 'render' || !maps || !Number.isSafeInteger(input.id) || input.id <= 0) throw new Error('Invalid lunar worker request.');
  const lighting = input.lighting, values = input.options || {};
  const options = { size: values.size ?? 384, discFraction: values.discFraction ?? .51,
    earthshine: values.earthshine !== false, terrain: values.terrain !== false };
  if (!lighting?.valid || !vector(lighting.northDirection) || !vector(lighting.sunDirectionBody) || !vector(lighting.observerDirectionBody)
    || !['x', 'y', 'z'].every(axis => vector(lighting.bodyToView?.[axis])) || !Number.isFinite(lighting.illuminatedFraction)
    || lighting.illuminatedFraction < 0 || lighting.illuminatedFraction > 1 || !Number.isInteger(options.size) || options.size < 1 || options.size > 1024
    || !Number.isFinite(options.discFraction) || options.discFraction <= 0 || options.discFraction > 1) throw new Error('Invalid lunar worker surface.');
  const { renderLunarPixels } = await renderer();
  const frame = renderLunarPixels(lighting, maps, options);
  globalThis.postMessage({ type: 'frame', id: input.id, frame }, [frame.data.buffer]);
}

// Install before starting any asynchronous dependency load. A module suspended
// in top-level await can otherwise discard the one initial maps message.
globalThis.addEventListener('message', event => receive(event.data).catch(error => {
  try { globalThis.postMessage({ type: 'error', id: event.data?.id, message: error?.message || 'Lunar worker failed.' }); }
  catch { /* A closing worker has no client left to notify. */ }
}));
