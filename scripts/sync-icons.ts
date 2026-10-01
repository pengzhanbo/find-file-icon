/**
 * 图标数据同步脚本
 *
 * 流程：检查图标变更 → 从上游仓库获取对应版本清单 → 将变更条目写入 temp/ 供人工审核。
 * 脚本只读取 src/ 的图标集合，不会修改 src/，合入始终由人工完成。
 *
 * 1. 以已安装的 `@iconify-json/vscode-icons` 数据集为基准，用 `pnpm validate` 同款比对找出
 *    数据集中存在、但 IconSet 未引用的图标（即新增图标），以及 IconSet 引用了但数据集已移除的失效图标；
 * 2. 依据数据集 `info.json` 中的版本号（即 vscode-icons 扩展版本）拉取同版本 tag 的上游清单，
 *    下载结果缓存到 `temp/upstream/`，可用 `--refresh` 强制重新下载；
 * 3. 把上游条目翻译为 IconSet 表结构，复用 `scripts/checks.ts` 的既有检查能力评估冲突与永不命中条目，
 *    产物写入 `temp/vscode-icons-new-entries.ts` 与 `temp/vscode-icons-sync-report.json`。
 *
 * 用法：
 *   pnpm sync:icons            使用缓存（缺失时下载）
 *   pnpm sync:icons --refresh  忽略缓存，重新下载上游清单
 */
import type { IconSet, IconSetStemRule } from '../src/types.js'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { info } from '@iconify-json/vscode-icons'
import ansis from 'ansis'
import {
  findDuplicateMatches,
  findUnknownIcons,
  findUnmatchableEntries,
  partitionUnusedIcons,
} from './checks.js'
import { collectUsedIcons, iconSetSources } from './common.js'

/** 项目根目录 */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
/** 变更条目与报告的输出目录 */
const TEMP_DIR = join(ROOT, 'temp')
/** 生成条目文件 */
const ENTRIES_FILE = join(TEMP_DIR, 'vscode-icons-new-entries.ts')
/** 分析报告文件 */
const REPORT_FILE = join(TEMP_DIR, 'vscode-icons-sync-report.json')
/**
 * 待同步的图标集合名
 *
 * 仅支持 `vscode-icons`：它是唯一在仓库中维护了路径映射清单的图标集合，
 * catppuccin 的数据集没有对应的扩展名 / 文件夹映射来源。
 */
const COLLECTION = 'vscode-icons'
/** 上游仓库原始文件地址前缀 */
const UPSTREAM_BASE = 'https://raw.githubusercontent.com/vscode-icons/vscode-icons'
/** 上游清单中需要的文件 */
const UPSTREAM_FILES = ['languages.ts', 'supportedExtensions.ts', 'supportedFolders.ts'] as const

/** 上游清单条目（仅声明本脚本关心的字段） */
interface ManifestEntry {
  /** 图标名（不含集合内前缀） */
  icon: string
  /** 扩展名或具名文件；`filename: true` 时为具名文件 */
  extensions: string[]
  /** language id，可能是字符串、字符串数组或二者的嵌套数组 */
  languages?: (string | string[])[]
  /** 单个 language id，部分条目使用该字段 */
  language?: string | string[]
  /** 为 true 时 `extensions` 视为完整文件名 */
  filename?: boolean
  /** 文件名 glob 前缀 */
  filenamesGlob?: string[]
  /** 与 `filenamesGlob` 搭配的扩展名白名单 */
  extensionsGlob?: string[]
}

/** 翻译后的 IconSet 表结构片段，五张表均可选，这里统一归一为非空 */
type NewEntries = Required<
  Pick<IconSet, 'fileNames' | 'fileExtensions' | 'fileStems' | 'folderNames' | 'languageIds'>
>

/** 本脚本关心的诊断信息，复用 checks.ts 的检查结果 */
interface SyncDiagnostics {
  /** 新条目被已有声明覆盖，永远不会生效 */
  shadowed: string[]
  /** 新条目覆盖了已有声明，需要人工确认取舍 */
  overrides: string[]
  /** 永不命中的新条目 */
  unmatchable: { icon: string; entry: string; reason: string }[]
}

