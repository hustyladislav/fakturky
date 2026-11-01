import { describe, expect, it } from 'vitest'
import { formatMoney } from './money'

describe('formatMoney', () => {
  it('groups with nbsp and pads haléře', () => {
    expect(formatMoney('148500')).toBe('148 500,00 Kč')
    expect(formatMoney('1234.5')).toBe('1 234,50 Kč')
  })
  it('handles negatives and foreign currency', () => {
    expect(formatMoney('-12.05', 'EUR')).toBe('−12,05 EUR')
  })
  it('rejects garbage', () => {
    expect(() => formatMoney('1e3')).toThrow()
  })
})
