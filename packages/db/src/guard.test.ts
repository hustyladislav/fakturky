import { expect, test } from 'vitest'
import { assertDestructiveAllowed } from './guard'

test('refuses without the explicit flag, allows with it', () => {
  expect(() => assertDestructiveAllowed('reset', { DATABASE_URL: 'postgres://x' })).toThrow(
    /ALLOW_DESTRUCTIVE_DB=1/,
  )
  expect(() => assertDestructiveAllowed('reset', { ALLOW_DESTRUCTIVE_DB: '0' })).toThrow()
  expect(() => assertDestructiveAllowed('reset', { ALLOW_DESTRUCTIVE_DB: '1' })).not.toThrow()
})
