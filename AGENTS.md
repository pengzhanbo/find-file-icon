# Repository Guidelines

## Project Overview

`find-file-icon` — zero-runtime-dependency, pure-ESM TypeScript library mapping a file path to an [Iconify](https://iconify.design) icon name. Two icon sets ship in-tree (`vscode-icons`, `catppuccin`); consumers can also build finders for custom sets. No I/O, no async, no classes: pure synchronous string/table lookups.

## Architecture & Data Flow

```txt
input path (string)
  └─ parseFilePath()          src/core/parse-input.ts    normalize sep, trailing "/" → folder, basename, lowercase
       └─ finder(name, type?) src/core/create-finder.ts  precedence: fileNames → fileStems → longest ext suffix → default
            └─ IconInfo       src/types.ts               { type:'file'|'folder'|'language', name, expandedName? }
```

- `createFinder(iconSet)` runs `transformer(iconSet)` **once at construction**, flattening the declarative `IconSet` into `ResolvedIconSet` lookup tables; the returned closure is O(1) per lookup. Only unmatched names scan `fileStems` and `.`-split suffixes.
- `transformer()` inverts `icon → names[]` into prototype-less `name → icon` maps; stem rules with `exact !== false && extensions !== '*'` are pre-expanded into exact `fileNames` entries (name × extensions cartesian product). Only `exact: false` / `'*'` rules survive as runtime `fileStems`.
- Precedence in `findFile`: (1) exact `fileNames`; (2) `fileStems` in declaration order — `'*'` requires `.` or end after the prefix, array form requires `.` + `endsWith('.'+ext)`; (3) extension scan from the **first** `.` outward → longest suffix wins (`.js.map` before `.js`). Folders match by exact name only. `languageIds` is a flat `language id → icon` table reached through an explicit `type: 'language'`, and also consulted last in the untyped inference (file → folder → language → default file icon); unlike file names it is case-insensitive — `transformer` normalizes the keys with `normalizeLanguageId` (trim + lower-case), the finder applies the same rule to the input instead of path-parsing it, and an unmatched id falls back to the default file icon.
- Final name = `` `${collect}:${filePrefix}${icon}` ``; folder expanded = name + `folderExpandedSuffix`; language icons reuse the file prefix.
- Entries: `src/index.ts` → `findFileIcon` + `createFinder` + types; `src/vscode-icons.ts` / `src/catppuccin.ts` are one-line `createFinder(...)` consts re-exporting types; `src/core/create-finder.ts` is published as `./core` (lookup logic alone, no icon data) and `src/icon-set/*.ts` as `./icon-set/*` (raw `IconSet` literals).

## Key Directories

| Path            | Purpose                                                                                                                          |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/`     | Logic: `parse-input.ts`, `create-finder.ts`, `transformer.ts`, `internal-types.ts`                                               |
| `src/icon-set/` | Bulk **data only** IconSet literals: `vscode-icons.ts`, `catppuccin.ts` (each starts `// oxlint-disable max-lines`)              |
| `src/*.ts`      | Package entries + `types.ts` (public contract, single source of truth)                                                           |
| `test/`         | Flat vitest suites mirroring `src/core` modules + `entry.test.ts` for the public surface                                         |
| `scripts/`      | `validate.ts` (report) + `checks.ts` (pure QA checks) + `common.ts` (icon sets ↔ Iconify datasets), `ignore-icons.ts` allowlists |
| `dist/`         | tsdown output; gitignored and formatter/linter-ignored — never edit by hand                                                      |
| `.github/`      | `workflows/lint.yaml` + `workflows/test.yaml` — CI on push/PR to `main`                                                          |

## Development Commands

```bash
pnpm install    # pnpm ^12.6.0 via devEngines (auto-download); Node >=20.19.0 via engines
pnpm test       # vitest --coverage (coverage always on, v8; watches locally, single run when CI=true)
pnpm lint       # oxlint . --type-check --type-aware && oxfmt . --check
pnpm format     # oxlint ... --fix && oxfmt .   (the fix/format pass)
pnpm build      # tsdown → dist/ (ESM + d.ts; regenerates package.json#exports; runs publint on the packed tarball)
pnpm validate   # tsx scripts/validate.ts — icon names vs @iconify-json datasets (exit 1 on errors)
pnpm release    # bumpp: `-x "pnpm build"` runs first (publint gate), then version + commit + tag + push
```

- There is **no** `typecheck` script — type checking happens inside `oxlint --type-check --type-aware`; run `pnpm lint` after any `src/` change.
- `pnpm lint:action` is the same check with GitHub annotations, used by CI.
- Pre-commit (`simple-git-hooks` → `nano-staged`): `*.{js,ts,mjs,cjs}` → `pnpm run lint`; `src/**/*.ts` → `vitest related --run`; `src/icon-set/**/*.ts` → `pnpm run validate`; everything else → `oxfmt --no-error-on-unmatched-pattern`.
- Single suite: `pnpm vitest --run test/create-finder.test.ts` (`@vitest/ui` is not installed). Add `--run` to `pnpm test` for a single pass.

## Code Conventions & Common Patterns

- **Formatting** is entirely the `@pengzhanbo/oxc-config` preset — no local rules in `oxfmt.config.ts`/`oxlint.config.ts`. Never hand-format: `semi: false`, single quotes, `trailingComma: 'all'`, `bracketSpacing: true`, `quoteProps: 'consistent'`, 2-space indent, LF, oxfmt-sorted imports.
- **Imports** — always ESM with explicit `.js` extensions on relative specifiers (`./core/create-finder.js`), even in `.ts`; type-only imports use `import type { … }` (`verbatimModuleSyntax` on). `.vscode/settings.json` disables `organizeImports` — import order comes from oxfmt.
- **`isolatedDeclarations` + explicit-return-type lint rule**: every exported symbol needs an explicit annotation, e.g. `export function createFinder(iconSet: IconSet): IconFinder`.
- **Naming**: kebab-case filenames (`parse-input.ts`), camelCase values, PascalCase types, `SCREAMING_SNAKE_CASE` module regexes (`RE_SLASH`). Public types live in `src/types.ts`, module-private ones in `internal-types.ts`. Named exports only, no defaults.
- **Never throw at lookup time, never return `null`** — internal lookups return `T | undefined`; public finders always resolve a concrete `IconInfo` via `defaultFileIcon` / `defaultFolderIcon` / `defaultLanguageIcon`, and non-string input is treated as an empty path. The single exception is construction: `createFinder` validates the **required fields only** (`collect`, `defaults`), throwing a readable `TypeError` listing them instead of failing later with `Cannot read properties of undefined`. Table and rule shapes are a type-level contract with no runtime check, so a JSON or plain-JS `IconSet` that does not match the types can resolve to wrong icons rather than throwing. Diagnostics in `scripts/` stay `console.warn` output, not exceptions.
- **Prototype safety is a hard invariant**: lookup maps built with `Object.create(null)`, read through `hasOwn(obj, key)`; `test/create-finder.test.ts` covers names like `toString`/`constructor`.
- **Functional style**: `const` closures created per finder; the input `IconSet` is never mutated (tests assert); data tables stay frozen-by-convention literals.
- **Comments/JSDoc are Chinese**, with bilingual EN+zh blocks on public API (`src/types.ts`, entries, `findFileIcon`); internal helpers use a single Chinese block. Match the existing shape when touching public docs.
- **Icon data is authored declaratively**: add `icon → names[]` entries in `src/icon-set/*.ts` (keep `fileStems` keys alphabetically grouped), then run `pnpm validate`.
- README.md and README.zh-CN.md are line-aligned mirrors; a user-visible change updates **both**.

## Important Files

- `src/index.ts` — root entry, re-export only (excluded from coverage).
- `src/types.ts` — public contract: `IconSet`, `IconFinder`, `IconInfo`, `LanguageIconInfo`, `IconSetStemRule`; the long bilingual `IconFinder` docblock specifies the `type`-argument semantics (including the `'language'` case). `IconSetStemRule` is a union that makes `'*'` and `exact` mutually exclusive by type.
- `src/core/create-finder.ts` — lookup precedence and default-icons logic.
- `src/core/transformer.ts` — `IconSet` → `ResolvedIconSet` flattening.
- `tsdown.config.ts` — 5 entries (`index`, `vscode-icons`, `catppuccin`, `core`, `icon-set/*`), `clean`, `dts`, `format: 'esm'`, `exports: true`, `publint: true`, `fixedExtension: false`; no `onSuccess` or any other hook, so `dist/*.js` is raw rolldown output (double quotes, semicolons) that is neither comment-stripped nor oxfmt-formatted. `exports: true` **regenerates `package.json#exports` on every build** — treat that field as build output and never hand-edit it; the authoritative subpath list is whatever `pnpm build` writes. Subpath types resolve from the adjacent `dist/*.d.ts`, so no `types` condition is needed. `publint: true` requires the `publint` devDependency (an optional peer of tsdown) and, after bundling, packs the tarball and lints it — **error-level findings set a non-zero exit code, warnings/suggestions are logged only**, so read the `[publint]` line rather than trusting a green build.
- `package.json` — `exports` (generated; see `tsdown.config.ts` above), scripts, `engines`/`devEngines`, pre-commit config.
- `scripts/validate.ts` — icon-data QA report per icon set: unknown icons, unmatchable entries, duplicate matches and stem order ambiguity. Read-only; exits 1 when an error (unknown icon, unmatchable entry or duplicate match) is found, `顺序歧义` is warning-only.
- `scripts/checks.ts` — pure check functions (`findUnknownIcons`, `partitionUnusedIcons`, `findDuplicateMatches`, `findUnmatchableEntries`, `findUnstableStemKeys`, `findShadowedStems`); matching is always evaluated through `transformer()` output, a probe finder, or rule ablation, so the matching rules are never re-implemented. This includes `languageIds`, whose keys are compared after `normalizeLanguageId` so declarations differing only in case are still detected as duplicates. `findUnmatchableEntries` is the one structural exception: it reports entries that can never be reached because of input lower-casing, leading-dot extensions, empty extension lists, or (for language ids) empty and whitespace-padded keys.
- `scripts/common.ts` — icon set + Iconify dataset pairs (`iconSetSources`) and `collectUsedIcons()`, which reuses `transformer()` for prefix/expanded-suffix derivation — never hardcode `folder-type-`/`-opened`/`-open` again.
- `scripts/ignore-icons.ts` — hand-maintained allowlists with Chinese rationale comments.

## Runtime/Tooling Preferences

- ESM only (`"type": "module"`, `sideEffects: false`); ship `dist` only. Node `>=20.19.0` (enforced by `engines`), pnpm `^12.6.0` (enforced by `devEngines.packageManager`). Single project — `pnpm-workspace.yaml` holds settings, not a `packages:` list.
- TypeScript via `@pengzhanbo/tsconfig` (ESNext/bundler, `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `isolatedDeclarations`).
- Build: tsdown 0.23 (`tsdown` CLI); test: vitest 5; lint/format: oxlint + oxfmt through the shared oxc preset (the same commands back the pre-commit hook).
- CI: `.github/workflows/lint.yaml` (`pnpm run lint:action`) and `.github/workflows/test.yaml` (`pnpm run test`, Node 24) run on push/PR to `main` and install with `pnpm ci`. **CI deliberately does not build** — the publish path is gated instead: `pnpm release` passes `-x "pnpm build"` to bumpp, which runs the build (and publint) _before_ committing/tagging/pushing (`bumpp` runs `execute` with `throwOnError`, so a failure aborts the release with no tag created); `pnpm release:publish` re-runs it via the `prepublishOnly` hook. No changesets in-repo.

## Testing & QA

- Vitest with `@vitest/coverage-v8`; config lives **only** in `vitest.config.ts` (`include: ['**/*.test.[tj]s']`, `env: { TZ: 'Etc/UTC' }`, coverage `enabled: true`, `exclude: [...defaults, 'src/index.ts', 'scripts/**']`). **No coverage thresholds — don't invent a gate.**
- Tests are flat, one file per module, importing sources directly: `import { parseFilePath } from '../src/core/parse-input.js'`. `test/checks.test.ts` is the only suite aimed at `scripts/`, which stays out of coverage. Explicit `import { describe, expect, it } from 'vitest'` — globals are **off**; no mocks, snapshots, fixtures, or setup files.
- Assert behavior contracts, not implementation: matching precedence, longest-suffix extension resolution, wildcard stem rules, `expandedName`, language-id lookup (explicit `type: 'language'`, or last in the untyped inference, trimmed/lower-cased, path input not parsed), default fallbacks, prototype safety, non-mutation of the source `IconSet`. Data assertions use `.toEqual({...})` against inline literal `IconSet` objects built with two-line `file()`/`folder()` factories.
- `test/entry.test.ts` proves the public entries equal the real icon-set finders and is the only suite exercising real `@iconify-json` data; a new entry point needs a case there.
- For icon-data edits, `pnpm validate` is the acceptance step — review the `未知图标：`, `永不命中的条目：`, `重复匹配：` and `顺序歧义：` output; the script is read-only and exits 1 on unknown icons, unmatchable entries or duplicate matches.