async function main(): Promise<void> {
  const source = iconSetSources.find((item) => item.label === COLLECTION)
  if (!source) {
    throw new Error(`未在 iconSetSources 中找到图标集合：${COLLECTION}`)
  }

  const { iconSet, availableIcons } = source
  const refresh = process.argv.includes('--refresh')

  console.log(`====================== ${ansis.magenta(COLLECTION)} =======================\n`)
  console.log(`数据集版本：${ansis.cyan(info.version)}（共 ${info.total} 个图标）`)

  // 1. 检查图标变更：以已安装数据集为基准比对 IconSet 的引用情况
  const usedIcons = collectUsedIcons(iconSet)
  const unknownIcons = findUnknownIcons(availableIcons, usedIcons)
  const { folderIcons, fileIcons } = partitionUnusedIcons(iconSet, availableIcons, usedIcons)

  if (unknownIcons.length > 0) {
    console.warn(`\n${ansis.yellow('失效图标')}（IconSet 引用但数据集已移除）：`)
    console.warn(`  ${printIcons(unknownIcons)}`)
  }

  if (folderIcons.length === 0 && fileIcons.length === 0) {
    console.log(`\n${ansis.green('无图标变更')}：数据集中的图标均已映射。`)
    // 清理上一次的产物，避免遗留的条目被误当作本次结果
    mkdirSync(TEMP_DIR, { recursive: true })
    rmSync(ENTRIES_FILE, { force: true })
    writeFileSync(
      REPORT_FILE,
      `${JSON.stringify(
        {
          source: { collection: COLLECTION, datasetVersion: info.version },
          changed: { newFileIcons: [], newFolderIcons: [], unknownIcons, unmappedIcons: [] },
        },
        null,
        2,
      )}\n`,
    )
    console.log(`\n报告：${relative(ROOT, REPORT_FILE)}`)
    return
  }

  const filePrefix = iconSet.filePrefix ?? ''
  const folderPrefix = iconSet.folderPrefix ?? ''
  const newFileIcons = fileIcons.map((icon) => stripPrefix(icon, filePrefix))
  const newFolderIcons = folderIcons.map((icon) => stripPrefix(icon, folderPrefix))

  console.log(`\n新增文件图标 (${ansis.blue(newFileIcons.length)}): ${printIcons(newFileIcons)}`)
  console.log(
    `新增文件夹图标 (${ansis.blue(newFolderIcons.length)}): ${printIcons(newFolderIcons)}`,
  )

  // 2. 从上游仓库获取同版本清单
  const version = info.version
  if (!version) {
    throw new Error('数据集 info.json 缺少 version 字段，无法定位上游 tag')
  }
  const cacheDir = join(TEMP_DIR, 'upstream', `${COLLECTION}-v${version}`)
  await fetchUpstream(cacheDir, version, refresh)

  const languageIds = await loadLanguageIds(cacheDir)
  const manifestFiles = await loadManifest(cacheDir, 'supportedExtensions.ts', languageIds)
  const manifestFolders = await loadManifest(cacheDir, 'supportedFolders.ts', languageIds)

  // 3. 翻译为 IconSet 表结构，并评估与现有数据的冲突
  const entries = buildEntries(manifestFiles, manifestFolders, newFileIcons, newFolderIcons)
  const unmappedIcons = [...newFileIcons, ...newFolderIcons].filter(
    (icon) => !entries.manifestIcons.has(icon),
  )
  const diagnostics = checkEntries(iconSet, entries.tables, newFileIcons, newFolderIcons)

  writeEntriesFile(entries.tables)
  writeFileSync(
    REPORT_FILE,
    `${JSON.stringify(
      {
        source: {
          collection: COLLECTION,
          datasetVersion: info.version,
          upstreamTag: `v${info.version}`,
        },
        changed: {
          newFileIcons,
          newFolderIcons,
          unknownIcons,
          unmappedIcons,
        },
        entries: entries.tables,
        diagnostics,
      },
      null,
      2,
    )}\n`,
  )

  printDiagnostics(diagnostics, unmappedIcons)
  console.log(`\n产物：`)
  console.log(`  条目：${relative(ROOT, ENTRIES_FILE)}`)
  console.log(`  报告：${relative(ROOT, REPORT_FILE)}`)
  console.log(`\n${ansis.green('请人工审核后合入 src/icon-set/vscode-icons.ts')}`)

  // 上游清单中缺失映射属于数据异常，需要人工补齐
  if (unmappedIcons.length > 0) {
    process.exitCode = 1
  }
}

