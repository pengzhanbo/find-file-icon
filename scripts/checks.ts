import type { ResolvedIconSetFileStem } from '../src/core/internal-types.js'
import type { IconSet } from '../src/types.js'
import { createFinder } from '../src/core/create-finder.js'
import { transformer } from '../src/core/transformer.js'

/**
 * 重复匹配导致的图标覆盖
 */
export interface DuplicateMatch {
  /** 声明来源 */
  kind: 'fileNames' | 'fileExtensions' | 'folderNames' | 'fileStems'
  /** 参与匹配的名称 */
  name: string
  /** 声明方图标名，会被覆盖，永远不会生效 */
  icon: string
  /** 实际生效的图标名 */
  winner: string
}

/**
 * 被更早声明的规则遮盖的运行期规则
 */
export interface ShadowedStem {
  /** 规则归属的图标名 */
  icon: string
  /** 规则名 */
  name: string
  /** 命中结果不受该规则影响的探测文件名 */
  files: string[]
}

/** 会被 JS 视为数组索引而抢先排序的整数样键 */
const RE_INTEGER_KEY = /^(?:0|[1-9]\d*)$/
/** 数组索引键的上限，即 `2 ** 32 - 1` */
const MAX_ARRAY_INDEX = 2 ** 32 - 1
/** 探测通配规则扩展目标时使用的扩展名，仅用于探测，不代表真实文件类型 */
const PROBE_EXTENSION = 'probe-ext'

/**
 * 查找引用了不存在的图标
 *
 * @param availableIcons 数据集中实际存在的图标名
 * @param usedIcons 图标集合中实际生效的图标名
 * @returns 不存在的图标名
 */
export function findUnknownIcons(availableIcons: string[], usedIcons: string[]): string[] {
  const available: Set<string> = new Set(availableIcons)
  return [...new Set(usedIcons)].filter((icon) => !available.has(icon))
}

/**
 * 按图标类型拆分数据集中未被使用的图标
 *
 * 图标类型依据图标集合自身的前缀 / 展开后缀判断，
 * 展开态图标由折叠态图标派生，不单独统计。
 *
 * @param iconSet 图标集合定义
 * @param availableIcons 数据集中实际存在的图标名
 * @param usedIcons 图标集合中实际生效的图标名
 * @returns 未使用的文件夹图标与文件图标
 */
export function partitionUnusedIcons(
  iconSet: IconSet,
  availableIcons: string[],
  usedIcons: string[],
): { folderIcons: string[]; fileIcons: string[] } {
  const used: Set<string> = new Set(usedIcons)
  const folderPrefix = iconSet.folderPrefix ?? ''
  const folderExpandedSuffix = iconSet.folderExpandedSuffix ?? ''
  const folderIcons: string[] = []
  const fileIcons: string[] = []

  for (const icon of availableIcons) {
    if (used.has(icon)) {
      continue
    }

    if (folderPrefix !== '' && icon.startsWith(folderPrefix)) {
      const isExpanded = folderExpandedSuffix !== '' && icon.endsWith(folderExpandedSuffix)
      if (!isExpanded) {
        folderIcons.push(icon)
      }
      continue
    }

    fileIcons.push(icon)
  }

  return { folderIcons, fileIcons }
}

/**
 * 查找重复匹配导致图标被覆盖的声明
 *
 * 覆盖分两类：
 * 1. 构建期：具名文件、文件扩展名、文件夹名之间存在同名映射，
 *    以及精确匹配的规则展开后的文件名与具名文件同名。`transformer` 只保留最后一个声明。
 * 2. 运行期：文件名规则按声明顺序匹配，先声明的规则会抢占后声明规则的目标文件名。
 *
 * @param iconSet 图标集合定义
 * @returns 被覆盖的声明列表
 */
