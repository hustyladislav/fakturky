import { describe, expect, it } from 'vitest'
import { DEFAULT_NUMBER_PATTERNS, formatNumber, isValidNumberPattern, parseNumberPattern, periodKey, variableSymbolFromNumber } from '../src/numbering.ts'

const d = { year: 2026, month: 3 }

describe('patterns', () => {
  it.each([
    ['{YYYY}-{NNNN}', 7, '2026-0007'],
    ['Z{YYYY}-{NNNN}', 12, 'Z2026-0012'],
    ['{YY}{MM}{NNN}', 5, '2603005'],
    ['FV/{MM}/{YYYY}/{N}', 41, 'FV/03/2026/41'],
    ['{NNNN}', 12345, '12345'],
    ['{YYYY}{NNNNNN}', 1, '2026000001'],
  ])('%s #%i → %s', (pattern, n, out) => expect(formatNumber(pattern, n, d)).toBe(out))

  it('two-digit year pads', () => {
    expect(formatNumber('{YY}-{NN}', 1, { year: 2005, month: 1 })).toBe('05-01')
  })

  it('parses tokens', () => {
    expect(parseNumberPattern('A{YYYY}-{NNNN}')).toEqual([
      { type: 'literal', value: 'A' },
      { type: 'year4' },
      { type: 'literal', value: '-' },
      { type: 'counter', width: 4 },
    ])
  })

  it.each(['{YYYY}', 'abc', '{NNNN}{NN}', '{NNNN}{', '}{NNNN}', '{XX}{NNNN}'])('invalid: %s', (p) => {
    expect(isValidNumberPattern(p)).toBe(false)
  })

  it('rejects negative counters', () => {
    expect(() => formatNumber('{NNNN}', -1, d)).toThrow()
    expect(() => formatNumber('{NNNN}', 1.5, d)).toThrow()
  })

  it('defaults are valid', () => {
    for (const p of Object.values(DEFAULT_NUMBER_PATTERNS)) expect(isValidNumberPattern(p)).toBe(true)
  })
})

describe('period key', () => {
  it('buckets', () => {
    expect(periodKey('yearly', d)).toBe('2026')
    expect(periodKey('monthly', d)).toBe('2026-03')
    expect(periodKey('never', d)).toBe('all')
  })
})

describe('variable symbol', () => {
  it.each([
    ['2026-0001', '20260001'],
    ['Z2026-0012', '20260012'],
    ['FV/2026/12345678', '2612345678'],
    ['ABC', ''],
    ['1234567890123', '4567890123'],
  ])('%s → %s', (n, vs) => expect(variableSymbolFromNumber(n)).toBe(vs))
})
