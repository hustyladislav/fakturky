import { expect, test } from 'vitest'
import { continueAfterAuth } from './continue'

test('an OAuth authorization in progress resumes at the authorize endpoint', () => {
  const search = '?client_id=https%3A%2F%2Fa.example%2Fc.json&response_type=code&state=x&sig=abc'
  expect(continueAfterAuth(search)).toBe(`/api/auth/oauth2/authorize${search}`)
})

test.each(['', '?next=https://evil.example', '?client_id=x', '?response_type=code'])(
  'a plain sign-in does not redirect anywhere (%s)',
  (search) => {
    expect(continueAfterAuth(search)).toBeNull()
  },
)