/**
 * 下载上游清单到本地缓存
 *
 * @param cacheDir 缓存目录
 * @param version 数据集版本，用于拼接上游 tag
 * @param refresh 是否忽略缓存强制重新下载
 */
async function fetchUpstream(cacheDir: string, version: string, refresh: boolean): Promise<void> {
  const tag = `v${version}`
  const pending = UPSTREAM_FILES.filter((file) => refresh || !existsSync(join(cacheDir, file)))
  if (pending.length === 0) {
    console.log(`\n使用上游清单缓存：${relative(ROOT, cacheDir)}`)
    return
  }

  mkdirSync(cacheDir, { recursive: true })
  for (const file of pending) {
    const url = `${UPSTREAM_BASE}/${tag}/src/iconsManifest/${file}`
    const response = await fetch(url).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`下载上游清单失败：${url}\n  ${message}`)
    })
    if (!response.ok) {
      throw new Error(`下载上游清单失败（HTTP ${response.status}）：${url}`)
    }
    const text = await response.text()
    if (text.startsWith('404')) {
      throw new Error(`上游清单不存在，请确认版本 tag 是否正确：${url}`)
    }
    writeFileSync(join(cacheDir, file), text)
    console.log(`\n已下载 ${url}`)
  }
}

/**
 * 读取 language id 映射
 *
 * @param cacheDir 缓存目录
 * @returns language 键名到 id 列表的映射
 */
async function loadLanguageIds(cacheDir: string): Promise<Record<string, string[]>> {
  const raw = (await loadUpstreamExport(cacheDir, 'languages.ts', 'languages')) as Record<
    string,
    { ids: string | string[] }
  >
  const map: Record<string, string[]> = {}
  for (const [key, value] of Object.entries(raw)) {
    map[key] = Array.isArray(value.ids) ? value.ids : [value.ids]
  }
  return map
}

/**
 * 读取并解析上游图标清单
 *
 * 上游清单是 TS 源码，这里只做去 import、替换 `FileFormat` 与 `languages.xxx` 引用三步改写，
 * 再交给 Node 以 ESM 方式加载，避免使用 `new Function` 之类的动态求值。
 *
 * @param cacheDir 缓存目录
 * @param file 清单文件名
 * @param languageIds language id 映射
 * @returns 清单中的 supported 条目
 */
async function loadManifest(
  cacheDir: string,
  file: string,
  languageIds: Record<string, string[]>,
): Promise<ManifestEntry[]> {
  const collection = (await loadUpstreamExport(cacheDir, file, 'extensions', languageIds)) as {
    supported: ManifestEntry[]
  }
  return collection.supported
}

/**
 * 将上游 TS 清单改写为可加载的 ESM 模块并导入指定导出
 *
 * @param cacheDir 缓存目录
 * @param file 清单文件名
 * @param exportName 需要读取的导出名
 * @param languageIds language id 映射，缺省时不替换 `languages.xxx`
 * @returns 导出的值
 */
async function loadUpstreamExport(
  cacheDir: string,
  file: string,
  exportName: string,
  languageIds?: Record<string, string[]>,
): Promise<unknown> {
  const source = rewriteManifest(readFileSync(join(cacheDir, file), 'utf-8'), languageIds)
  const moduleFile = join(cacheDir, `${file}.generated.mjs`)
  writeFileSync(moduleFile, source)
  const module = (await import(pathToFileURL(moduleFile).href)) as Record<string, unknown>
  return module[exportName]
}

