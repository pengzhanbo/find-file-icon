import type { IconSet } from '../src/types.js'
import { describe, expect, it } from 'vitest'
import {
  findDuplicateMatches,
  findShadowedStems,
  findUnknownIcons,
  findUnmatchableEntries,
  findUnstableStemKeys,
  partitionUnusedIcons,
} from '../scripts/checks.js'

const base: IconSet = {
  collect: 'test',
  defaults: { file: 'default-file', folder: 'default-folder' },
}

const uppercase = '含大写字母，而查找前输入已统一小写'

describe('findUnknownIcons', () => {
  it('reports icons the dataset does not provide, without duplicates', () => {
    expect(findUnknownIcons(['alpha', 'beta'], ['alpha', 'gamma', 'gamma'])).toEqual(['gamma'])
  })

  it('reports nothing when every used icon exists', () => {
    expect(findUnknownIcons(['alpha'], ['alpha'])).toEqual([])
  })
})

describe('partitionUnusedIcons', () => {
  const iconSet: IconSet = {
    ...base,
    filePrefix: 'file-',
    folderPrefix: 'folder-',
    folderExpandedSuffix: '-opened',
  }

  it('splits unused dataset icons into file and folder groups', () => {
    const result = partitionUnusedIcons(
      iconSet,
      ['file-used', 'file-free', 'folder-free', 'folder-free-opened', 'plain'],
      ['file-used', 'plain'],
    )

    expect(result).toEqual({ folderIcons: ['folder-free'], fileIcons: ['file-free'] })
  })

  it('treats every unused icon as a file icon without a folder prefix', () => {
    expect(partitionUnusedIcons(base, ['folder-x'], [])).toEqual({
      folderIcons: [],
      fileIcons: ['folder-x'],
    })
  })
})

describe('findUnstableStemKeys', () => {
  it('reports integer-like keys, which JS reorders ahead of other keys', () => {
    const keys = findUnstableStemKeys({
      ...base,
      fileStems: {
        0: [{ name: 'zero', extensions: ['js'] }],
        1: [{ name: 'one', extensions: ['js'] }],
        '01': [{ name: 'padded', extensions: ['js'] }],
        '2x': [{ name: 'prefixed', extensions: ['js'] }],
      },
    })

    expect(keys).toEqual(['0', '1'])
  })
})

describe('findDuplicateMatches', () => {
  it('reports a named file declared by two icons', () => {
    const matches = findDuplicateMatches({
      ...base,
      fileNames: { alpha: ['readme.md'], beta: ['readme.md'] },
    })

    expect(matches).toEqual([
      { kind: 'fileNames', name: 'readme.md', icon: 'alpha', winner: 'beta' },
    ])
  })

  it('reports an exact rule that collides with a named file', () => {
    const matches = findDuplicateMatches({
      ...base,
      fileNames: { alpha: ['foo.config.js'] },
      fileStems: { beta: [{ name: 'foo.config', extensions: ['js'] }] },
    })

    expect(matches).toEqual([
      { kind: 'fileNames', name: 'foo.config.js', icon: 'alpha', winner: 'beta' },
    ])
  })

  it('reports a runtime wildcard rule that loses to a named file', () => {
    const matches = findDuplicateMatches({
      ...base,
      fileNames: { other: ['.env'] },
      fileStems: { env: [{ name: '.env', extensions: '*' }] },
    })

    // 通配规则还能命中 `.env.<任意后缀>`，因此只有 `.env` 本身被具名文件抢占
    expect(matches).toEqual([{ kind: 'fileStems', name: '.env', icon: 'env', winner: 'other' }])
  })

  it('reports a language id declared by two icons', () => {
    const matches = findDuplicateMatches({
      ...base,
      languageIds: { alpha: ['typescript'], beta: ['typescript'] },
    })

    expect(matches).toEqual([
      { kind: 'languageIds', name: 'typescript', icon: 'alpha', winner: 'beta' },
    ])
  })

  it('compares language ids case-insensitively, as the lookup does', () => {
    const matches = findDuplicateMatches({
      ...base,
      languageIds: { alpha: ['TypeScript'], beta: ['typescript'] },
    })

    expect(matches).toEqual([
      { kind: 'languageIds', name: 'typescript', icon: 'alpha', winner: 'beta' },
    ])
  })
})

