# Maintained weather widget source

The `src` directory contains JavaScript reconstructed from the authored modules
in the deployed `dist-widget` runtime at repository commit `ad3f691`.
The original JSX project and its build configuration were not recovered. This
is a maintained reconstruction of the existing application, not an independent
rewrite or a claim that the linked Codrops application is corresponding source.

The reconstruction introduces descriptive module bindings and readable
formatting. It retains the deployed JavaScript statements, CSS strings, shaders,
translations, weather request behavior, location handling, and public exports.
Inner compiler-generated bindings remain where renaming them would add risk.

## Build and verification

Run these commands from the repository root after its normal `npm ci`:

```text
node 3d-weather-codrops-main/scripts/build.mjs --check
node --test 3d-weather-codrops-main/scripts/module-source.test.mjs
node 3d-weather-codrops-main/scripts/build.mjs
node 3d-weather-codrops-main/scripts/browser-smoke.mjs
```

The builder uses the root dependency lock and verifies the recorded esbuild
version. It does not install packages or change dependency metadata. Default
output is the Git-ignored `output/weather-source-candidate` directory. A custom
`--out-dir` must remain inside the repository and outside `dist-widget`.
Builds never overwrite the deployed runtime automatically.

The candidate retains existing entry filenames and module URLs, the
`WeatherApp`/`mountWeatherWidget`/`unmountWeatherWidget` exports, the
`window.Weather3DWidget` loader contract, and tracked texture/media paths.
External dependency inputs remain byte-for-byte copies of the recorded vendor
chunks. Generated source maps include the reconstructed sources for debugging.

`--check` reverses only the documented recovery binding names, restores deployed
module URLs, and compares normalized compiler output with the recorded baseline.
Whitespace and descriptive binding names are ignored; literal values, executable
statements, object property names, imports/exports, shaders, and CSS remain part
of the comparison. This establishes initial reconstruction parity; it is not a
replacement for desktop/mobile browser verification.

For an intentional future behavior change, normal builds use the edited source.
The baseline check will fail until the change is reviewed and its baseline is
explicitly updated. Do not regenerate maintained sources from patched runtime
files. The older one-off `tools/patch-weather-*.mjs` scripts are retained for
history, but new changes should be made in `src` and reviewed as candidate builds.

## Production integration

The root production builder regenerates these sources into the separate
`output/weather-production` directory. After copying the existing production
inputs, it overlays only the six authored module outputs and their source maps
inside `dist/3d-weather-codrops-main/dist-widget`. Vendor chunks and tracked media
retain their existing paths and bytes. The checked-in `dist-widget` baseline is
not overwritten by normal builds, so recovery parity and rollback remain
reviewable. New authored behavior belongs in `src`, not in one-off bundle patches.

The browser parity command compares baseline and candidate modules in Chrome:
three entry variants, four locales, desktop/mobile, sunny/rain/snow/storm and
day/night fixtures. It checks rendered text and geometry, finite weather values,
opening the header details, unmount cleanup, the classic loader contract, and
browser errors. Screenshots and the detailed report are written to the ignored
`output/playwright/weather-source-parity` directory. Weather API responses, cloud
texture, and HDR inputs are deterministic fixtures; Unicode font fixtures are
read from the pinned upstream data tag and cached locally. This does not verify
live weather providers or establish additional rights to external assets.

## Module map

| Source                    | Responsibility                                                                                  |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| `src/widget.mjs`          | Full widget UI, locale copy, weather state, shadow-root mounting                                |
| `src/header-preview.mjs`  | Existing header preview variant                                                                 |
| `src/header-dropdown.mjs` | Existing header dropdown scene variant                                                          |
| `src/scene.mjs`           | Existing 3D weather scene, particles, portals, shaders, frame scheduling                        |
| `src/weather-service.mjs` | Existing weather normalization, search, API fallback and cache behavior; retained Axios runtime |
| `src/loader.mjs`          | Classic-script loader exposing `window.Weather3DWidget`                                         |
| `build-manifest.json`     | Recovery origin, baseline hashes, descriptive binding mapping, vendor hashes and toolchain      |

The three UI variants are retained because their deployed layouts differ. Their
shared code can be refactored after the reconstruction passes visual regression
checks; no variant is removed merely because much of its compiled code overlaps.

## Provenance limits

The vendor dependency chunks and the retained Axios dependency code have not
become original project source through this reconstruction. Their licenses and
source provenance remain separate from the authored wrapper reconstruction.
See [the vendor provenance record](../docs/VENDOR_PROVENANCE.md) and
`dist-widget/THIRD_PARTY_LICENSES.txt` for verified components and open boundaries.