/**
 * 改写上游清单源码：去 import、替换运行时引用、剥离类型语法
 *
 * @param code 上游源码
 * @param languageIds language id 映射，缺省时不替换 `languages.xxx`
 * @returns 可被 Node 直接加载的 ESM 源码
 */
function rewriteManifest(code: string, languageIds?: Record<string, string[]>): string {
  let result = code.replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
  // FileFormat.svg -> 'svg'
  result = result.replace(/FileFormat\.(\w+)/g, "'$1'")
  if (languageIds) {
    result = result.replace(/languages\.([\w-]+)/g, (_, key: string) =>
      JSON.stringify(languageIds[key] ?? [key]),
    )
  }
  // 类型语法：satisfies 子句，以及 `const x: IFileCollection` / `Record<...>` 形态的类型注解
  result = result.replace(/\s+satisfies\s+[^;\n]*/g, '')
  result = result.replace(/:\s*(?:I[A-Z]\w*|Record<[^>\n]*>)/g, '')

  if (result.includes('import ')) {
    throw new Error('上游清单改写后仍包含 import 语句，请检查上游文件结构是否变化')
  }
  return result
}

/**
 * 把上游清单条目翻译为 IconSet 表结构
 *
 * 翻译规则与现有数据表保持一致：`filename: true` 的 `extensions` 视为具名文件，
 * `filenamesGlob` + `extensionsGlob` 视为精确的文件名规则，其余 `extensions` 视为扩展名，
 * `languages` 视为 language id，文件夹的 `extensions` 视为文件夹名。
 *
 * @param manifestFiles 上游文件清单
 * @param manifestFolders 上游文件夹清单
 * @param newFileIcons 新增文件图标名
 * @param newFolderIcons 新增文件夹图标名
 * @returns 翻译后的表结构与命中的图标名集合
 */
function buildEntries(
  manifestFiles: ManifestEntry[],
  manifestFolders: ManifestEntry[],
  newFileIcons: string[],
  newFolderIcons: string[],
): { tables: NewEntries; manifestIcons: Set<string> } {
  const fileNames: Record<string, string[]> = {}
  const fileExtensions: Record<string, string[]> = {}
  const fileStems: Record<string, IconSetStemRule[]> = {}
  const languageIds: Record<string, string[]> = {}
  const folderNames: Record<string, string[]> = {}
  const manifestIcons: Set<string> = new Set()

  for (const entry of manifestFiles) {
    if (!newFileIcons.includes(entry.icon)) {
      continue
    }
    manifestIcons.add(entry.icon)

    if (entry.filename) {
      if (entry.extensions.length > 0) {
        fileNames[entry.icon] = merge(fileNames[entry.icon], entry.extensions)
      }
      // filenamesGlob 与 extensionsGlob 组成「前缀 + 扩展名白名单」的精确规则
      if (entry.filenamesGlob?.length) {
        const rules = fileStems[entry.icon] ?? []
        for (const name of entry.filenamesGlob) {
          rules.push({ name, extensions: sorted(entry.extensionsGlob ?? []) })
        }
        fileStems[entry.icon] = rules
      }
    } else if (entry.extensions.length > 0) {
      fileExtensions[entry.icon] = merge(fileExtensions[entry.icon], entry.extensions)
    }

    const ids = flattenLanguageIds(entry)
    if (ids.length > 0) {
      languageIds[entry.icon] = merge(languageIds[entry.icon], ids)
    }
  }

  for (const entry of manifestFolders) {
    if (!newFolderIcons.includes(entry.icon)) {
      continue
    }
    manifestIcons.add(entry.icon)
    folderNames[entry.icon] = merge(folderNames[entry.icon], entry.extensions)
  }

  return {
    tables: {
      fileNames: sortKeys(fileNames),
      fileExtensions: sortKeys(fileExtensions),
      fileStems: sortKeys(fileStems),
      folderNames: sortKeys(folderNames),
      languageIds: sortKeys(languageIds),
    },
    manifestIcons,
  }
}

