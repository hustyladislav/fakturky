import { expect, test } from 'vitest'
import { crowns } from './money'

test('whole crowns stay on one line', () => {
  expect(crowns('92400.00')).toBe('92 400 Kč')
})

test('rounds a summary without float drift', () => {
  expect(crowns('1234567890123.50')).toBe('1 234 567 890 124 Kč')
})

test('negative totals keep a real minus', () => {
  expect(crowns('-1500.00')).toBe('−1 500 Kč')
})