export function findDuplicateMatches(iconSet: IconSet): DuplicateMatch[] {
  const { fileNames, fileExtensions, folderNames, fileStems } = transformer(iconSet)
  const matches: DuplicateMatch[] = []

  // 声明方与最终生效方不一致，说明该声明被其它声明覆盖
  const compare = (
    kind: DuplicateMatch['kind'],
    name: string,
    icon: string,
    winners: Record<string, string>,
  ): void => {
    const winner = winners[name]
    if (winner !== undefined && winner !== icon) {
      matches.push({ kind, name, icon, winner })
    }
  }

  for (const [icon, names] of Object.entries(iconSet.fileNames ?? {})) {
    for (const name of names) {
      compare('fileNames', name, icon, fileNames)
    }
  }

  for (const [icon, names] of Object.entries(iconSet.fileExtensions ?? {})) {
    for (const name of names) {
      compare('fileExtensions', name, icon, fileExtensions)
    }
  }

  for (const [icon, names] of Object.entries(iconSet.folderNames ?? {})) {
    for (const name of names) {
      compare('folderNames', name, icon, folderNames)
    }
  }

  // 精确匹配的规则会被展开为具名文件，可能与具名文件或其它规则同名
  for (const [icon, rules] of Object.entries(iconSet.fileStems ?? {})) {
    for (const rule of rules) {
      if (rule.exact === false || rule.extensions === '*') {
        continue
      }
      for (const extension of rule.extensions) {
        compare('fileStems', rule.name + (extension ? `.${extension}` : ''), icon, fileNames)
      }
    }
  }

  const find = createFinder(iconSet)
  const base = `${iconSet.collect}:${iconSet.filePrefix ?? ''}`

  for (const stem of fileStems) {
    const expected = `${base}${stem.icon}`

    for (const name of getProbeFileNames(stem)) {
      const actual = find(name, 'file').name
      if (actual === expected) {
        continue
      }

      matches.push({
        kind: 'fileStems',
        name,
        icon: stem.icon,
        winner: actual.startsWith(base) ? actual.slice(base.length) : actual,
      })
    }
  }

  return matches
}

/**
 * 生成用于探测规则实际命中结果的示例文件名
 *
 * 通配规则除 `name` 本身外还能匹配 `name.<任意>`，因此额外探测一个扩展目标，
 * 否则会被「同名具名文件 / 扩展名匹配」误判为不生效（如 `.env` 同时是 `env` 扩展名）。
 *
 * @param stem 运行期的文件名规则
 * @returns 示例文件名列表
 */
function getProbeFileNames(stem: ResolvedIconSetFileStem): string[] {
  if (stem.extensions === '*') {
    return [stem.name, `${stem.name}.${PROBE_EXTENSION}`]
  }
  return stem.extensions.map((extension) => `${stem.name}.${extension}`)
}

/**
 * 查找 `fileStems` 中会被 JS 重排的整数样图标键
 *
 * 整数样键会被当作数组索引，在 `Object.entries` / `Object.keys` 中排到最前，
 * 声明顺序不再等于读取顺序，运行期规则的匹配顺序随之改变。
 *
 * @param iconSet 图标集合定义
 * @returns 整数样键列表
 */
export function findUnstableStemKeys(iconSet: IconSet): string[] {
  return Object.keys(iconSet.fileStems ?? {}).filter(
    (key) => RE_INTEGER_KEY.test(key) && Number(key) < MAX_ARRAY_INDEX,
  )
}

/**
 * 查找因声明顺序而被遮盖的运行期规则
 *
 * 运行期规则按声明顺序匹配，先声明的规则会抢占后声明规则的目标文件名。
 * 这里逐一移除规则后重新构造查找器：若探测文件名的命中结果不变，
 * 说明该规则对匹配结果没有贡献（同图标的前缀规则、具名文件或其它规则已接管）。
 *
 * 命中结果与规则自身图标不同时属于「重复匹配」，由 `findDuplicateMatches` 报告，此处不重复列出。
 *
 * @param iconSet 图标集合定义
 * @returns 被遮盖的规则列表
 */
export function findShadowedStems(iconSet: IconSet): ShadowedStem[] {
  const { fileStems } = transformer(iconSet)
  const find = createFinder(iconSet)
  const base = `${iconSet.collect}:${iconSet.filePrefix ?? ''}`
  const shadowed: ShadowedStem[] = []

  for (const stem of fileStems) {
    const files = getProbeFileNames(stem)
    if (files.length === 0) {
      continue
    }

    const withoutStem = createFinder(removeStem(iconSet, stem))
    const shadowedFiles = files.filter(
      (file) => find(file, 'file').name === withoutStem(file, 'file').name,
    )
    if (shadowedFiles.length !== files.length) {
      continue
    }

    // 命中结果与规则自身图标不同时属于「重复匹配」，由 findDuplicateMatches 报告
    if (find(files[0]!, 'file').name !== `${base}${stem.icon}`) {
      continue
    }

    shadowed.push({ icon: stem.icon, name: stem.name, files: shadowedFiles })
  }

  return shadowed
}

