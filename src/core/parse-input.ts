/** 结尾的分隔符，输入已归一化为 `/` */
const RE_ENDING_SLASH = /\/+$/
/** 任意路径分隔符，`\\` 用于兼容 Windows 路径 */
const RE_SLASH = /[/\\]+/g

/**
 * 去掉结尾的分隔符
 *
 * @param value 已归一化的路径
 * @returns 去掉结尾分隔符的路径
 */
function removeEndingSlashes(value: string): string {
  return value.replace(RE_ENDING_SLASH, '')
}

/**
 * 解析输入路径，得到用于匹配的名称与文件夹判定
 *
 * 处理顺序：`\` 与连续分隔符统一为 `/` → 记录是否以分隔符结尾
 * → 去掉结尾分隔符 → 取最后一段作为匹配名称并转为小写。
 *
 * @param input 输入路径或文件名，非字符串输入按空路径处理
 * @returns 小写的匹配名称，以及是否能确定是文件夹
 */
export function parseFilePath(input: string): { name: string; isFolder: boolean } {
  // 兼容 JS 消费方传入的非字符串输入（如 `undefined`）：
  // 按空路径处理，使查找器回落到默认图标，而不是抛出 TypeError
  const normalized = (typeof input === 'string' ? input.replace(RE_SLASH, '/') : '').trim()
  // 以分隔符结尾即可确定是文件夹，反之不成立：
  // 不以分隔符结尾也可能是文件夹，因此 `isFolder` 为 false 不代表是文件
  const isFolder = normalized.endsWith('/')
  const trimmed = removeEndingSlashes(normalized)
  const index = trimmed.lastIndexOf('/')
  const name = index === -1 ? trimmed : trimmed.slice(index + 1)

  return { name: name.toLowerCase(), isFolder }
}
