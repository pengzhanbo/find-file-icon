import { describe, expect, it } from 'vitest'
import { findFileIcon as catppuccinFindFileIcon } from '../src/catppuccin.js'
import { createFinder as coreCreateFinder } from '../src/core/create-finder.js'
import { catppuccin as catppuccinSet } from '../src/icon-set/catppuccin.js'
import { vscodeIcons as vscodeIconsSet } from '../src/icon-set/vscode-icons.js'
import { createFinder, findFileIcon } from '../src/index.js'
import { findFileIcon as vscodeFindFileIcon } from '../src/vscode-icons.js'

const file = (name: string) => ({ type: 'file', name })
const folder = (name: string, expandedName: string) => ({ type: 'folder', name, expandedName })

describe('entry points', () => {
  it('exposes the vscode-icons finder from the root entry', () => {
    expect(findFileIcon).toBe(vscodeFindFileIcon)
  })

  it('exposes a distinct finder for each icon set', () => {
    expect(catppuccinFindFileIcon).not.toBe(vscodeFindFileIcon)
  })

  it('exports createFinder from the root entry', () => {
    expect(createFinder).toBeTypeOf('function')
  })
})

describe('additional entry points', () => {
  it('exports the same createFinder from the core entry', () => {
    expect(coreCreateFinder).toBe(createFinder)
  })

  it('ships icon set definitions that compile to the published finders', () => {
    expect(vscodeIconsSet.collect).toBe('vscode-icons')
    expect(catppuccinSet.collect).toBe('catppuccin')

    expect(coreCreateFinder(vscodeIconsSet)('src/index.ts')).toEqual(
      vscodeFindFileIcon('src/index.ts'),
    )
    expect(coreCreateFinder(catppuccinSet)('README.md')).toEqual(
      catppuccinFindFileIcon('README.md'),
    )
  })
})

describe('vscode-icons finder', () => {
  it('resolves common file paths', () => {
    expect(vscodeFindFileIcon('src/components/Button.vue')).toEqual(
      file('vscode-icons:file-type-vue'),
    )
    expect(vscodeFindFileIcon('README.md')).toEqual(file('vscode-icons:file-type-markdown'))
    expect(vscodeFindFileIcon('package.json')).toEqual(file('vscode-icons:file-type-npm'))
  })

  it('resolves nested extensions with the longest suffix first', () => {
    expect(vscodeFindFileIcon('foo.js.map')).toEqual(file('vscode-icons:file-type-jsmap'))
  })

  it('resolves dotfiles by wildcard rules', () => {
    expect(vscodeFindFileIcon('.env')).toEqual(file('vscode-icons:file-type-dotenv'))
    expect(vscodeFindFileIcon('.env.local')).toEqual(file('vscode-icons:file-type-dotenv'))
  })

  it('is case-insensitive', () => {
    expect(vscodeFindFileIcon('Dockerfile')).toEqual(file('vscode-icons:file-type-docker'))
    expect(vscodeFindFileIcon('Makefile')).toEqual(file('vscode-icons:file-type-makefile'))
  })

  it('normalizes windows and mixed separators', () => {
    expect(vscodeFindFileIcon('C:\\Users\\dev\\package.json')).toEqual(
      file('vscode-icons:file-type-npm'),
    )
    expect(vscodeFindFileIcon('src\\components\\')).toEqual(
      folder('vscode-icons:folder-type-component', 'vscode-icons:folder-type-component-opened'),
    )
  })

  it('resolves folders', () => {
    expect(vscodeFindFileIcon('src/')).toEqual(
      folder('vscode-icons:folder-type-src', 'vscode-icons:folder-type-src-opened'),
    )
    expect(vscodeFindFileIcon('src', 'folder')).toEqual(
      folder('vscode-icons:folder-type-src', 'vscode-icons:folder-type-src-opened'),
    )
  })

  it('honours an explicit file type', () => {
    expect(vscodeFindFileIcon('src/index.ts', 'file')).toEqual(
      file('vscode-icons:file-type-typescript'),
    )
  })

  it('returns prefixed default icons when nothing matches', () => {
    expect(vscodeFindFileIcon('unknown.xyz')).toEqual(file('vscode-icons:default-file'))
    expect(vscodeFindFileIcon('unknown.xyz', 'file')).toEqual(file('vscode-icons:default-file'))
    expect(vscodeFindFileIcon('unknown-folder', 'folder')).toEqual(
      folder('vscode-icons:default-folder', 'vscode-icons:default-folder-opened'),
    )
  })
})

describe('catppuccin finder', () => {
  it('resolves files using the catppuccin icon names', () => {
    expect(catppuccinFindFileIcon('src/components/Button.vue')).toEqual(file('catppuccin:vue'))
    expect(catppuccinFindFileIcon('package.json')).toEqual(file('catppuccin:package-json'))
    expect(catppuccinFindFileIcon('README.md')).toEqual(file('catppuccin:readme'))
  })

  it('resolves folders with the catppuccin expanded suffix', () => {
    expect(catppuccinFindFileIcon('src/')).toEqual(
      folder('catppuccin:folder-src', 'catppuccin:folder-src-open'),
    )
  })

  it('returns prefixed default icons when nothing matches', () => {
    expect(catppuccinFindFileIcon('unknown.xyz')).toEqual(file('catppuccin:file'))
    expect(catppuccinFindFileIcon('unknown-folder', 'folder')).toEqual(
      folder('catppuccin:folder', 'catppuccin:folder-open'),
    )
  })
})
