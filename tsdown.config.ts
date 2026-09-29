import type { UserConfig } from 'tsdown'
import { defineConfig } from 'tsdown'

const config: UserConfig = defineConfig({
  entry: {
    'index': 'src/index.ts',
    'vscode-icons': 'src/vscode-icons.ts',
    'catppuccin': 'src/catppuccin.ts',
    'core': 'src/core/create-finder.ts',
    'icon-set/*': 'src/icon-set/*.ts',
  },
  clean: true,
  dts: true,
  format: 'esm',
  exports: true,
  // 构建后对打包产物运行 publint，校验 exports / 类型解析等发布相关问题
  publint: true,
  fixedExtension: false,
})

export default config
