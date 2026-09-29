import type { IconSet } from '../types.js'
import type { ResolvedIconSet, ResolvedIconSetFileStem } from './internal-types.js'

/**
 * 将声明式图标集合展平为运行时查找表
 *
 * 1. 把 `图标名 → 名称[]` 反转为 `名称 → 图标名` 的无原型对象，避免原型链属性被误命中；
 * 2. 精确匹配的规则（`exact !== false` 且 `extensions !== '*'`）在此预展开为具名文件，
 *    运行时只需一次哈希查找；只有 `exact: false` / `'*'` 规则保留在 `fileStems` 中按声明顺序匹配。
 *
 * 五个查找表在 `IconSet` 中均为可选，缺省时按空表处理。
 *
 * @param iconSet 图标集合
 * @returns 展平后的查找表
 */
export function transformer(iconSet: IconSet): ResolvedIconSet {
  const folderNames = transformNamedIconSet(iconSet.folderNames)
  const fileNames = transformNamedIconSet(iconSet.fileNames)
  const fileExtensions = transformNamedIconSet(iconSet.fileExtensions)
  const languageIds = transformNamedIconSet(iconSet.languageIds, normalizeLanguageId)
  const fileStems: ResolvedIconSetFileStem[] = []

  for (const [icon, stems] of Object.entries(iconSet.fileStems ?? {})) {
    for (const { name, extensions, exact } of stems) {
      // 前缀规则与通配规则需要在运行时按声明顺序匹配，保留原始规则（通配形态不参考 exact）
      if (exact === false || extensions === '*') {
        fileStems.push({ name, icon, extensions })
      } else {
        // 精确匹配的规则展开为具名文件；空扩展名表示无扩展名（如 `.hidden`）
        for (const extension of extensions) {
          const ext = extension ? `.${extension}` : ''
          fileNames[name + ext] = icon
        }
      }
    }
  }
  return {
    folderNames,
    fileNames,
    fileExtensions,
    languageIds,
    fileStems,
  }
}

/**
 * 归一化 language id
 *
 * language id 大小写不敏感：查找前输入会去除首尾空白并转为小写，
 * 因此建表时使用同一套规则归一化键，使数据中的 `Cangjie`、`Swagger` 这类写法同样能被命中。
 *
 * @param value language id
 * @returns 归一化后的 language id
 */
export function normalizeLanguageId(value: string): string {
  return value.trim().toLowerCase()
}

/**
 * 将 `图标名 → 名称[]` 反转为 `名称 → 图标名` 的无原型对象
 *
 * 同一名称被多个图标声明时，后声明者覆盖先声明者。
 *
 * @param data 图标名与名称列表的映射
 * @param normalizeKey 键的归一化函数，缺省时原样建表
 * @returns 名称与图标名的映射
 */
function transformNamedIconSet(
  data: Record<string, string[]> = {},
  normalizeKey?: (key: string) => string,
): Record<string, string> {
  const result: Record<string, string> = Object.create(null)
  for (const [icon, names] of Object.entries(data)) {
    for (const name of names) {
      result[normalizeKey ? normalizeKey(name) : name] = icon
    }
  }
  return result
}
