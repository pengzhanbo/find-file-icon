/**
 * 图标类型
 */
export type IconType = 'file' | 'folder' | 'language'

/**
 * 文件图标查找结果
 */
export interface FileIconInfo {
  /**
   * 图标类型
   */
  type: 'file'
  /**
   * iconify 完整图标名（含集合前缀），如 `vscode-icons:file-type-typescript`
   */
  name: string
}

/**
 * 文件夹图标查找结果，同时携带折叠态与展开态
 */
export interface FolderIconInfo {
  /**
   * 图标类型
   */
  type: 'folder'
  /**
   * 折叠态 iconify 完整图标名，如 `vscode-icons:folder-type-src`
   */
  name: string
  /**
   * 展开态 iconify 完整图标名，如 `vscode-icons:folder-type-src-opened`
   */
  expandedName: string
}

/**
 * 语言图标查找结果
 */
export interface LanguageIconInfo {
  /**
   * 图标类型
   */
  type: 'language'
  /**
   * iconify 完整图标名（含集合前缀），如 `vscode-icons:file-type-typescript`
   */
  name: string
}

/**
 * 图标查找结果
 */
export type IconInfo = FileIconInfo | FolderIconInfo | LanguageIconInfo

/**
 * 图标集合默认图标名
 *
 * 取值为不含集合内前缀（`filePrefix` / `folderPrefix`）的完整图标名，
 * 最终返回时会拼接 `collect` 前缀。
 */
export interface IconSetDefaults {
  /**
   * 文件图标默认图标名
   */
  file: string

  /**
   * 文件夹图标默认图标名
   */
  folder: string
  /**
   * 文件夹图标展开态默认图标名，可选
   *
   * 默认值为 `folder` + `folderExpandedSuffix`
   */
  folderExpanded?: string
}

/**
 * 文件名规则
 *
 * `extensions` 与 `exact` 的语义互斥，由联合类型在编译期保证：
 * - 扩展名列表形态（`exact` 默认 `true`）：文件名必须完全等于 `name` + `.` + 任一扩展名；
 *   `exact: false` 时文件名以 `name` 开头且其后紧跟 `.`，并以任一扩展名结尾；
 * - 通配形态（`extensions: '*'`）：匹配 `name` 本身或任意 `name.<后缀>`，与 `exact` 无关，
 *   因此该形态下不允许声明 `exact`。
 */
export type IconSetStemRule =
  | {
      /**
       * 文件名或文件名前缀（视 `exact` 而定）
       */
      name: string
      /**
       * `'*'` 表示任意扩展名，规则匹配 `name` 本身或任意 `name.<后缀>`
       */
      extensions: '*'
      /**
       * 通配形态下 `exact` 不生效，显式声明会被类型系统拒绝
       */
      exact?: never
    }
  | {
      /**
       * 文件名或文件名前缀（视 `exact` 而定）
       */
      name: string
      /**
       * 允许的扩展名列表（不含前导点，空字符串表示无扩展名）
       */
      extensions: string[]
      /**
       * 是否严格匹配文件名
       *
       * - true: 文件名必须完全相同
       * - false: 文件名可以仅匹配前缀
       *
       * @default true
       */
      exact?: boolean
    }

/**
 * 图标集合定义
 *
 * 声明式的 `图标名 → 名称列表` 数据表，由 `transformer` 在构造查找器时展平为查表结构。
 *
 * 仅 `collect` 与 `defaults` 为必填：它们是图标名前缀与兜底图标，缺失时无法产出合法图标名。
 * 五个查找表均可选，缺省时按空表处理，调用方只需声明自己关心的部分。
 *
 * 构造期只校验 `collect` 与 `defaults` 是否缺失，不校验查找表与规则的形状——后者由类型约束。
 * 非 TypeScript 消费方需自行保证数据符合本接口，否则会得到错误的查找结果，而不是抛错。
 */
export interface IconSet {
  /**
   * 图标集合前缀，如 `vscode-icons` （取自 iconify 集合名）
   */
  collect: string

  /**
   * 文件夹图标展开态图标名后缀，如 `-opened`
   */
  folderExpandedSuffix?: string

