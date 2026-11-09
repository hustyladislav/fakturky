import { afterEach, expect, test, vi } from 'vitest'
import { runCronJob } from './cron'

afterEach(() => vi.unstubAllEnvs())

const req = (authorization?: string) =>
  new Request('https://x.test/api/cron/reminders', {
    headers: authorization ? { authorization } : {},
  })

test.each(['recurring', 'reminders', 'bankSync'] as const)(
  '%s refuses a caller without the cron secret, before touching the database',
  async (job) => {
    vi.stubEnv('CRON_SECRET', 'a-long-enough-cron-secret')
    expect((await runCronJob(req(), job)).status).toBe(401)
    expect((await runCronJob(req('Bearer wrong'), job)).status).toBe(401)
  },
)

test('a weak secret authorises nobody, even when the caller knows it', async () => {
  vi.stubEnv('CRON_SECRET', 'short')
  expect((await runCronJob(req('Bearer short'), 'reminders')).status).toBe(401)
})
