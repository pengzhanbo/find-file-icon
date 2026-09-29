# find-file-icon

[![npm version](https://img.shields.io/npm/v/find-file-icon.svg)](https://www.npmjs.com/package/find-file-icon)
[![license](https://img.shields.io/npm/l/find-file-icon.svg)](https://github.com/pengzhanbo/find-file-icon/blob/main/LICENSE)

English | [简体中文](README.zh-CN.md)

Turns a file path into an [Iconify](https://iconify.design/) icon name — the same lookup an editor's file tree performs, without the editor.

```ts
import { findFileIcon } from 'find-file-icon'

findFileIcon('src/components/Button.vue')
// { type: 'file', name: 'vscode-icons:file-type-vue' }

findFileIcon('src/')
// { type: 'folder', name: 'vscode-icons:folder-type-src', expandedName: 'vscode-icons:folder-type-src-opened' }

findFileIcon('unknown.xyz')
// { type: 'file', name: 'vscode-icons:default-file' }
```

Every lookup is a synchronous table read: no I/O, no async, no runtime dependencies. The package is ESM-only, and each icon set sits behind its own subpath, so importing one never pulls in the other's data.

## Install

```bash
pnpm add find-file-icon
npm install find-file-icon
yarn add find-file-icon
```

## Usage

### Choose an icon set

The root entry resolves against `vscode-icons`. For the other set, import its subpath:

```ts
import { findFileIcon as catppuccinIcon } from 'find-file-icon/catppuccin'
import { findFileIcon as vscodeIcon } from 'find-file-icon/vscode-icons'

catppuccinIcon('src/components/Button.vue')
// { type: 'file', name: 'catppuccin:vue' }

catppuccinIcon('src/')
// { type: 'folder', name: 'catppuccin:folder-src', expandedName: 'catppuccin:folder-src-open' }

vscodeIcon('package.json')
// { type: 'file', name: 'vscode-icons:file-type-npm' }
```

### Render the result

`name` is a complete Iconify icon name; hand it to any Iconify renderer as-is.

```ts
// Vue
import { Icon } from '@iconify/vue'
// <Icon :icon="findFileIcon('src/index.ts').name" />
```

```html
<!-- Web Component -->
<iconify-icon icon="vscode-icons:file-type-vue"></iconify-icon>
```

### Bring your own icon set

`createFinder` compiles any `IconSet` into a finder. Both built-in sets are built this way, and it is how you reach an icon set this package does not ship:

```ts
import { createFinder, type IconSet } from 'find-file-icon'

const myIcons: IconSet = {
  collect: 'my-icons',
  // Icon name prefixes, and the suffix for expanded folders
  filePrefix: 'file-',
  folderPrefix: 'folder-',
  folderExpandedSuffix: '-opened',
  // Returned when nothing matches
  defaults: { file: 'default-file', folder: 'default-folder' },
  // Icon name -> exact file names
  fileNames: { markdown: ['readme.md'] },
  // Icon name -> exact folder names
  folderNames: { src: ['src', 'source'] },
  // Icon name -> extensions, without the leading dot
  fileExtensions: { typescript: ['ts', 'tsx'] },
  // Icon name -> file name rules
  fileStems: { dotenv: [{ name: '.env', extensions: '*' }] },
  // Icon name -> VS Code language ids
  languageIds: { typescript: ['typescript', 'ts'] },
}

const findIcon = createFinder(myIcons)

findIcon('src/index.ts')
// { type: 'file', name: 'my-icons:file-typescript' }

findIcon('src/')
// { type: 'folder', name: 'my-icons:folder-src', expandedName: 'my-icons:folder-src-opened' }
```

Only `collect` and `defaults` are required: a collection prefix and a fallback icon, without which no icon name can be assembled. The five lookup tables are optional and default to empty, so a set only needs to declare the parts it uses.

`createFinder` is also exported from `find-file-icon/core`, which carries the lookup logic alone, with no icon set data attached. Both built-in sets are published as raw `IconSet` definitions under `find-file-icon/icon-set/vscode-icons` and `find-file-icon/icon-set/catppuccin`, so a custom set can extend one instead of starting from scratch:

```ts
import { createFinder } from 'find-file-icon/core'
import { vscodeIcons } from 'find-file-icon/icon-set/vscode-icons'

const findIcon = createFinder({
  ...vscodeIcons,
  fileExtensions: { ...vscodeIcons.fileExtensions, typescript: ['ts', 'tsx'] },
})
```

## API

### `findFileIcon(input, type?)`

The finder exported by the root entry and by every icon set subpath.

- `input: string` — A file path or file name. It does not have to exist on disk. Under `type: 'language'` it is a language id such as `typescript` instead.
- `type?: 'file' | 'folder' | 'language'` — What `input` is: a file, a folder, or a language id. Pass it whenever you already know: without it, the finder has to infer the type from the path, consulting the file, folder and language tables in that order.
- Returns `FileIconInfo` for `type: 'file'`, `FolderIconInfo` for `type: 'folder'`, `LanguageIconInfo` for `type: 'language'`, and `IconInfo` when `type` is omitted.

```ts
findFileIcon('src/index.ts', 'file')
// { type: 'file', name: 'vscode-icons:file-type-typescript' }

findFileIcon('src', 'folder')
// { type: 'folder', name: 'vscode-icons:folder-type-src', expandedName: 'vscode-icons:folder-type-src-opened' }

findFileIcon('typescript', 'language')
// { type: 'language', name: 'vscode-icons:file-type-typescript' }
```

The finder never returns `null` or `undefined`: a path that matches nothing is resolved through the default icons. Non-string input is treated as an empty path and resolves the same way.

### `createFinder(iconSet)`

Builds an `IconFinder` from an `IconSet`. The definition is flattened once, at construction, into lookup tables; every later call is a table read. See [Bring your own icon set](#bring-your-own-icon-set).

Construction is the only place this library throws: a set missing `collect` or `defaults` fails here with a `TypeError` naming the missing fields, rather than surfacing later as an `undefined:file` icon name. The check covers those required fields only — the shape of the five lookup tables and of each `IconSetStemRule` is a TypeScript-level contract, not a runtime one, so a definition that comes from JSON or plain JS and does not match `IconSet` may resolve to wrong icons instead of throwing.

### Types

| Type               | Description                                              |
| ------------------ | -------------------------------------------------------- |
| `IconType`         | `'file' \| 'folder' \| 'language'`                       |
| `FileIconInfo`     | `{ type: 'file', name: string }`                         |
| `FolderIconInfo`   | `{ type: 'folder', name: string, expandedName: string }` |
| `LanguageIconInfo` | `{ type: 'language', name: string }`                     |
| `IconInfo`         | `FileIconInfo \| FolderIconInfo \| LanguageIconInfo`     |
| `IconFinder`       | The finder signature, overloaded on `type`               |
| `IconSet`          | Icon set definition consumed by `createFinder`           |
| `IconSetDefaults`  | Default icon names: `{ file, folder, folderExpanded? }`  |
| `IconSetStemRule`  | File name rule: `{ name, extensions, exact? }`           |

## Matching behavior

### Path normalization

Matching runs on the last segment of the input, lowercased, after `\` and repeated separators are normalized to `/`: `src//components//`, `src\components\` and `src/components` all reduce to `components`. Two consequences are worth knowing. Matching is case-insensitive, so `Dockerfile` and `dockerfile` resolve to the same icon. And non-string input such as `undefined` is treated as an empty path, which falls back to the default icon instead of throwing.

### Type resolution

When `type` is omitted:

1. A trailing separator settles the question — the input is a folder, and only the folder tables are searched.
2. Otherwise the file tables are searched first, then the folder tables, and finally the language table.
3. If nothing matches, the default file icon is returned.

Passing `type` removes the guesswork, and it also picks the fallback: an unmatched name under `type: 'folder'` yields the default folder icon rather than the default file icon.

Passing `type: 'language'` reads the input as a language id instead of a path, which is the only way to skip path parsing entirely. The language table is also consulted last in the inference above, so a language id such as `typescript` resolves to its language icon even when it names no real file or folder. An unmatched language id falls back to the default file icon, as does non-string input.

### Lookup order

For files:

1. Exact match in `fileNames`.
2. Rules in `fileStems`, in declaration order.
3. Extension match in `fileExtensions`. The scan starts at the first `.` and moves right, so the longest suffix wins: `bundle.js.map` matches `js.map` before `map`.

Folders match on the folder name alone, exactly.

Languages match on the language id alone, case-insensitively: both the declared ids and the input are trimmed and lower-cased before the lookup. The input is not parsed as a path, so `src/typescript` finds nothing.

### Stem rules

`IconSetStemRule` is a union: `extensions` decides which shape a rule takes, and `exact` is rejected by the type system in the wildcard shape.

| Field        | Type              | Description                                                                                                              |
| ------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `name`       | `string`          | The file name, or the prefix of one when `exact` is `false`                                                              |
| `extensions` | `string[] \| '*'` | Allowed extensions, without the leading dot; `'*'` accepts any suffix                                                    |
| `exact`      | `boolean`         | `true` (default) requires the full file name; `false` accepts anything that starts with `name` and continues after a `.` |

- `extensions: ['js', 'ts']` with the default `exact: true` expands into exact file names. `{ name: 'foo.config', extensions: ['js', 'ts'] }` matches `foo.config.js` and `foo.config.ts`, and nothing else.
- `exact: false` matches on the prefix. `{ name: 'jest.config', extensions: ['js', 'ts'], exact: false }` matches `jest.config.js` and `jest.config.local.js`, but not `jest.configuration.js`.
- `extensions: '*'` matches `name` itself or any `name.<something>`. `{ name: '.env', extensions: '*' }` matches `.env`, `.env.local` and `.env.development`, but not `.envrc`. The `exact` field does not apply here and must be omitted.

### Default icons

| Icon set       | Collection prefix | Default file   | Default folder   | Expanded suffix |
| -------------- | ----------------- | -------------- | ---------------- | --------------- |
| `vscode-icons` | `vscode-icons`    | `default-file` | `default-folder` | `-opened`       |
| `catppuccin`   | `catppuccin`      | `file`         | `folder`         | `-open`         |

Default icons carry the collection prefix like every other result, for example `vscode-icons:default-file`. An unmatched language id resolves to the default file icon, with `type: 'language'`.

## Development

```bash
pnpm install

# Build to dist/ (ESM + type declarations)
pnpm build

# Unit tests
pnpm test

# Lint and format check
pnpm lint

# Lint with autofix, then format
pnpm format
```

Icon data under `src/icon-set/` is checked against the Iconify datasets with `pnpm validate`, which reports unknown icons, unreachable entries, duplicate matches and ambiguous stem ordering. `pnpm build` also packs the package and runs [publint](https://publint.dev) on it, so broken `exports` or types that do not resolve are caught before publishing.

## License

[MIT](./LICENSE) © [pengzhanbo](https://github.com/pengzhanbo)
