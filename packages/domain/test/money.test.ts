import { describe, expect, it } from 'vitest'
import { Decimal, formatCzk, formatMoney, formatNumber, isDecimalString, parseDecimal, round, sum, toFixed } from '../src/money.ts'

const NB = ' '

describe('parseDecimal', () => {
  it.each([
    ['1234.5', '1234.5'],
    ['1 234,50', '1234.5'],
    [`1${NB}234,5`, '1234.5'],
    ['-0.10', '-0.1'],
    ['.5', '0.5'],
    ['5.', '5'],
  ])('%s', (input, out) => expect(parseDecimal(input).toString()).toBe(out))

  it.each(['', 'abc', '1.2.3', '1e5', '--1', '1,2,3'])('rejects %j', (s) => {
    expect(() => parseDecimal(s)).toThrow()
    expect(isDecimalString(s)).toBe(false)
  })

  it('accepts Decimal and number, rejects non-finite', () => {
    const d = new Decimal('1.5')
    expect(parseDecimal(d)).toBe(d)
    expect(parseDecimal(2.25).toString()).toBe('2.25')
    expect(() => parseDecimal(Number.NaN)).toThrow()
    expect(isDecimalString('1')).toBe(true)
  })
})

describe('rounding', () => {
  it.each([
    ['1.005', 2, '1.01'],
    ['-1.005', 2, '-1.01'],
    ['2.5', 0, '3'],
    ['-2.5', 0, '-3'],
    ['0.004', 2, '0'],
  ])('round(%s, %i) = %s', (v, dp, out) => expect(round(v, dp).toString()).toBe(out))

  it('toFixed pads and avoids -0.00', () => {
    expect(toFixed('1.5')).toBe('1.50')
    expect(toFixed('-0.001')).toBe('0.00')
    expect(toFixed('7', 0)).toBe('7')
  })

  it('sum is exact', () => {
    expect(sum(['0.1', '0.2', 0.3]).toString()).toBe('0.6')
    expect(sum([]).toString()).toBe('0')
  })
})

describe('formatting', () => {
  it('formatCzk', () => {
    expect(formatCzk('1234.5')).toBe(`1${NB}234,50${NB}Kč`)
    expect(formatCzk('0')).toBe(`0,00${NB}Kč`)
    expect(formatCzk('-1234567.891')).toBe(`-1${NB}234${NB}567,89${NB}Kč`)
    expect(formatCzk('999.999')).toBe(`1${NB}000,00${NB}Kč`)
  })

  it('formatMoney by locale/currency', () => {
    expect(formatMoney('1234.5', 'EUR', 'cs')).toBe(`1${NB}234,50${NB}€`)
    expect(formatMoney('1234.5', 'EUR', 'en')).toBe('€1,234.50')
    expect(formatMoney('-5', 'USD', 'en')).toBe('-$5.00')
    expect(formatMoney('10', 'chf', 'en')).toBe(`10.00${NB}CHF`)
    expect(formatMoney('10', 'CZK', 'en')).toBe(`10.00${NB}Kč`)
    expect(formatMoney('10', 'CHF', 'sk')).toBe(`10,00${NB}CHF`)
  })

  it('formatNumber', () => {
    expect(formatNumber('1234567.891', 3, 'en')).toBe('1,234,567.891')
    expect(formatNumber('12', 0)).toBe('12')
  })
})
