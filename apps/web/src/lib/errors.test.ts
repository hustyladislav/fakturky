import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { cs } from '@/i18n/cs'
import { apiErrorMessage, serverErrorMessage } from '@/lib/errors'

const PACKAGES = join(__dirname, '../../../../packages')
// Upstream failures and developer-facing checks: the generic Czech message is the right one.
const INTERNAL =
  /^(DocumentForExport|No ČNB|Duplicate tool name|Tool \$\{|Request failed|Invalid XML|Invalid ISO|Invalid decimal|Invalid IČO|Invalid VAT|Invalid Czech bank account$|Invalid workplace|Unsupported VAT ID|Unrecognized|Malformed|Unexpected (QR|VIES)|EPC amount|Use either|XML too large|No XML|ARES responded|VIES responded|ČNB|Fio responded)/
const THROWN =
  /new (?:DocumentError|ORPCError|[A-Za-z]*Error)\(\s*(?:'[A-Z_]+'\s*,\s*)?(?:\{\s*message:\s*)?(['`])((?:[^'`\\]|\\.)*?)\1/g

function sources(): string[] {
  return ['core/src', 'domain/src'].flatMap((root) =>
    readdirSync(join(PACKAGES, root), { recursive: true, encoding: 'utf8' })
      .filter((f) => f.endsWith('.ts') && !f.includes('.test.') && !f.includes('testing'))
      .map((f) => join(PACKAGES, root, f)),
  )
}

function serverMessages(): string[] {
  const found = new Set<string>()
  for (const file of sources()) {
    for (const [, , text] of readFileSync(file, 'utf8').matchAll(THROWN)) {
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
