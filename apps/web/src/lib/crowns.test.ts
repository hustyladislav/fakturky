import { expect, test } from 'vitest'
import { crowns, wholeCrowns } from './crowns'

test('whole crowns stay on one line', () => {
  expect(crowns('92400.00')).toBe('92 400 Kč')
})

test('rounds a summary without float drift', () => {
  expect(crowns('1234567890123.50')).toBe('1 234 567 890 124 Kč')
})

test('negative totals keep a real minus', () => {
  expect(crowns('-1500.00')).toBe('−1 500 Kč')
})

test('a total that rounds to nothing has no minus', () => {
  expect(crowns('-0.40')).toBe('0\u00a0Kč')
  expect(wholeCrowns('-0.40')).toBe('0.00')
})

test('halves round away from zero, the same on both sides', () => {
  expect(wholeCrowns('1250.50')).toBe('1251.00')
  expect(wholeCrowns('-1250.50')).toBe('-1251.00')
})
