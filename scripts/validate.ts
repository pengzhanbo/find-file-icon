import type { IconSetSource } from './common.js'
import ansis from 'ansis'
import {
  findDuplicateMatches,
  findShadowedStems,
  findUnknownIcons,
  findUnmatchableEntries,
  findUnstableStemKeys,
  partitionUnusedIcons,
} from './checks.js'
import { collectUsedIcons, iconSetSources } from './common.js'

let hasAnyError = false

for (const source of iconSetSources) {
  hasAnyError = printIconSetReport(source) || hasAnyError
}

// 存在错误时以非 0 退出码结束，便于接入 CI 或提交钩子
if (hasAnyError) {
  process.exitCode = 1
}

console.log(hasAnyError ? ansis.red('校验未通过') : ansis.green('全部图标集合校验通过'))

/**
 * 输出单个图标集合的校验结果
 *
 * @param source 图标集合及其数据集
 * @returns 是否存在错误（未知图标 / 永不命中的条目 / 重复匹配）
 */
function printIconSetReport(source: IconSetSource): boolean {
  const { label, iconSet, availableIcons } = source
  console.log(`====================== ${ansis.magenta(label)} =======================\n`)

  const usedIcons = collectUsedIcons(iconSet)
  // 是否输出过任何诊断信息：全部为空时才能判定“通过”
  let hasDiagnostic = false
  let hasError = false

  // 引用了数据集中不存在的图标
  const unknownIcons = findUnknownIcons(availableIcons, usedIcons)
  if (unknownIcons.length > 0) {
    console.warn(`未知图标：${printIcons(unknownIcons)}\n`)
    hasDiagnostic = true
    hasError = true
  }

  // 数据集中存在但未被引用的图标，用于检查数据集是否完整
  const { folderIcons, fileIcons } = partitionUnusedIcons(iconSet, availableIcons, usedIcons)
  if (folderIcons.length > 0 || fileIcons.length > 0) {
    console.log(`${ansis.magenta('未使用的图标')}: `)
    console.log(`文件夹图标 (${ansis.blue(folderIcons.length)}): \n${printIcons(folderIcons)}`)
    console.log(`文件图标 (${ansis.blue(fileIcons.length)}): \n${printIcons(fileIcons)}`)
    hasDiagnostic = true
  }

  // 重复匹配会导致图标被静默覆盖
  const duplicateMatches = findDuplicateMatches(iconSet)
  if (duplicateMatches.length > 0) {
    console.warn(`\n重复匹配：`)
    for (const { kind, name, icon, winner } of duplicateMatches) {
      console.warn(`  [${kind}] ${name}: ${ansis.red(icon)} 被 ${ansis.green(winner)} 覆盖`)
    }
    hasDiagnostic = true
    hasError = true
  }

  // 永不命中的死数据：不会报错，只会静默失效
  const unmatchableEntries = findUnmatchableEntries(iconSet)
  if (unmatchableEntries.length > 0) {
    console.warn(`\n永不命中的条目：`)
    for (const { kind, icon, entry, reason } of unmatchableEntries) {
      console.warn(`  [${kind}] ${ansis.cyan(icon)} ${entry}: ${reason}`)
    }
    hasDiagnostic = true
    hasError = true
  }

  // 顺序歧义只提示风险，不影响退出码
  const unstableKeys = findUnstableStemKeys(iconSet)
  const shadowedStems = findShadowedStems(iconSet)
  if (unstableKeys.length > 0 || shadowedStems.length > 0) {
    console.warn(`\n${ansis.yellow('顺序歧义')}：`)
    for (const key of unstableKeys) {
      console.warn(`  [键序] '${key}': 整数样图标键会被 JS 重排，规则声明顺序不可靠`)
    }
    for (const { icon, name, files } of shadowedStems) {
      console.warn(`  [被遮盖] ${name} (${icon}): ${files.join(', ')} 的命中结果不受该规则影响`)
    }
    hasDiagnostic = true
  }

  // 没有任何诊断时显式输出结论，避免“空输出”被误读为脚本未执行
  if (!hasDiagnostic) {
    console.log(ansis.green('通过：未发现未知图标、永不命中的条目、重复匹配或顺序歧义\n'))
  }

  console.log('\n\n')
  return hasError
}

/**
 * 输出图标名列表
 *
 * @param icons 图标名列表
 * @returns 带颜色的图标名文本
 */
function printIcons(icons: string[]): string {
  return icons.map((icon) => ansis.cyan(icon)).join(', ')
}
