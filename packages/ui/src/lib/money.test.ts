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
  it('rounds scale-4 values half up', () => {
    expect(formatMoney('100.0050')).toBe('100,01\u00a0Kč')
    expect(formatMoney('99.9950')).toBe('100,00\u00a0Kč')
    expect(formatMoney('0.0049')).toBe('0,00\u00a0Kč')
    expect(formatMoney('-0.0040')).toBe('0,00\u00a0Kč')
  })
  it('rejects garbage', () => {
    expect(() => formatMoney('1e3')).toThrow()
  })
})
