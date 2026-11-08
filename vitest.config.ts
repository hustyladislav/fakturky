import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/e2e/**', '**/.output/**'],
    // Each PGlite-backed file boots and migrates its own database; on a busy machine that outlasts the defaults.
    hookTimeout: 120_000,
    testTimeout: 60_000,
    projects: ['packages/*', 'apps/*'],
  },
})
