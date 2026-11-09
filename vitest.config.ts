import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/e2e/**', '**/.output/**'],
    // Timeouts are per project and not inherited from here: see vitest.shared.ts.
    projects: ['packages/*', 'apps/*'],
  },
})
