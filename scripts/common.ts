import type { IconSet } from '../src/types.js'
import { icons as rawCatppuccinIcons } from '@iconify-json/catppuccin'
import { icons as rawVscodeIcons } from '@iconify-json/vscode-icons'
import { transformer } from '../src/core/transformer.js'
import { catppuccin as catppuccinSet } from '../src/icon-set/catppuccin.js'
import { vscodeIcons as vscodeIconsSet } from '../src/icon-set/vscode-icons.js'
import { catppuccinIconsIgnores, vscodeIconsIgnores } from './ignore-icons.js'

/**
 * 待校验的图标集合及其数据集
 */
export interface IconSetSource {
  /** 图标集合名，用于输出 */
  label: string
  /** 图标集合定义 */
  iconSet: IconSet
  /** 数据集中实际存在的图标名（已排除 ignore 列表） */
  availableIcons: string[]
}

/**
 * 从 iconify 数据集中获取图标名（不包含集合前缀）
 *
 * @param dataset iconify 数据集
 * @param isExcluded 排除条件
 * @returns 图标名列表
 */
function getDatasetIcons(
  dataset: { icons: Record<string, unknown>; aliases?: Record<string, unknown> },
  isExcluded: (icon: string) => boolean,
): string[] {
  return [...Object.keys(dataset.icons), ...Object.keys(dataset.aliases ?? {})].filter(
    (icon) => !isExcluded(icon),
  )
}

const vscodeIconsAvailable: string[] = getDatasetIcons(
  rawVscodeIcons,
  (icon) =>
    icon.startsWith('file-type-light-') ||
    icon.startsWith('folder-type-light-') ||
    vscodeIconsIgnores.includes(icon),
)

const catppuccinIconsAvailable: string[] = getDatasetIcons(rawCatppuccinIcons, (icon) =>
  catppuccinIconsIgnores.includes(icon),
)

export const iconSetSources: IconSetSource[] = [
  { label: 'vscode-icons', iconSet: vscodeIconsSet, availableIcons: vscodeIconsAvailable },
  { label: 'catppuccin', iconSet: catppuccinSet, availableIcons: catppuccinIconsAvailable },
]

/**
 * 收集图标集合中实际生效的图标名（已带上集合内前缀）
 *
 * 直接复用运行时的 `transformer` 输出，使前缀 / 展开后缀的推导与 `createFinder` 保持一致，
 * 不再维护第二份实现。被重复匹配覆盖的声明不会出现在结果中，由 `findDuplicateMatches` 单独报告。
 *
 * @param iconSet 图标集合定义
 * @returns 图标名列表
 */
export function collectUsedIcons(iconSet: IconSet): string[] {
  const { fileNames, fileExtensions, fileStems, folderNames } = transformer(iconSet)
  const filePrefix = iconSet.filePrefix ?? ''
  const folderPrefix = iconSet.folderPrefix ?? ''
  const folderExpandedSuffix = iconSet.folderExpandedSuffix ?? ''
  const { defaults } = iconSet
  const icons: Set<string> = new Set()

  // 文件图标：具名文件、文件扩展名、文件名规则所引用的图标
  const fileIcons: string[] = [
    ...Object.values(fileNames),
    ...Object.values(fileExtensions),
    ...fileStems.map((stem) => stem.icon),
  ]
  for (const icon of fileIcons) {
    icons.add(filePrefix + icon)
  }

  // 文件夹图标：折叠态与展开态
  for (const icon of Object.values(folderNames)) {
    icons.add(folderPrefix + icon)
    icons.add(folderPrefix + icon + folderExpandedSuffix)
  }

  // 默认图标为完整图标名，不参与前缀拼接
  icons.add(defaults.file)
  icons.add(defaults.folder)
  // 与 createFinder 保持一致：空字符串视为未配置，回落到 `folder` + 展开后缀
  const configuredFolderExpanded = defaults.folderExpanded ?? ''
  icons.add(
    configuredFolderExpanded.length > 0
      ? configuredFolderExpanded
      : defaults.folder + folderExpandedSuffix,
  )

  return [...icons]
}