/**
 * 移除指定的运行期规则，用于探测该规则是否真正生效
 *
 * @param iconSet 图标集合定义
 * @param stem 待移除的规则
 * @returns 移除该规则后的图标集合
 */
function removeStem(iconSet: IconSet, stem: ResolvedIconSetFileStem): IconSet {
  const rules = iconSet.fileStems?.[stem.icon] ?? []
  const index = rules.findIndex(
    (rule) => rule.name === stem.name && rule.extensions === stem.extensions,
  )
  if (index === -1) {
    return iconSet
  }

  return {
    ...iconSet,
    fileStems: {
      ...iconSet.fileStems,
      [stem.icon]: rules.filter((_, i) => i !== index),
    },
  }
}

/**
 * 永不命中的条目
 *
 * 这类死数据不会抛错、也不会覆盖其它声明，只是永远无法命中，
 * 属于人工维护数据表时最容易积累、又最难察觉的一类错误。
 */
export interface UnmatchableEntry {
  /** 声明来源 */
  kind: 'fileNames' | 'fileExtensions' | 'folderNames' | 'fileStems'
  /** 声明方图标名 */
  icon: string
  /** 永不生效的名称或规则 */
  entry: string
  /** 永不命中的原因 */
  reason: string
}

/**
 * 查找永不命中的条目
 *
 * 判定依据来自匹配链路已有的约定，而不是重新实现匹配：
 * 1. `parseFilePath` 会把输入统一小写，因此含大写字母的名称永不命中；
 * 2. `transformer` 用 `名称 + '.' + 扩展名` 构造具名文件键，扩展名含前导点会多出一个点；
 * 3. `extensions` 为空数组时既不展开为具名文件，也不具备运行期匹配条件。
 *
 * 名称为空字符串（如 `name: ''`）不在此检查范围：它并非永不命中，而是会过度匹配。
 *
 * @param iconSet 图标集合定义
 * @returns 永不命中的条目列表
 */
export function findUnmatchableEntries(iconSet: IconSet): UnmatchableEntry[] {
  const entries: UnmatchableEntry[] = []

  const checkName = (kind: UnmatchableEntry['kind'], icon: string, name: string): void => {
    if (name === name.toLowerCase()) {
      return
    }
    entries.push({ kind, icon, entry: name, reason: '含大写字母，而查找前输入已统一小写' })
  }

  const checkTable = (
    kind: UnmatchableEntry['kind'],
    table: Record<string, string[]> | undefined,
  ): void => {
    for (const [icon, names] of Object.entries(table ?? {})) {
      for (const name of names) {
        checkName(kind, icon, name)
      }
    }
  }

  checkTable('fileNames', iconSet.fileNames)
  checkTable('folderNames', iconSet.folderNames)
  checkTable('fileExtensions', iconSet.fileExtensions)

  for (const [icon, rules] of Object.entries(iconSet.fileStems ?? {})) {
    for (const rule of rules) {
      checkName('fileStems', icon, rule.name)

      // 通配规则不拼接扩展名，不存在前导点与空列表问题
      if (rule.extensions === '*') {
        continue
      }

      if (rule.extensions.length === 0) {
        entries.push({
          kind: 'fileStems',
          icon,
          entry: `${rule.name} (extensions: [])`,
          reason: '扩展名列表为空，规则既不展开为具名文件，也不参与运行期匹配',
        })
        continue
      }

      for (const extension of rule.extensions) {
        if (extension.startsWith('.')) {
          entries.push({
            kind: 'fileStems',
            icon,
            entry: `${rule.name} (extensions: ['${extension}'])`,
            reason: '扩展名含前导点，拼接出的文件名会多出一个点',
          })
        }
      }
    }
  }

  return entries
}