/**
 * 复用 checks.ts 的检查能力评估新条目
 *
 * 把新条目合并进现有图标集合后运行既有检查，可得到与 `pnpm validate` 完全一致的判定，
 * 避免在脚本里重新实现匹配规则。
 *
 * @param iconSet 现有图标集合
 * @param tables 新条目
 * @param newFileIcons 新增文件图标名
 * @param newFolderIcons 新增文件夹图标名
 * @returns 诊断信息
 */
function checkEntries(
  iconSet: IconSet,
  tables: NewEntries,
  newFileIcons: string[],
  newFolderIcons: string[],
): SyncDiagnostics {
  const candidate: IconSet = {
    ...iconSet,
    fileNames: { ...iconSet.fileNames, ...tables.fileNames },
    fileExtensions: { ...iconSet.fileExtensions, ...tables.fileExtensions },
    fileStems: { ...iconSet.fileStems, ...tables.fileStems },
    folderNames: { ...iconSet.folderNames, ...tables.folderNames },
    languageIds: { ...iconSet.languageIds, ...tables.languageIds },
  }
  const newFiles: Set<string> = new Set(newFileIcons)
  const newFolders: Set<string> = new Set(newFolderIcons)
  const isNew = (icon: string, kind: string): boolean =>
    kind === 'folderNames' ? newFolders.has(icon) : newFiles.has(icon)

  const shadowed: string[] = []
  const overrides: string[] = []
  for (const match of findDuplicateMatches(candidate)) {
    const iconIsNew = isNew(match.icon, match.kind)
    const winnerIsNew = isNew(match.winner, match.kind)
    if (iconIsNew && !winnerIsNew) {
      shadowed.push(`[${match.kind}] ${match.name}: 新增 ${match.icon} 被 ${match.winner} 覆盖`)
    } else if (!iconIsNew && winnerIsNew) {
      overrides.push(`[${match.kind}] ${match.name}: 新增 ${match.winner} 将覆盖 ${match.icon}`)
    } else if (iconIsNew && winnerIsNew) {
      shadowed.push(`[${match.kind}] ${match.name}: 新增条目之间重复声明`)
    }
  }

  const unmatchable = findUnmatchableEntries(candidate)
    .filter((item) => isNew(item.icon, item.kind))
    .map(({ icon, entry, reason }) => ({ icon, entry, reason }))

  // checks.ts 的 findUnmatchableEntries 未覆盖「名称含路径分隔符」：查找前只取 basename，
  // 含分隔符的名称永远不可能命中。这里针对新条目补一条输入契约层面的校验。
  const checkSeparator = (icon: string, value: string): void => {
    if (value.includes('/') || value.includes('\\')) {
      unmatchable.push({
        icon,
        entry: value,
        reason: '名称含路径分隔符，而查找前输入只取 basename',
      })
    }
  }
  for (const table of ['fileNames', 'fileExtensions', 'folderNames'] as const) {
    for (const [icon, names] of Object.entries(tables[table])) {
      for (const name of names) {
        checkSeparator(icon, name)
      }
    }
  }
  for (const [icon, rules] of Object.entries(tables.fileStems)) {
    for (const rule of rules) {
      checkSeparator(icon, rule.name)
    }
  }

  return { shadowed, overrides, unmatchable }
}

/**
 * 输出诊断信息
 *
 * @param diagnostics 诊断信息
 * @param unmappedIcons 上游清单中缺失映射的图标
 */
function printDiagnostics(diagnostics: SyncDiagnostics, unmappedIcons: string[]): void {
  if (diagnostics.overrides.length > 0) {
    console.warn(`\n${ansis.yellow('覆盖已有映射')}（需要人工确认取舍）：`)
    for (const item of diagnostics.overrides) {
      console.warn(`  ${item}`)
    }
  }
  if (diagnostics.shadowed.length > 0) {
    console.warn(`\n${ansis.red('不会生效的新条目')}：`)
    for (const item of diagnostics.shadowed) {
      console.warn(`  ${item}`)
    }
  }
  if (diagnostics.unmatchable.length > 0) {
    console.warn(`\n${ansis.red('永不命中的新条目')}：`)
    for (const { icon, entry, reason } of diagnostics.unmatchable) {
      console.warn(`  [${icon}] ${ansis.cyan(entry)}：${reason}`)
    }
  }
  if (unmappedIcons.length > 0) {
    console.warn(`\n${ansis.red('上游清单中缺少映射')}：`)
    console.warn(`  ${printIcons(unmappedIcons)}`)
    console.warn('  请人工补齐映射，或将其加入 scripts/ignore-icons.ts 的忽略列表。')
  }
}

