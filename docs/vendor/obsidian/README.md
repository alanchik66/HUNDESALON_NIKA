# Installed Obsidian plugin provenance

This directory retains the license texts and notices reviewed for the vault's
installed plugin runtimes. No plugin executable or user setting was replaced.
The production builder excludes the vault and these documents.

## Exact inputs

[plugins.json](plugins.json) records the installed runtime SHA-256, source commit,
release tag, package license declaration, complete copied license, its exact
source URL and SHA-256, and retained in-bundle notices. Source archive links use
immutable commits rather than the default branch. They include upstream build
configuration and dependency lock files where upstream tracks them.

Run the local integrity check from the repository root:

```text
node docs/vendor/obsidian/verify.mjs
node docs/vendor/obsidian/verify.mjs --upstream-dir output/plugin-provenance
```

The second command additionally verifies exact recovery of both modified plugin
runtimes when the official release files are available under that directory as
`dataview.upstream-main.js` and `periodic-notes.upstream-main.js`.
The checker verifies their published release hashes before applying any delta.
It reads plugin code as bytes and never executes the installed plugins.

## Local changes

Dataview 0.5.68 contains one executable change: inline paragraph rendering moves
all children in order, rather than only the last child. The compact
[transformation](dataview.runtime-transform.json) retains that exact replacement
and the accompanying inline source-map mapping change. Applying it to the
verified official release restores the installed SHA-256 byte for byte.
The inline maps contain source paths, but do not contain TypeScript source text.

Periodic Notes 0.0.17 has a different esbuild-generated runtime from its official
Rollup release. Its [runtime patch](periodic-notes.runtime.patch), applied with
`git apply --unidiff-zero`, restores the installed bytes exactly. This records the
local executable delta; it does not establish that the original TypeScript build
project or semantic equivalence to the official release has been recovered.
The existing runtime is retained because the vault uses it.

## License facts

Seven complete upstream license files are copied without rewriting them.
Calendar's verified historical package declares MIT, but no license file was
found at that source tag. No copyright notice was invented for that plugin.

Excalidraw and Style Settings declare MIT in their package metadata while their
same-revision license files contain AGPL v3 and GPL v3 respectively. Both facts
are recorded. These documents do not resolve that upstream inconsistency by
relabeling the bundled code. Templater's source contains AGPL v3.

The Obsidian Git bundle contains a ZenFS-derived path component explicitly marked
LGPL-3.0-or-later. Its corresponding isomorphic-git 1.40.0
[source](sources/isomorphic-git-join.js) and the original full in-bundle notice
are retained, together with the full [LGPL-3.0-or-later text](LGPL-3.0-or-later.txt).
The license text also includes the GPL v3 terms it extends. Other transitive components remain governed by their own terms;
plugin top-level license declarations do not relicense those dependencies.

This is an evidence and restoration record, not a claim that a complete legal
assessment or a new source offer has been made. The original root repository
MIT license applies to original project code and does not override these terms.
