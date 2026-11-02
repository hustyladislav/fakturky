import { expect, test } from 'vitest'
import { compactCz, deltaPercent, niceStep, niceTicks } from './chart-scale'

test('niceTicks covers the max with round steps', () => {
  expect(niceTicks(0)).toEqual([0])
  expect(niceTicks(87_000)).toEqual([0, 25_000, 50_000, 75_000, 100_000])
  expect(niceTicks(430_000)).toEqual([0, 200_000, 400_000, 600_000])
  expect(niceStep(2_900_000)).toBe(1_000_000)
})

test('compactCz uses Czech abbreviations', () => {
  expect(compactCz(0)).toBe('0')
  expect(compactCz(50_000)).toBe('50 tis.')
  expect(compactCz(2_500_000)).toBe('2,5 mil.')
  expect(compactCz(750)).toBe('750')
})

test('deltaPercent', () => {
  expect(deltaPercent(150, 100)).toBe(50)
  expect(deltaPercent(50, 100)).toBe(-50)
  expect(deltaPercent(10, 0)).toBeNull()
  expect(deltaPercent(-50, -100)).toBe(50)
})