describe('findShadowedStems', () => {
  it('reports a runtime rule already covered by an earlier rule of the same icon', () => {
    const shadowed = findShadowedStems({
      ...base,
      fileStems: {
        config: [
          { name: 'app', extensions: '*' },
          { name: 'app.config', extensions: '*' },
        ],
      },
    })

    expect(shadowed).toEqual([
      { icon: 'config', name: 'app.config', files: ['app.config', 'app.config.probe-ext'] },
    ])
  })

  it('reports nothing when every rule contributes to the result', () => {
    expect(
      findShadowedStems({
        ...base,
        fileStems: { env: [{ name: '.env', extensions: '*' }] },
      }),
    ).toEqual([])
  })
})

describe('findUnmatchableEntries', () => {
  it('reports nothing for a valid icon set', () => {
    const entries = findUnmatchableEntries({
      ...base,
      fileNames: { markdown: ['readme.md'] },
      folderNames: { src: ['src'] },
      fileExtensions: { typescript: ['ts', 'js.map'] },
      fileStems: {
        dotenv: [{ name: '.env', extensions: '*' }],
        jest: [{ name: 'jest.config', extensions: ['js', 'ts'], exact: false }],
      },
    })

    expect(entries).toEqual([])
  })

  it('reports names with uppercase letters from every table', () => {
    const entries = findUnmatchableEntries({
      ...base,
      fileNames: { markdown: ['README.md'] },
      folderNames: { src: ['Src'] },
      fileExtensions: { typescript: ['TS'] },
      fileStems: { jest: [{ name: 'Jest.config', extensions: ['js'] }] },
    })

    expect(entries).toEqual([
      { kind: 'fileNames', icon: 'markdown', entry: 'README.md', reason: uppercase },
      { kind: 'folderNames', icon: 'src', entry: 'Src', reason: uppercase },
      { kind: 'fileExtensions', icon: 'typescript', entry: 'TS', reason: uppercase },
      { kind: 'fileStems', icon: 'jest', entry: 'Jest.config', reason: uppercase },
    ])
  })

  it('reports an extension with a leading dot', () => {
    const entries = findUnmatchableEntries({
      ...base,
      fileStems: { typescript: [{ name: 'foo', extensions: ['.ts'] }] },
    })

    expect(entries).toEqual([
      {
        kind: 'fileStems',
        icon: 'typescript',
        entry: "foo (extensions: ['.ts'])",
        reason: '扩展名含前导点，拼接出的文件名会多出一个点',
      },
    ])
  })

  it('reports a rule with an empty extension list', () => {
    const entries = findUnmatchableEntries({
      ...base,
      fileStems: { empty: [{ name: 'empty', extensions: [], exact: false }] },
    })

    expect(entries).toEqual([
      {
        kind: 'fileStems',
        icon: 'empty',
        entry: 'empty (extensions: [])',
        reason: '扩展名列表为空，规则既不展开为具名文件，也不参与运行期匹配',
      },
    ])
  })

  it('does not report an empty rule name, which over-matches instead', () => {
    const entries = findUnmatchableEntries({
      ...base,
      fileStems: { any: [{ name: '', extensions: ['ts'] }] },
    })

    expect(entries).toEqual([])
  })

  it('reports a language id with leading or trailing whitespace', () => {
    const entries = findUnmatchableEntries({
      ...base,
      languageIds: { typescript: ['ts', ' ts '] },
    })

    expect(entries).toEqual([
      {
        kind: 'languageIds',
        icon: 'typescript',
        entry: "' ts '",
        reason: '含首尾空白，而查找前输入已去除首尾空白',
      },
    ])
  })

  it('reports an empty language id, which over-matches the empty input', () => {
    const entries = findUnmatchableEntries({
      ...base,
      languageIds: { typescript: [''] },
    })

    expect(entries).toEqual([
      {
        kind: 'languageIds',
        icon: 'typescript',
        entry: "''",
        reason: '空 id 会命中空输入（含非字符串输入），遮蔽默认图标',
      },
    ])
  })

  it('accepts language ids in any case, since both sides are normalized', () => {
    const entries = findUnmatchableEntries({
      ...base,
      languageIds: { cangjie: ['Cangjie'] },
    })

    expect(entries).toEqual([])
  })
})
