/**
 * 运行期按声明顺序匹配的文件名规则，由 `IconSetStemRule` 归一化而来
 */
export interface ResolvedIconSetFileStem {
  /**
   * 文件名匹配前缀
   */
  name: string
  /**
   * 命中后返回的图标名（不含集合内前缀）
   */
  icon: string
  /**
   * 允许的扩展名列表（不含前导点），`'*'` 表示任意扩展名
   */
  extensions: string[] | '*'
}

/**
 * `IconSet` 展平后的查找表
 *
 * 字典型字段均为无原型对象，可直接用 `hasOwnProperty` 安全读取。
 */
export interface ResolvedIconSet {
  /**
   * 文件夹名 → 图标名
   */
  folderNames: Record<string, string>

  /**
   * 文件名 → 图标名（已包含精确匹配规则展开出的具名文件）
   */
  fileNames: Record<string, string>

  /**
   * 文件扩展名（不含前导点）→ 图标名
   */
  fileExtensions: Record<string, string>

  /**
   * language id → 图标名
   */
  languageIds: Record<string, string>

  /**
   * 需要在运行时匹配的文件名规则
   */
  fileStems: ResolvedIconSetFileStem[]
}