/**
 * 写入生成的条目文件
 *
 * @param tables 翻译后的表结构
 */
function writeEntriesFile(tables: NewEntries): void {
  mkdirSync(TEMP_DIR, { recursive: true })
  const lines: string[] = [
    '// 本文件由 scripts/sync-icons.ts 生成，仅供人工审核，请勿直接提交或合入。',
    '// 数据来源：@iconify-json/vscode-icons 数据集与 vscode-icons 上游清单。',
    "import type { IconSet } from '../src/types.js'",
    '',
    "export const newVscodeIconsEntries: Pick<IconSet, 'fileNames' | 'fileExtensions' | 'fileStems' | 'folderNames' | 'languageIds'> = {",
  ]

  const tableNames = [
    'fileNames',
    'fileExtensions',
    'fileStems',
    'folderNames',
    'languageIds',
  ] as const
  for (const name of tableNames) {
    lines.push(`  ${name}: {`)
    if (name === 'fileStems') {
      for (const [icon, rules] of Object.entries(tables.fileStems)) {
        lines.push(`    '${icon}': ${renderStemRules(rules)},`)
      }
    } else {
      for (const [icon, values] of Object.entries(tables[name])) {
        lines.push(`    '${icon}': [${values.map((value) => `'${value}'`).join(', ')}],`)
      }
    }
    lines.push('  },')
  }
  lines.push('}')
  lines.push('')

  writeFileSync(ENTRIES_FILE, lines.join('\n'))
}

/**
 * 渲染文件名规则数组
 *
 * @param rules 文件名规则
 * @returns TS 源码文本
 */
function renderStemRules(rules: IconSetStemRule[]): string {
  const parts = rules.map((rule) =>
    rule.extensions === '*'
      ? `{ name: '${rule.name}', extensions: '*' }`
      : `{ name: '${rule.name}', extensions: [${rule.extensions.map((ext) => `'${ext}'`).join(', ')}] }`,
  )
  return `[${parts.join(', ')}]`
}

/**
 * 去掉图标名上的集合内前缀
 *
 * @param icon 数据集中的图标名
 * @param prefix 集合内前缀
 * @returns 不含前缀的图标名
 */
function stripPrefix(icon: string, prefix: string): string {
  return prefix !== '' && icon.startsWith(prefix) ? icon.slice(prefix.length) : icon
}

/**
 * 展平清单条目中的 language id
 *
 * @param entry 清单条目
 * @returns language id 列表
 */
function flattenLanguageIds(entry: ManifestEntry): string[] {
  const raw = entry.languages ?? (entry.language ? [entry.language] : [])
  return raw.flatMap((value) => (Array.isArray(value) ? value : [value]))
}

/**
 * 合并并升序去重
 *
 * @param current 已有取值
 * @param values 追加取值
 * @returns 排序去重后的列表
 */
function merge(current: string[] | undefined, values: string[]): string[] {
  return sorted([...(current ?? []), ...values])
}

/**
 * 升序去重排序
 *
 * @param values 取值列表
 * @returns 排序去重后的列表
 */
function sorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}

/**
 * 按 key 升序重排对象
 *
 * @param obj 原对象
 * @returns 排序后的新对象
 */
function sortKeys<T>(obj: Record<string, T>): Record<string, T> {
  const result: Record<string, T> = {}
  for (const key of Object.keys(obj).sort()) {
    result[key] = obj[key]!
  }
  return result
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

main().catch((error: unknown) => {
  console.error(ansis.red(`同步失败：${error instanceof Error ? error.message : String(error)}`))
  process.exitCode = 1
})
