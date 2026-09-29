import type { IconSet } from '../src/types.js'
import { describe, expect, it } from 'vitest'
import { transformer } from '../src/core/transformer.js'

function createIconSet(fileStems: IconSet['fileStems'] = {}): IconSet {
  return {
    collect: 'test',
    defaults: { file: 'default-file', folder: 'default-folder' },
    fileNames: { alpha: ['Alpha', '.alpharc'] },
    folderNames: { beta: ['Beta', 'betas'] },
    fileExtensions: { gamma: ['gamma'] },
    fileStems,
  }
}

describe('transformer', () => {
  it('flips the icon name to name maps', () => {
    const resolved = transformer(createIconSet())

    expect(resolved.fileNames).toEqual({ 'Alpha': 'alpha', '.alpharc': 'alpha' })
    expect(resolved.folderNames).toEqual({ Beta: 'beta', betas: 'beta' })
    expect(resolved.fileExtensions).toEqual({ gamma: 'gamma' })
  })

  it('creates prototype-less lookup maps', () => {
    const resolved = transformer(createIconSet())

    expect(Object.getPrototypeOf(resolved.fileNames)).toBeNull()
    expect(Object.getPrototypeOf(resolved.folderNames)).toBeNull()
    expect(Object.getPrototypeOf(resolved.fileExtensions)).toBeNull()
  })

  it('expands exact stem rules into named files', () => {
    const resolved = transformer(
      createIconSet({
        delta: [{ name: 'delta.config', extensions: ['', 'js', 'ts'] }],
        hidden: [{ name: '.hidden', extensions: [''] }],
      }),
    )

    expect(resolved.fileNames['delta.config']).toBe('delta')
    expect(resolved.fileNames['delta.config.js']).toBe('delta')
    expect(resolved.fileNames['delta.config.ts']).toBe('delta')
    expect(resolved.fileNames['.hidden']).toBe('hidden')
    expect(resolved.fileStems).toEqual([])
  })

  it('keeps prefix stem rules in fileStems', () => {
    const resolved = transformer(
      createIconSet({
        epsilon: [{ name: 'epsilon.config', extensions: ['js', 'ts'], exact: false }],
      }),
    )

    expect(resolved.fileStems).toEqual([
      { name: 'epsilon.config', icon: 'epsilon', extensions: ['js', 'ts'] },
    ])
    expect(resolved.fileNames).not.toHaveProperty('epsilon.config')
    expect(resolved.fileNames).not.toHaveProperty('epsilon.config.js')
  })

  it('keeps wildcard stem rules in fileStems', () => {
    const resolved = transformer(
      createIconSet({
        dotenv: [{ name: '.env', extensions: '*' }],
        zeta: [{ name: 'zeta', extensions: '*' }],
      }),
    )

    expect(resolved.fileStems).toEqual([
      { name: '.env', icon: 'dotenv', extensions: '*' },
      { name: 'zeta', icon: 'zeta', extensions: '*' },
    ])
  })

  it('treats omitted lookup tables as empty tables', () => {
    const resolved = transformer({
      collect: 'test',
      defaults: { file: 'default-file', folder: 'default-folder' },
    })

    expect(resolved.fileNames).toEqual({})
    expect(resolved.folderNames).toEqual({})
    expect(resolved.fileExtensions).toEqual({})
    expect(resolved.fileStems).toEqual([])
  })

  it('keeps the declaration order of stem rules', () => {
    const resolved = transformer(
      createIconSet({
        first: [{ name: 'a', extensions: ['js'], exact: false }],
        second: [{ name: 'b', extensions: ['js'], exact: false }],
        third: [{ name: 'c', extensions: ['js'], exact: false }],
      }),
    )

    expect(resolved.fileStems.map((stem) => stem.name)).toEqual(['a', 'b', 'c'])
  })

  it('does not mutate the source icon set', () => {
    const iconSet = createIconSet({ eta: [{ name: 'eta', extensions: ['js'] }] })
    transformer(iconSet)

    expect(iconSet.fileNames).toEqual({ alpha: ['Alpha', '.alpharc'] })
    expect(iconSet.fileStems).toEqual({ eta: [{ name: 'eta', extensions: ['js'] }] })
  })
})
