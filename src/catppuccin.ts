import type { IconFinder } from './types.js'
import { createFinder } from './core/create-finder.js'
import { catppuccin } from './icon-set/catppuccin.js'

/**
 * Based on the input path, find the icon name in the iconify catppuccin collection that matches that path.
 *
 * This method does not check whether the path actually exists,
 * and it cannot accurately determine whether the path is a file or a folder.
 * It is recommended to explicitly specify `type` to avoid icon lookup errors caused by misjudgment.
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
 * and is matched against the icon set's `languageIds` after trimming and lower-casing.
 * Language icons are also consulted last in the untyped inference above, after the file and folder tables.
 * An unknown language id resolves to the default file icon.
 *
 * 根据输入路径，查找 iconify catppuccin 集合中，符合该路径的 图标名
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
 * 会去除首尾空白并转为小写后，从图标集合的 `languageIds` 中查找。
 * 上面的无类型推断也会在文件表、文件夹表之后，最后查找语言表。
 * 未命中的 language id 会返回默认文件图标。
 *
 * @param input input filepath / 输入路径
 * @param type File type / 文件类型
 * @returns IconInfo / 图标查找结果
 */
export const findFileIcon: IconFinder = createFinder(catppuccin)

export type * from './types.js'
