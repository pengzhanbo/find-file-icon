import type { OxlintConfig } from 'oxlint'
import oxlintConfig from '@pengzhanbo/oxc-config/oxlint'

const config: OxlintConfig = oxlintConfig({
  node: {
    files: ['scripts/**/*.ts', 'vitest.config.ts'],
    env: { node: true },
  },
})

export default config
