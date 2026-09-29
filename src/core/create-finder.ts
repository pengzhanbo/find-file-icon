import type {
  FileIconInfo,
  FolderIconInfo,
  IconInfo,
  IconSet,
  IconFinder,
  IconType,
} from '../types.js'
import { parseFilePath } from './parse-input.js'
import { transformer } from './transformer.js'

/**
 * 检查查找表是否包含指定键
 *
 * 查找表为无原型对象，且建表时已去重，
 * 这里同时校验键值不为 `undefined`，兼容 JS 消费方传入的异常数据。
 *
 * @param obj - 查找表
 * @param key - 目标键名
 * @returns 是否命中（键存在且值为字符串）
 */
function hasOwn(obj: Record<string, string>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined
}

/**
 * 收集图标集合中缺失的必填字段
 *
 * 只有 `collect` 与 `defaults` 是必填项：二者是图标名前缀与兜底图标，
 * 缺失时会产生 `undefined:file` 这类非法图标名。四个查找表均可选，缺省时按空表处理。
 *
 * @param iconSet - 图标集合（可能不完整）
 * @returns 缺失字段名列表，必填字段齐全时为空数组
 */
function collectMissingFields(iconSet: Partial<IconSet>): string[] {
  const missing: string[] = []
  if (!iconSet.collect) {
    missing.push('collect')
  }
  if (!iconSet.defaults?.file) {
    missing.push('defaults.file')
  }
  if (!iconSet.defaults?.folder) {
    missing.push('defaults.folder')
  }
  return missing
}

/**
 * 创建单一图标集下的文件图标查找器
 *
 * 构造时通过 `transformer` 将声明式图标集合展平为查找表，
 * 之后的每次查找都是纯同步的查表，无 I/O、无异步。
 *
 * @param iconSet - 图标集合
 * @returns 图标查找器
 * @throws {TypeError} 缺少必填字段（`collect`、`defaults.file`、`defaults.folder`）时抛出，避免后续查找产生难以定位的错误；
 * 这里只校验必填字段，查找表与规则的形状由类型约束，不做运行时校验
 */
export function createFinder(iconSet: IconSet): IconFinder {
  const missingFields = collectMissingFields(iconSet)
  if (missingFields.length > 0) {
    const fields = missingFields.join(', ')
    throw new TypeError(
      `[find-file-icon] Invalid IconSet: missing ${fields} / 图标集合缺少必填字段：${fields}`,
    )
  }

  const { fileNames, fileExtensions, fileStems, folderNames } = transformer(iconSet)
  const {
    collect,
    defaults,
    folderExpandedSuffix = '',
    filePrefix = '',
    folderPrefix = '',
  } = iconSet

  // 默认图标是跨调用共享的单例，冻结后调用方的原地修改不会污染后续查找
  const defaultFileIcon: FileIconInfo = Object.freeze<FileIconInfo>({
    type: 'file',
    name: `${collect}:${defaults.file}`,
  })
  // `folderExpanded` 为空字符串时视为未配置，回落到 `folder` + 展开后缀，
  // 否则会拼出 `collect:` 这类非法图标名
  const configuredFolderExpanded = defaults.folderExpanded ?? ''
  const defaultFolderExpanded =
    configuredFolderExpanded.length > 0
      ? configuredFolderExpanded
      : defaults.folder + folderExpandedSuffix
  const defaultFolderIcon: FolderIconInfo = Object.freeze<FolderIconInfo>({
    type: 'folder',
    name: `${collect}:${defaults.folder}`,
    expandedName: `${collect}:${defaultFolderExpanded}`,
  })

  /**
   * 查找文件夹图标
   *
   * 仅支持精确匹配，命中即返回折叠态与展开态两个图标名。
   *
   * @param foldername - 文件夹名
   * @returns 文件夹图标信息，未命中时为 `undefined`
   */
  const findFolder = (foldername: string): FolderIconInfo | undefined => {
    if (!hasOwn(folderNames, foldername)) {
      return undefined
    }

    // 已由 hasOwn 判定命中，这里断言取值非空，与 findFile 的取值风格保持一致
    const icon = `${collect}:${folderPrefix}${folderNames[foldername]!}`
    return {
      type: 'folder',
      name: icon,
      // 展开态图标名为折叠态图标名拼接展开后缀
      expandedName: icon + folderExpandedSuffix,
    }
  }

  /**
   * 标准化文件图标
   *
   * 文件图标名由集合前缀、文件前缀与图标名拼接而成。
   *
   * @param name - 图标名
   * @returns 文件图标信息
   */
  const normalizeFile = (name: string): FileIconInfo => ({
    type: 'file',
    name: `${collect}:${filePrefix}${name}`,
  })

  /**
   * 查找文件图标
   *
   * 查找优先级：具名文件精确匹配 → 文件名规则（按声明顺序）→ 扩展名（最长后缀优先）。
   *
   * @param filename - 文件名
   * @returns 文件图标信息，未命中时为 `undefined`
   */
  const findFile = (filename: string): FileIconInfo | undefined => {
    // 具名文件，哈希表 O(1) 查找
    if (hasOwn(fileNames, filename)) {
      return normalizeFile(fileNames[filename]!)
    }

    // 按文件名规则匹配，先声明者优先
    for (const { name, icon, extensions } of fileStems) {
      if (!filename.startsWith(name)) {
        continue
      }

      // 通配符表示，后面可以接任意扩展字符
      // 1. 无扩展名，例如: `.env`
      // 2. 任意扩展名，例如: `.env.development` / `.env.local`
      if (extensions === '*' && (filename === name || filename[name.length] === '.')) {
        return normalizeFile(icon)
      }

      // 规则限定了扩展名白名单：
      // 1. 前缀后必须紧跟 `.`，避免 `jest.configuration.ts` 这类同名前缀被误判；
      // 2. 文件名需以 `.` + 白名单中的任一扩展名结尾（数据中的扩展名不含前导点）
      if (
        extensions !== '*' &&
        extensions.length &&
        filename[name.length] === '.' &&
        extensions.some((ext) => filename.endsWith(`.${ext}`))
      ) {
        return normalizeFile(icon)
      }
    }

    // 按扩展名匹配：从第一个 `.` 开始逐段缩短后缀，最长后缀优先
    // 例如 `bundle.js.map` 先尝试 `js.map`，未命中再尝试 `map`
    let index = filename.indexOf('.')
    while (index !== -1) {
      const extension = filename.slice(index + 1)
      if (hasOwn(fileExtensions, extension)) {
        return normalizeFile(fileExtensions[extension]!)
      }
      index = filename.indexOf('.', index + 1)
    }

    return undefined
  }

  const finder = (input: string, type?: IconType): IconInfo => {
    const { name, isFolder } = parseFilePath(input)

    // type 显式指定时以调用方为准，未命中则回落到该类型的默认图标
    if (type === 'folder') {
      return findFolder(name) ?? defaultFolderIcon
    }

    if (type === 'file') {
      return findFile(name) ?? defaultFileIcon
    }

    // 未指定 type：结尾分隔符已能确定是文件夹时只查文件夹
    if (isFolder) {
      return findFolder(name) ?? defaultFolderIcon
    }

    // 类型不确定：按 文件 → 文件夹 → 默认文件图标 的顺序推断
    return findFile(name) ?? findFolder(name) ?? defaultFileIcon
  }

  // 实现签名无法同时满足 IconFinder 的三组重载，这里的断言是必要的
  return finder as IconFinder
}
