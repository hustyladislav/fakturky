import { expect, test } from 'vitest'
import { isCronAuthorized } from './cron-auth'

const secret = 'a-long-enough-cron-secret'
const req = (authorization?: string) =>
  new Request('https://x.test/api/cron/recurring', {
    headers: authorization ? { authorization } : {},
  })

test('cron accepts only the exact bearer secret', () => {
  expect(isCronAuthorized(req(`Bearer ${secret}`), secret)).toBe(true)
  expect(isCronAuthorized(req(), secret)).toBe(false)
  expect(isCronAuthorized(req(secret), secret)).toBe(false)
  expect(isCronAuthorized(req(`Bearer ${secret}x`), secret)).toBe(false)
  expect(isCronAuthorized(req(`bearer ${secret}`), secret)).toBe(false)
})

test('an unset or weak secret never authorises, not even an empty bearer', () => {
  expect(isCronAuthorized(req('Bearer '), undefined)).toBe(false)
  expect(isCronAuthorized(req('Bearer '), '')).toBe(false)
  expect(isCronAuthorized(req('Bearer short'), 'short')).toBe(false)
})
