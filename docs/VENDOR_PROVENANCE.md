# Vendor provenance and remaining source boundaries

Verified on 2026-10-09 against the canonical checkout and the official upstream
repositories. This records observed versions, hashes, and recovery limits; it is
not a complete legal or transitive dependency audit.

## Repository metadata

The root `LICENSE` is MIT and was added in commit
`6b6742e89247f9a590aeda0cc39f22a05c96c1d8`. The root package license metadata in
`package.json` and `package-lock.json` now agrees with that existing text.
`private: true` is retained. These metadata changes do not relicense third-party
code, fonts, images, or other assets.

## Weather runtime

The checked-in widget bundles remain the runtime used by the site. The following
identifiers are present in their executable code:

| Local bundle                                                    | Observed identifier                                              | SHA-256                                                            |
| --------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| `3d-weather-codrops-main/dist-widget/react-vendor-DdSZTPSL.mjs` | React and React DOM `19.1.1`                                     | `d71de63f3953e606b27c363dcd3696ab527c13aac2f9886ae2a7ee2c991a970b` |
| `3d-weather-codrops-main/dist-widget/weather-3d-CKX6ob-m.mjs`   | Three.js `REVISION` is `179`; React renderer version is `19.1.1` | `b97ea3338512b0410e72b51008e307b9f03d9d0535d93e92753588187f56d5e2` |

