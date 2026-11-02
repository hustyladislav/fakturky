import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.E2E_PORT ?? 3100)
const ARES_PORT = Number(process.env.ARES_MOCK_PORT ?? 3199)
// E2E_BASE_URL targets an already running app. That app must be started with
// ARES_BASE_URL pointing at e2e/ares-mock.mjs (run `node e2e/ares-mock.mjs`), because the
// journeys onboard with synthetic IČOs that only exist in the mock. Use a local/test database.
const external = process.env.E2E_BASE_URL
const baseURL = external ?? `http://localhost:${PORT}`
const ci = !!process.env.CI

export default defineConfig({
  testDir: './e2e',
  // Journeys share one fresh database and each creates its own test-only account.
  fullyParallel: false,
  workers: 1,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: ci ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    locale: 'cs-CZ',
    timezoneId: 'Europe/Prague',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node e2e/ares-mock.mjs',
      url: `http://127.0.0.1:${ARES_PORT}/12345008`,
      reuseExistingServer: !ci,
      env: { ARES_MOCK_PORT: String(ARES_PORT) },
    },
    ...(external
      ? []
      : [
          {
            // Local PGlite database in a throw-away directory — never a real DATABASE_URL.
            command: `rm -rf .data/pglite-e2e && vite dev --port ${PORT} --strictPort`,
            url: `${baseURL}/prihlaseni`,
            reuseExistingServer: false,
            stderr: process.env.E2E_SERVER_LOGS ? ('pipe' as const) : ('ignore' as const),
            timeout: 120_000,
            env: {
              DATABASE_URL: '',
              PGLITE_DIR: '.data/pglite-e2e',
              BETTER_AUTH_URL: baseURL,
              ARES_BASE_URL: `http://127.0.0.1:${ARES_PORT}`,
              CRON_SECRET: 'e2e-'.repeat(6),
            },
          },
        ]),
  ],
})
