/* A shared composition range, independent of astronomical altitude or time. */
export function skyVerticalRange(height, radius, scale = 1) {
  const top = Math.min(radius + 4 * scale, Math.max(0, height) / 2);
  const bottom = Math.max(top, height - radius - 4 * scale);
  // Lift the lower sky gently; a narrow frame keeps its complete-disc fallback.
  const lift = Math.min(radius * .8, (bottom - top) * .4);
  return { top, bottom: bottom - lift };
}
