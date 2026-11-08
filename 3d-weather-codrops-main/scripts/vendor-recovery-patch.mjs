/**
 * Generated-runtime corrections after build.mjs verifies the original vendor SHA.
 * Keep the recorded input/provenance intact; fail closed if either anchor drifts.
 */
export function patchWeatherVendorRecovery(source, filename) {
  if (filename !== 'weather-3d-CKX6ob-m.mjs') return source;
  const patches = [
    // Canvas's async configure rejection must enter its existing React error state.
    ['        n();\n      }\n    }),\n    Q.useEffect(() => {\n      let e = E.current;',
      '        n().catch(ee);\n      }\n    }),\n    Q.useEffect(() => {\n      let e = E.current;'],
    // A constructor failure has no Scene, but its root still needs to be released.
    ['                gg(i.scene),\n                b_.delete(e),',
      '                i.scene && gg(i.scene),\n                b_.delete(e),'],
  ];
  for (const [before, after] of patches) {
    const index = source.indexOf(before);
    if (index < 0 || source.indexOf(before, index + before.length) >= 0) {
      throw new Error(`Weather vendor recovery anchor must occur exactly once: ${filename}`);
    }
    source = source.slice(0, index) + after + source.slice(index + before.length);
  }
  return source;
}
