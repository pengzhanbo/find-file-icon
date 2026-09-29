import type { IconSet } from '../src/types.js'
import { describe, expect, it } from 'vitest'
import { createFinder } from '../src/core/create-finder.js'

const iconSet: IconSet = {
  collect: 'test',
  filePrefix: 'file-',
  folderPrefix: 'folder-',
  folderExpandedSuffix: '-opened',
  defaults: { file: 'default-file', folder: 'default-folder' },
  fileNames: {
    markdown: ['readme.md'],
    npm: ['package.json'],
  },
  folderNames: {
    src: ['src', 'source'],
    node: ['node_modules'],
  },
  fileExtensions: {
    typescript: ['ts', 'tsx'],
    javascript: ['js'],
    jsmap: ['js.map'],
  },
  fileStems: {
    dotenv: [{ name: '.env', extensions: '*' }],
    jest: [{ name: 'jest.config', extensions: ['js', 'ts'], exact: false }],
    emptyrule: [{ name: 'emptyrule', extensions: [], exact: false }],
    star: [{ name: 'star', extensions: '*' }],
  },
}

const find = createFinder(iconSet)

const file = (name: string) => ({ type: 'file', name })
const folder = (name: string, expandedName: string) => ({ type: 'folder', name, expandedName })

describe('createFinder', () => {
  describe('named files', () => {
    it('matches an exact named file', () => {
      expect(find('readme.md')).toEqual(file('test:file-markdown'))
      expect(find('package.json')).toEqual(file('test:file-npm'))
    })

    it('matches named files case-insensitively', () => {
      expect(find('README.MD')).toEqual(file('test:file-markdown'))
      expect(find('Package.JSON')).toEqual(file('test:file-npm'))
    })
  })

  describe('file extensions', () => {
    it('matches a single extension', () => {
      expect(find('index.ts')).toEqual(file('test:file-typescript'))
      expect(find('app.js')).toEqual(file('test:file-javascript'))
    })

    it('matches the longest suffix first', () => {
      expect(find('bundle.js.map')).toEqual(file('test:file-jsmap'))
      expect(find('nested.foo.js')).toEqual(file('test:file-javascript'))
    })

    it('falls back to the default icon for an unknown extension', () => {
      expect(find('unknown.zzz')).toEqual(file('test:default-file'))
      expect(find('unknown')).toEqual(file('test:default-file'))
    })
  })

  describe('file stem rules', () => {
    it('matches a prefix rule followed by a dot and an allowed extension', () => {
      expect(find('jest.config.js')).toEqual(file('test:file-jest'))
      expect(find('jest.config.ts')).toEqual(file('test:file-jest'))
    })

    it('takes precedence over the extension match', () => {
      expect(find('jest.config.js')).not.toEqual(file('test:file-javascript'))
    })

    it('rejects a prefix that is not followed by a dot', () => {
      expect(find('jest.configuration.ts')).toEqual(file('test:file-typescript'))
    })

    it('rejects a disallowed extension', () => {
      expect(find('jest.config.md')).toEqual(file('test:default-file'))
    })

    it('rejects a prefix without any extension', () => {
      expect(find('jest.config')).toEqual(file('test:default-file'))
    })

    it('skips a rule declared with an empty extension list', () => {
      expect(find('emptyrule.ts')).toEqual(file('test:file-typescript'))
    })
  })

  describe('wildcard stem rules', () => {
    it('matches the stem itself', () => {
      expect(find('.env')).toEqual(file('test:file-dotenv'))
      expect(find('star')).toEqual(file('test:file-star'))
    })

    it('matches any dot-suffixed name', () => {
      expect(find('.env.local')).toEqual(file('test:file-dotenv'))
      expect(find('.env.development')).toEqual(file('test:file-dotenv'))
      expect(find('star.gz')).toEqual(file('test:file-star'))
    })

    it('rejects a name that only shares the prefix', () => {
      expect(find('.envrc')).toEqual(file('test:default-file'))
      expect(find('starz')).toEqual(file('test:default-file'))
    })
  })

  describe('folders', () => {
    it('matches a folder name when the type is explicit', () => {
      expect(find('src', 'folder')).toEqual(folder('test:folder-src', 'test:folder-src-opened'))
      expect(find('source', 'folder')).toEqual(folder('test:folder-src', 'test:folder-src-opened'))
      expect(find('node_modules', 'folder')).toEqual(
        folder('test:folder-node', 'test:folder-node-opened'),
      )
    })

    it('matches a folder name from a trailing slash', () => {
      expect(find('src/')).toEqual(folder('test:folder-src', 'test:folder-src-opened'))
      expect(find('src\\')).toEqual(folder('test:folder-src', 'test:folder-src-opened'))
    })

    it('resolves a bare folder name after the file lookup fails', () => {
      expect(find('node_modules')).toEqual(folder('test:folder-node', 'test:folder-node-opened'))
    })

    it('returns the default folder icon for an unknown folder with a trailing slash', () => {
      expect(find('unknown-folder/')).toEqual(
        folder('test:default-folder', 'test:default-folder-opened'),
      )
    })

    it('does not match a file name as a folder', () => {
      expect(find('readme.md', 'folder')).toEqual(
        folder('test:default-folder', 'test:default-folder-opened'),
      )
    })
  })

  describe('type resolution', () => {
    it('honours an explicit file type', () => {
      expect(find('src', 'file')).toEqual(file('test:default-file'))
      expect(find('index.ts', 'file')).toEqual(file('test:file-typescript'))
    })

    it('honours an explicit folder type', () => {
      expect(find('index.ts', 'folder')).toEqual(
        folder('test:default-folder', 'test:default-folder-opened'),
      )
    })

    it('prefers the file match when the type is omitted', () => {
      expect(find('readme.md')).toEqual(file('test:file-markdown'))
    })

    it('falls back to the default file icon when nothing matches', () => {
      expect(find('')).toEqual(file('test:default-file'))
      expect(find('unknown.zzz')).toEqual(file('test:default-file'))
    })
  })

  describe('prototype safety', () => {
    it('does not resolve inherited object properties as files', () => {
      expect(find('toString')).toEqual(file('test:default-file'))
      expect(find('__proto__')).toEqual(file('test:default-file'))
      expect(find('constructor')).toEqual(file('test:default-file'))
      expect(find('hasOwnProperty')).toEqual(file('test:default-file'))
    })

    it('does not resolve inherited object properties as folders', () => {
      expect(find('toString', 'folder')).toEqual(
        folder('test:default-folder', 'test:default-folder-opened'),
      )
      expect(find('__proto__', 'folder')).toEqual(
        folder('test:default-folder', 'test:default-folder-opened'),
      )
    })
  })

  describe('invalid input', () => {
    it('falls back to the default icon for non-string input', () => {
      expect(find(undefined as unknown as string)).toEqual(file('test:default-file'))
      expect(find(null as unknown as string)).toEqual(file('test:default-file'))
      expect(find(123 as unknown as string, 'file')).toEqual(file('test:default-file'))
    })
  })

  describe('invalid icon set', () => {
    it('throws a readable error listing every missing field', () => {
      expect(() => createFinder({} as IconSet)).toThrow(
        '[find-file-icon] Invalid IconSet: missing collect, defaults.file, defaults.folder / 图标集合缺少必填字段：collect, defaults.file, defaults.folder',
      )
    })

    it('accepts an icon set with empty lookup tables', () => {
      const empty: IconSet = {
        collect: 'empty',
        defaults: { file: 'f', folder: 'd' },
        fileNames: {},
        folderNames: {},
        fileExtensions: {},
        fileStems: {},
      }

      expect(createFinder(empty)('unknown.zzz')).toEqual(file('empty:f'))
    })

    it('treats omitted lookup tables as empty tables', () => {
      const minimal = createFinder({
        collect: 'minimal',
        defaults: { file: 'f', folder: 'd' },
      })

      expect(minimal('unknown.zzz')).toEqual(file('minimal:f'))
      expect(minimal('unknown-folder', 'folder')).toEqual(folder('minimal:d', 'minimal:d'))
    })
  })

  describe('default icons', () => {
    it('uses the collection prefix', () => {
      expect(find('unknown.zzz', 'file').name).toBe('test:default-file')
      expect(find('unknown.zzz', 'folder').name).toBe('test:default-folder')
    })

    it('uses the plain folder name when no expanded suffix is configured', () => {
      const plain: IconSet = {
        collect: 'plain',
        defaults: { file: 'f', folder: 'd' },
        fileNames: {},
        folderNames: {},
        fileExtensions: {},
        fileStems: {},
      }

      expect(createFinder(plain)('nope', 'folder')).toEqual(folder('plain:d', 'plain:d'))
    })

    it('uses an explicit expanded folder name when configured', () => {
      const custom: IconSet = {
        collect: 'custom',
        defaults: { file: 'f', folder: 'd', folderExpanded: 'd-open' },
        fileNames: {},
        folderNames: {},
        fileExtensions: {},
        fileStems: {},
      }

      expect(createFinder(custom)('nope', 'folder')).toEqual(folder('custom:d', 'custom:d-open'))
    })

    it('falls back to the expanded suffix when folderExpanded is an empty string', () => {
      const blank: IconSet = {
        collect: 'blank',
        folderExpandedSuffix: '-opened',
        defaults: { file: 'f', folder: 'd', folderExpanded: '' },
      }

      expect(createFinder(blank)('nope', 'folder')).toEqual(folder('blank:d', 'blank:d-opened'))
    })

    it('returns a frozen default icon that callers cannot mutate into a shared state leak', () => {
      const first = find('unknown.zzz')

      expect(Object.isFrozen(first)).toBe(true)
      expect(() => Object.assign(first, { name: 'mutated' })).toThrow(TypeError)
      expect(find('another-unknown.zzz')).toEqual(file('test:default-file'))
    })
  })
})
