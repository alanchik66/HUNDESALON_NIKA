/* A shared composition range, independent of astronomical altitude or time. */
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export function skyVerticalRange(height, radius, scale = 1) {
  const top = Math.min(radius + 4 * scale, Math.max(0, height) / 2);
  const bottom = Math.max(top, height - radius - 4 * scale);
  // Lift the lower sky gently; a narrow frame keeps its complete-disc fallback.
  const lift = Math.min(radius * .8, (bottom - top) * .4);
  return { top, bottom: bottom - lift };
}

export function skyLane(region, left, right, radius, scale = 1) {
  const low = Math.max(region.left + radius + 5 * scale, (left?.right ?? region.left) + radius + 5 * scale);
  const high = Math.min(region.right - radius - 5 * scale, (right?.left ?? region.right) - radius - 5 * scale);
  const middle = clamp((low + high) / 2, region.left + radius, region.right - radius);
  const vertical = skyVerticalRange(region.bottom - region.top, radius, scale);
  return { left: low <= high ? low : middle, right: low <= high ? high : middle,
    top: region.top + vertical.top, bottom: region.top + vertical.bottom };
}

/** Measure visible readings, not their stretched grid/flex containers. */
export function measureSkyLane(region, radius, scale = 1) {
  const box = region.getBoundingClientRect();
  const bounds = { ...box, left: box.left, top: box.top,
    right: box.right ?? box.left + box.width, bottom: box.bottom ?? box.top + box.height };
  const preview = region.classList.contains('weather-header-preview');
  const rect = selector => {
    const node = region.querySelector(selector), value = node?.getBoundingClientRect();
    // Nested flex boxes can contain large empty areas, while overflowing glyphs
    // can extend beyond them. Only text-node ranges describe the painted text.
    const text = [];
    if (value?.width > 0 && value?.height > 0 && region.ownerDocument?.createRange) {
      const range = region.ownerDocument.createRange();
      const walker = region.ownerDocument.createTreeWalker?.(node, 4);
      if (walker) {
        for (let current = walker.nextNode(); current; current = walker.nextNode()) {
          if (!current.textContent?.trim()) continue;
          range.selectNodeContents(current);
          text.push(...range.getClientRects());
        }
      } else {
        range.selectNodeContents(node);
        text.push(range.getBoundingClientRect());
      }
    }
    const painted = text.filter(box => box.width > 0 && box.height > 0);
    if (painted.length) return { left: Math.min(...painted.map(box => box.left)), right: Math.max(...painted.map(box => box.right)) };
    return value?.width > 0 && value?.height > 0 ? {
      left: value.left, right: value.right ?? value.left + value.width,
    } : null;
  };
  const control = region.querySelector(preview ? '.weather-header-card__toggle' : '.weather-header-dropdown__hero-chips')?.getBoundingClientRect();
  const minimumBottom = Math.min(bounds.bottom, bounds.top + radius * 2);
  const bottom = control?.height > 0 ? clamp(control.top, minimumBottom, bounds.bottom) : bounds.bottom;
  const leftSelectors = preview
    ? ['.weather-header-card__title-block', '.weather-header-card__temp-row']
    : ['.weather-header-dropdown__hero-title', '.weather-header-dropdown__hero-temp', '.weather-header-dropdown__hero-copy strong', '.weather-header-dropdown__hero-copy > span'];
  const left = { right: Math.max(bounds.left, ...leftSelectors.map(selector => rect(selector)?.right ?? bounds.left)) };
  const right = rect(preview ? '.weather-header-card__metrics-panel' : '.weather-header-dropdown__close');
  return skyLane({ ...bounds, bottom }, left, right, radius, scale);
}
