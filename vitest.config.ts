import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/e2e/**', '**/.output/**'],
    projects: ['packages/*', 'apps/*'],
  },
})
