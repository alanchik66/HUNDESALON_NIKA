# Native glob matcher for project lint tooling

This private package is original project adapter code, not a renamed copy of
picomatch. Its actual package name is `@hundesalon-nika/native-glob-matcher` and
its only runtime dependency is the official, exact `minimatch@11.0.4` release.
It contains no picomatch implementation, lifecycle scripts, downloaded parser,
dynamic imports, code generation, or network access.

## Supported consumer contract

The adapter targets only `stylelint@18.0.0` and `tinyglobby@0.2.17` as used by
this repository's fixed lint globs. It is not a general picomatch replacement.

- Default factory: one string or an array of strings; returns a Boolean matcher.
- `isMatch(input, patterns, options)`: the same Boolean contract.
- `scan(pattern, options)`: `isGlob`, `negated`, and optional `parts` only.
- Match options: Boolean `dot`, `nobrace`, `nocase`, `noextglob`, `noglobstar`,
  `basename`, and the consumers' `posix: true` marker.
- Scan options: Boolean `parts` only. Scan performs lexical classification and
  path splitting; it does not construct a matching engine or regular expression.
- Basic slash-separated literals, `*`, `?`, whole-segment `**`, one leading `!`,
  one leading `./`, and normalized drive-letter/POSIX absolute patterns.

Unknown options, non-Boolean flags, escaping/backslash patterns, character
classes, braces, parentheses/extglobs, pipe expressions, UNC/double slashes,
repeated leading prefixes, embedded globstars, control characters, over 64
patterns/segments, or patterns over 4096 characters throw before matching.
Disabling syntax with `nobrace`/`noextglob` does not enable rejected syntax.
`makeRe`, `parse`, state objects, match callbacks, and matcher return-state flags
are deliberately absent. A tooling update requiring them must fail and receive
an explicit compatibility review.

Candidate paths may use Windows separators; they are normalized to `/`. Pattern
syntax is POSIX only, like the pinned consumers' normalized patterns. A leading
`./` is removed from patterns, not from candidates. `basename: true` explicitly
uses the candidate's basename even if the pattern contains a slash; merely
enabling Minimatch's `matchBase` would change this behavior.

The terminal `P/**` contract includes `P` itself when globstars are enabled.
The adapter delegates both variants to Minimatch and applies leading negation
once to their combined result. This is necessary because tinyglobby expands
ordinary file globs to terminal `/**` patterns. It avoids silently dropping CSS
files or ignoring directory exclusions.

## Why scan parts matter

tinyglobby uses raw path segments both to choose its crawl root/depth and to
compile directory-pruning matchers. Incorrect parts can reduce lint coverage.
A single leading `./` is omitted; a POSIX root stays attached to its first
segment (`/repo`, not an empty segment); drive-letter segments remain `C:`.
Patterns without slashes yield an empty `parts` array, matching the pinned
consumer contract. No larger parser is implemented to support additional syntax.

## Verification and provenance

`tools/native-glob-matcher.test.mjs` contains ordinary lint-path fixtures captured
from the previously installed picomatch 2.3.2 before replacement. It does not
import the legacy engine or contain exploit reproductions. Tests also check the
actual package identity, exact dependency, single CJS/ESM implementation, and the
implementation's literal dependency graph. These are compatibility/architecture
checks, not audit suppression.

Relevant pinned upstream sources:

- [Stylelint standalone](https://github.com/stylelint/stylelint/blob/18.0.0/lib/standalone.mjs)
- [Stylelint ignoreFiles matching](https://github.com/stylelint/stylelint/blob/18.0.0/lib/isPathIgnored.mjs)
- [Stylelint override matching](https://github.com/stylelint/stylelint/blob/18.0.0/lib/augmentConfig.mjs)
- [tinyglobby crawler](https://github.com/SuperchupuDev/tinyglobby/blob/0.2.17/src/crawler.ts)
- [tinyglobby scan consumers](https://github.com/SuperchupuDev/tinyglobby/blob/0.2.17/src/utils.ts)
- [Official Minimatch API](https://github.com/isaacs/minimatch/blob/v11.0.4/README.md)

The release owner must additionally compare actual CSS file enumeration and run
the existing lint gates after installing the replacement. A clean npm audit is
reported only after a fresh audit of the resulting lockfile; changing a package
label alone is not evidence that an implementation was removed.
