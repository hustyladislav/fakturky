import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { cs } from '@/i18n/cs'
import { apiErrorMessage, serverErrorMessage } from '@/lib/errors'

const CORE = join(__dirname, '../../../../packages/core/src')
// Developer-facing: never produced by a request a person makes in the app.
const INTERNAL = /^(Duplicate tool name|Tool \$\{)/
const THROWN =
  /new (?:DocumentError|ORPCError|[A-Za-z]*Error)\(\s*(?:'[A-Z_]+'\s*,\s*)?(?:\{\s*message:\s*)?(['`])((?:[^'`\\]|\\.)*?)\1/g

function serverMessages(): string[] {
  const files = readdirSync(CORE, { recursive: true, encoding: 'utf8' }).filter(
    (f) => f.endsWith('.ts') && !f.includes('.test.') && !f.includes('testing'),
  )
  const found = new Set<string>()
  for (const file of files) {
    for (const [, , text] of readFileSync(join(CORE, file), 'utf8').matchAll(THROWN)) {
      // Lower-case or constant-like strings are invariants ("insert returned no row"), not messages.
      if (text && /^[A-ZČ]/.test(text) && text !== text.toUpperCase() && !INTERNAL.test(text)) {
        found.add(text)
      }
    }
  }
  return [...found]
}

describe('server errors shown to a person', () => {
  test('every message the server can throw has Czech', () => {
    const missing = serverMessages().filter((m) => {
      const sample = m.replace(/\$\{[^}]+\}/g, '100.00')
      return serverErrorMessage(sample) === cs.common.error
    })
    expect(missing).toEqual([])
  })

  test('the scan really finds the server messages', () => {
    expect(serverMessages()).toContain('The payment exceeds the remaining balance')
    expect(serverMessages().length).toBeGreaterThan(50)
  })

  test('translates a known message and keeps the amount in a dynamic one', () => {
    expect(apiErrorMessage(new Error('The payment exceeds the remaining balance'))).toBe(
      'Platba je vyšší než zbývající částka.',
    )
    expect(
      serverErrorMessage('The credited amount exceeds what is still creditable (250.00)'),
    ).toContain('250.00')
  })

  test('an unknown message falls back to Czech instead of leaking English', () => {
    expect(serverErrorMessage('Some new failure')).toBe(cs.common.error)
    expect(serverErrorMessage(undefined)).toBe(cs.common.error)
  })
})
