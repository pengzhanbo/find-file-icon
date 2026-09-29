import type { UserProjectConfigExport } from 'vitest/config'
import { coverageConfigDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['**/*.test.[tj]s'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    env: { TZ: 'Etc/UTC' },
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'clover', 'json'],
      // `src/index.ts` 仅做 re-export，不含可执行语句，
      // 保留在报告中会产生无意义的 0% 覆盖率，因此排除。
      //
      // `scripts/` 为构建期工具，不随包发布，验收步骤是 `pnpm validate` 本身；
      // 其中只有部分函数被单元测试调用，计入统计只会稀释 `src/` 的指标。
      exclude: [...coverageConfigDefaults.exclude, 'src/index.ts', 'scripts/**', 'coverage/**'],
    },
  },
}) as UserProjectConfigExport
