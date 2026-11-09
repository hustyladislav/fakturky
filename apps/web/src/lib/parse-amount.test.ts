import { describe, expect, it } from 'vitest'
import { parseInputAmount } from './parse-amount'

describe('parseInputAmount', () => {
  it('accepts Czech formatting with spaces, NBSP and a decimal comma', () => {
    expect(parseInputAmount('12 345,50')).toBe('12345.50')
    expect(parseInputAmount('12\u00a0345')).toBe('12345')
    expect(parseInputAmount('-1 000,5')).toBe('-1000.5')
    expect(parseInputAmount('100.25')).toBe('100.25')
  })

  it('treats an empty field as not entered', () => {
    expect(parseInputAmount('  ')).toBeNull()
  })

  it('rejects garbage instead of dropping it silently', () => {
    for (const bad of ['abc', '12,345,50', '1.234', '12 Kč', '--5', '1,']) {
      expect(parseInputAmount(bad)).toBe('invalid')
    }
  })
})
