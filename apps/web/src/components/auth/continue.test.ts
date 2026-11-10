import { expect, test } from 'vitest'
import { continueAfterAuth } from './continue'

test('an OAuth authorization in progress resumes at the authorize endpoint', () => {
  const search = '?client_id=https%3A%2F%2Fa.example%2Fc.json&response_type=code&state=x&sig=abc'
  expect(continueAfterAuth(search)).toBe(`/api/auth/oauth2/authorize${search}`)
})

test('a device approval in progress returns to its page', () => {
  expect(continueAfterAuth('?pripojit=ABCD1234')).toBe('/pripojit?user_code=ABCD1234')
})

test.each([
  '',
  '?next=https://evil.example',
  '?client_id=x',
  '?response_type=code',
  '?pripojit=//evil.example',
  '?pripojit=a%26b%3Dc',
])('a plain sign-in does not redirect anywhere (%s)', (search) => {
  expect(continueAfterAuth(search)).toBeNull()
})
