import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { pgliteTimeouts } from '../../vitest.shared'

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    name: 'web',
    include: ['src/**/*.test.{ts,tsx}'],
    passWithNoTests: true,
    ...pgliteTimeouts,
  },
})