[`THIRD_PARTY_LICENSES.txt`](../3d-weather-codrops-main/dist-widget/THIRD_PARTY_LICENSES.txt)
contains the unmodified MIT license texts from the official
[React v19.1.1 tag](https://github.com/react/react/blob/v19.1.1/LICENSE) and
[Three.js r179 tag](https://github.com/mrdoob/three.js/blob/r179/LICENSE), including
their original copyright notices and source URLs. React and React DOM share the
React repository license. The observed Three.js revision does not establish its
patch version or an exact match to an unmodified upstream build.

Axios `1.15.1` is additionally identified by the executable `AXIOS_VERSION`
and `axios.VERSION` bindings in the weather service. Its complete unmodified
[official v1.15.1 license](https://github.com/axios/axios/blob/v1.15.1/LICENSE)
is appended to the runtime notice file. The existing React/Three notice bytes
remain intact; [recorded hashes](vendor/weather/components.json) verify the
license source and preserved original notice prefix. This identifies the version
marker and license; it does not prove a byte-identical upstream Axios build.

The [Codrops article by Carter Rink](https://tympanus.net/codrops/2025/09/18/creating-an-immersive-3d-weather-visualization-with-react-three-fiber/)
links to the [upstream application](https://github.com/cartuhok/3d-weather-codrops/tree/909370d0240cf5b1c487c66c03336dc38196296c).
The inspected upstream revision is
`909370d0240cf5b1c487c66c03336dc38196296c`; it uses a Create React App source/build
layout. Its React and Three.js dependency ranges are consistent with the local
runtime identifiers. This is an upstream reference, not proof that it is the
corresponding source of the local Rolldown bundles and widget wrappers.

The local repository is not shallow. Its earliest weather commit (`b19efe3`)
already contains built widget files. Focused history searches for this widget's
source directory, package files, and build configuration found no corresponding
tracked source. The inspected upstream tree has no root license file; Codrops
publishes a [general demo licensing policy](https://tympanus.net/codrops/licensing/),
which does not establish the complete provenance of local modifications or
bundled third-party assets.

The [maintained weather project](../3d-weather-codrops-main/README.md) now contains
readable JavaScript reconstructed from six authored runtime modules at `ad3f691`,
a locked builder, baseline canonical hashes, and explicit vendor inputs. Initial
canonical equivalence and 24 desktop/mobile browser comparisons across the three
entry variants and four locales passed. This reconstructs maintainable executable
source; it does not recover the original JSX project or the original dependency
lock. Other bundled libraries, fonts, and textures retain separate provenance
boundaries; the React/Three notices do not relicense those assets.

## Obsidian plugin runtimes

The vault uses the eight plugins listed in
`knowledge/.obsidian/community-plugins.json`. Their installed `main.js`,
`styles.css`, manifests, and settings remain intact. The production copy list in
`tools/build-production.js` excludes `knowledge`, so these plugins are not site
deployment inputs.

The table compares each installed `main.js` against the binary asset from its
official release. A matching hash establishes byte equality for that file, not
complete license coverage of all dependencies. Release/source tags below are
version-specific; recorded SHA-256 hashes detect changes to those assets.

| Plugin directory             | Local manifest version | Official release and source tag                                                                                                                                                                                | Runtime comparison                                                                                 | Own upstream license                                                                                                                   |
| ---------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `calendar-beta`              | `2.0.0`                | [2.0.0-beta.2](https://github.com/liamcain/obsidian-calendar-plugin/releases/tag/2.0.0-beta.2), [source](https://github.com/liamcain/obsidian-calendar-plugin/tree/f5c39c4e4a4ddc8c111d5f992c7976a711fa2e09)   | Exact byte match                                                                                   | No root license file at this source tag; do not infer terms from the current default branch                                            |
| `dataview`                   | `0.5.68`               | [0.5.68](https://github.com/blacksmithgu/obsidian-dataview/releases/tag/0.5.68), [source](https://github.com/blacksmithgu/obsidian-dataview/tree/29b1ad87e1f2b964b4fa0c209f11d0622469bdb0)                     | Mismatch includes changed paragraph rendering code                                                 | [MIT](https://github.com/blacksmithgu/obsidian-dataview/blob/0.5.68/LICENSE.txt)                                                       |
| `obsidian-excalidraw-plugin` | `2.27.2`               | [2.27.2](https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/2.27.2), [source](https://github.com/zsviczian/obsidian-excalidraw-plugin/tree/1c8b10130a8d4db4ba03c680549da6e7ed5ce61e)         | Matches after removing only the local trailing `/* nosourcemap */` comment and terminal whitespace | [AGPL version 3](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/2.27.2/LICENSE)                                          |
| `obsidian-git`               | `2.39.0`               | [2.39.0](https://github.com/Vinzent03/obsidian-git/releases/tag/2.39.0), [source](https://github.com/Vinzent03/obsidian-git/tree/4011f9a21e26cb08bd2dd68899c8a5d4d0111e70)                                     | Exact byte match                                                                                   | [MIT](https://github.com/Vinzent03/obsidian-git/blob/2.39.0/LICENSE); bundle also contains an LGPL-3.0-or-later ZenFS component notice |
| `obsidian-style-settings`    | `1.0.9`                | [1.0.9](https://github.com/community-archive/obsidian-style-settings/releases/tag/1.0.9), [source](https://github.com/community-archive/obsidian-style-settings/tree/4ebec6ae0131a9d5e8307bb5e26d59db5ba2e81c) | Exact byte match                                                                                   | [GPL version 3](https://github.com/community-archive/obsidian-style-settings/blob/1.0.9/LICENSE.md)                                    |
| `obsidian-tasks-plugin`      | `8.4.0`                | [8.4.0](https://github.com/obsidian-tasks-group/obsidian-tasks/releases/tag/8.4.0), [source](https://github.com/obsidian-tasks-group/obsidian-tasks/tree/8.4.0)                                                | Matches after removing only the local trailing `/* nosourcemap */` comment and terminal whitespace | [MIT](https://github.com/obsidian-tasks-group/obsidian-tasks/blob/8.4.0/LICENSE)                                                       |
| `periodic-notes`             | `0.0.17`               | [0.0.17](https://github.com/liamcain/obsidian-periodic-notes/releases/tag/0.0.17), [source](https://github.com/liamcain/obsidian-periodic-notes/tree/0.0.17)                                                   | Different bundle size/layout; equivalence not established                                          | [MIT](https://github.com/liamcain/obsidian-periodic-notes/blob/0.0.17/LICENSE)                                                         |
| `templater-obsidian`         | `2.25.0`               | [2.25.0](https://github.com/SilentVoid13/Templater/releases/tag/2.25.0), [source](https://github.com/SilentVoid13/Templater/tree/2.25.0)                                                                       | Exact byte match                                                                                   | [AGPL version 3](https://github.com/SilentVoid13/Templater/blob/2.25.0/LICENSE.TXT)                                                    |

Installed file hashes, calculated from raw bytes:

| Plugin directory             | Local `main.js` SHA-256                                            | Official release `main.js` SHA-256                                 |
| ---------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `calendar-beta`              | `64d1c6c620803246724bc922c5c2e0a17c406ffc23f6bbcfbfb14c643958fbb7` | `64d1c6c620803246724bc922c5c2e0a17c406ffc23f6bbcfbfb14c643958fbb7` |
| `dataview`                   | `6bb1cf7010afad830e73575fca0e2bfbd3279c562e3d9d24f2d2f45161eb7d00` | `794e9eaede73920bb8d54b0eda4f5de2182d698cc638774500f24f14bcd4da0b` |
| `obsidian-excalidraw-plugin` | `8c2ee2329efab38b90e0f948cab4ea662c258e2ba1a0cdd651a6a9fe65f21808` | `e9f57701f6e48e0a2136ed86b45c05ee512de95a2cfb70db1528419df511b885` |
| `obsidian-git`               | `d5a74036cf17c1a02957c1f33f59e47cf3af83525641c4374ca1fa09d95f3eb4` | `d5a74036cf17c1a02957c1f33f59e47cf3af83525641c4374ca1fa09d95f3eb4` |
| `obsidian-style-settings`    | `1828abaacdab4c5578b705a625c585b30512f8efad4c7cfc5a18e70cc3557468` | `1828abaacdab4c5578b705a625c585b30512f8efad4c7cfc5a18e70cc3557468` |
| `obsidian-tasks-plugin`      | `2b4f9ce24d26f1d0cb191dca9a73477454d256e03e51d81f37faeee7a293ad1b` | `c1e3333bce3fee7c1a06397ea2989cd27e1659cc30795c53ed5a60e7941e48fa` |
| `periodic-notes`             | `934ca94359b6a4b9f02093d4a44fa59654c5237b31cf02d7b982c58168851bb1` | `ccf1a18673693d1036fc7614c3af9d23e5edfe425d1053df81dddcc29b1f8b0e` |
| `templater-obsidian`         | `6a29790e8ad3bb3de5bcc7381588f20093b2dbecc1ff27d8a5d7ed3fcebbdf4e` | `6a29790e8ad3bb3de5bcc7381588f20093b2dbecc1ff27d8a5d7ed3fcebbdf4e` |

The [retained plugin evidence](vendor/obsidian/README.md) includes seven complete
upstream license files, six complete sets of existing in-bundle notices, immutable
source commits, and a hash verifier. Exact local runtime restoration from official
release bytes is verified for Dataview and Periodic Notes using retained deltas.
Dataview's executable paragraph change and source-map change are recorded in a
compact transformation; Periodic Notes' different esbuild runtime is retained as
a complete runtime patch without claiming upstream semantic equivalence. The
ZenFS-derived path component in Obsidian Git also has its version-specific
isomorphic-git source retained.

Calendar's historical package declares MIT, although its source tag has no license
file. Excalidraw and Style Settings package metadata says MIT while their same-tag
license files contain AGPL v3 and GPL v3; both facts are preserved. Source links
and copied notices do not by themselves constitute a new source offer or a full
legal assessment of every transitive dependency.

Plugin runtime files remain tracked because the vault relies on them. Merely
retaining a manifest and `community-plugins.json` does not restore executable
plugins in a fresh checkout. Obsidian's
[installation documentation](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin)
requires `main.js`, `manifest.json`, and optional `styles.css` from a release.
Removing tracked runtimes could also delete them when another existing checkout
pulls that commit. Any future switch to locally installed plugins needs a tested
restoration procedure and preservation of settings before changing this policy.
