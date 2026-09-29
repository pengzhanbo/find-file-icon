import { describe, expect, it } from 'vitest'
import { parseFilePath } from '../src/core/parse-input.js'

describe('parseFilePath', () => {
  describe('file paths', () => {
    it('extracts the file name from a posix path', () => {
      expect(parseFilePath('src/components/Button.vue')).toEqual({
        name: 'button.vue',
        isFolder: false,
      })
    })

    it('extracts the file name from a windows path', () => {
      expect(parseFilePath('C:\\Users\\dev\\project\\package.json')).toEqual({
        name: 'package.json',
        isFolder: false,
      })
    })

    it('extracts the file name from a mixed separator path', () => {
      expect(parseFilePath('src\\components/Button.vue')).toEqual({
        name: 'button.vue',
        isFolder: false,
      })
    })

    it('treats a bare file name as a file', () => {
      expect(parseFilePath('Makefile')).toEqual({ name: 'makefile', isFolder: false })
    })
  })

  describe('folder paths', () => {
    it('detects a folder by the trailing slash', () => {
      expect(parseFilePath('src/components/')).toEqual({ name: 'components', isFolder: true })
    })

    it('detects a folder by the trailing backslash', () => {
      expect(parseFilePath('src\\components\\')).toEqual({ name: 'components', isFolder: true })
    })

    it('collapses consecutive separators', () => {
      expect(parseFilePath('src//components//')).toEqual({ name: 'components', isFolder: true })
    })

    it('collapses consecutive backslashes', () => {
      expect(parseFilePath('src\\\\components\\\\')).toEqual({ name: 'components', isFolder: true })
    })

    it('does not treat a path without a trailing slash as a folder', () => {
      expect(parseFilePath('src/components')).toEqual({ name: 'components', isFolder: false })
    })
  })

  describe('case normalization', () => {
    it('lower-cases the resolved name', () => {
      expect(parseFilePath('SRC/Components/README.MD')).toEqual({
        name: 'readme.md',
        isFolder: false,
      })
    })

    it('lower-cases the resolved folder name', () => {
      expect(parseFilePath('Node_Modules/')).toEqual({ name: 'node_modules', isFolder: true })
    })
  })

  describe('boundary conditions', () => {
    it('handles an empty string', () => {
      expect(parseFilePath('')).toEqual({ name: '', isFolder: false })
    })

    it('handles a single slash', () => {
      expect(parseFilePath('/')).toEqual({ name: '', isFolder: true })
    })

    it('handles repeated slashes only', () => {
      expect(parseFilePath('///')).toEqual({ name: '', isFolder: true })
    })

    it('handles a single backslash', () => {
      expect(parseFilePath('\\')).toEqual({ name: '', isFolder: true })
    })

    it('handles a trailing separator without a name', () => {
      expect(parseFilePath('src////')).toEqual({ name: 'src', isFolder: true })
    })

    it('keeps dotfiles intact', () => {
      expect(parseFilePath('.env.local')).toEqual({ name: '.env.local', isFolder: false })
    })

    it('keeps a root level file name', () => {
      expect(parseFilePath('/file.txt')).toEqual({ name: 'file.txt', isFolder: false })
    })

    it('treats non-string input as an empty path', () => {
      expect(parseFilePath(undefined as unknown as string)).toEqual({ name: '', isFolder: false })
      expect(parseFilePath(null as unknown as string)).toEqual({ name: '', isFolder: false })
    })
  })
})