  /**
   * 文件图标前缀，如 `file-type-`
   */
  filePrefix?: string
  /**
   * 文件夹图标前缀，如 `folder-type-`
   */
  folderPrefix?: string

  /**
   * 图标集合默认图标名
   */
  defaults: IconSetDefaults

  /**
   * 图标名 → 具名文件名列表
   *
   * @default {} 缺省时视为空表
   */
  fileNames?: Record<string, string[]>

  /**
   * 图标名 → 具名文件夹名列表
   *
   * @default {} 缺省时视为空表
   */
  folderNames?: Record<string, string[]>

  /**
   * 图标名 → 文件扩展名列表（不含前导点）
   *
   * @default {} 缺省时视为空表
   */
  fileExtensions?: Record<string, string[]>

  /**
   * 图标名 → 文件名规则列表
   *
   * 键需为非整数样字符串：整数样键会被 JS 排到对象键序最前，
   * 破坏规则按声明顺序匹配的语义；`pnpm validate` 会对此告警。
   *
   * @default {} 缺省时视为空表
   */
  fileStems?: Record<string, IconSetStemRule[]>

  /**
   * 图标名 → language id 列表
   *
   * language id 为 VS Code 的语言标识（如 `typescript`、`platformio-debug.asm`），
   * 用于按语言查找图标，与文件路径无关。
   *
   * 图标名与 `fileExtensions` 一致，不含集合内前缀（`filePrefix`）。
   * 同一 language id 被多个图标声明时，后声明者生效。
   *
   * @default {} 缺省时视为空表
   */
  languageIds?: Record<string, string[]>
}

/**
 * Find the icon name based on the input path.
 *
 * This method does not check whether the path actually exists, and it cannot accurately determine whether the path is a file or a folder. It is recommended to explicitly specify `type` to avoid icon lookup errors caused by misjudgment.
 *
 * When `type` is not specified:
 * - If the path ends with `/`, it is treated as a folder, and the corresponding folder icon is returned.
 * - If the type cannot be determined, it searches among file icons, then folder icons, then language icons. If none of them match, the default file icon is returned.
 *
 * When this method cannot find the corresponding icon,
 * it returns a default icon based on the path type.
 * If it cannot determine whether it is a file or a folder,
 * it returns the default file icon by default.
 *
 * Non-string input (e.g. `undefined`) is treated as an empty path and resolves to the default icon.
 *
 * When `type` is `'language'`, `input` is treated as a language id (e.g. `typescript`) instead of a path,
 * and is matched against `IconSet.languageIds` after trimming and lower-casing.
 * Language icons are also consulted last in the untyped inference described above, after the file and folder tables.
 * An unknown language id resolves to the collection's default file icon.
 *
 * 根据输入路径，查找 图标名
 *
 * 此方法不会检查路径是否真实存在，且无法准确判断路径为文件或文件夹，
 * 建议显式指定 `type`，以避免误判导致的图标查找错误。
 *
 * 当未指定 `type` 时：
 * - 如果路径以 `/` 结尾，则判断为文件夹，返回对应的文件夹图标
 * - 无法判断类型时，则依次从文件图标、文件夹图标、语言图标中查找，
 *   如果都未找到，则返回默认文件图标
 *
 * 此方法查找不到对应的图标时，会根据路径类型，返回默认图标。
 * 无法判断为文件或文件夹时，默认返回文件图标。
 *
 * 非字符串输入（如 `undefined`）按空路径处理，会返回默认图标。
 *
 * 当 `type` 为 `'language'` 时，`input` 按 language id（如 `typescript`）处理而非路径，
 * 会去除首尾空白并转为小写后，从 `IconSet.languageIds` 中查找。
 * 上面的无类型推断也会在文件表、文件夹表之后，最后查找语言表。
 * 未命中的 language id 会返回该图标集合的默认文件图标。
 *
 * @param input input filepath / 输入路径
 * @param type File type / 文件类型
 * @returns IconInfo / 图标查找结果
 */
export interface IconFinder {
  (input: string, type: 'file'): FileIconInfo
  (input: string, type: 'folder'): FolderIconInfo
  (input: string, type: 'language'): LanguageIconInfo
  (input: string, type: IconType | undefined): IconInfo
  (input: string): IconInfo
}
