import { describe, expect, it } from 'vitest'
import { addDays, daysOverdue, DUE_DAY_PRESETS, dueDate, formatDateCs, formatDateDotted, isOverdue, isoWeekday, isValidIsoDate, isWeekend, todayPrague } from '../src/dates.ts'

describe('todayPrague', () => {
  it('uses the Prague calendar date', () => {
    expect(todayPrague(new Date('2026-07-01T22:30:00Z'))).toBe('2026-07-02') // CEST +2
    expect(todayPrague(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01') // CET +1
    expect(todayPrague(new Date('2026-12-31T22:59:00Z'))).toBe('2026-12-31')
    expect(todayPrague()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('due dates', () => {
  it.each([
    ['2026-11-01', 14, '2026-11-15'],
    ['2026-12-25', 14, '2027-01-08'],
    ['2028-02-20', 10, '2028-03-01'],
    ['2026-03-31', 0, '2026-03-31'],
  ])('%s + %i = %s', (issue, days, out) => expect(dueDate(issue, days)).toBe(out))

  it('presets and default', () => {
    expect(DUE_DAY_PRESETS).toEqual([7, 14, 30])
    expect(dueDate('2026-11-01')).toBe('2026-11-15')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(() => dueDate('2026-11-01', -1)).toThrow()
    expect(() => dueDate('2026-11-01', 1.5)).toThrow()
  })
})

describe('overdue', () => {
  it('is strictly after the due date', () => {
    expect(isOverdue('2026-11-01', '2026-11-01')).toBe(false)
    expect(isOverdue('2026-11-01', '2026-11-02')).toBe(true)
    expect(isOverdue('2026-11-10', '2026-11-02')).toBe(false)
    expect(daysOverdue('2026-10-30', '2026-11-02')).toBe(3)
    expect(daysOverdue('2026-11-05', '2026-11-02')).toBe(0)
    expect(isOverdue('2000-01-01')).toBe(true)
  })
})

describe('formatting and validation', () => {
  it('formats', () => {
    expect(formatDateCs('2026-11-01')).toBe('1. 11. 2026')
    expect(formatDateDotted('2026-11-01')).toBe('01.11.2026')
  })
  it('validates iso dates', () => {
    expect(isValidIsoDate('2026-02-29')).toBe(false)
    expect(isValidIsoDate('2028-02-29')).toBe(true)
    expect(isValidIsoDate('2026-1-1')).toBe(false)
    expect(() => addDays('nope', 1)).toThrow()
  })
  it('weekdays', () => {
    expect(isoWeekday('2026-10-31')).toBe(6)
    expect(isoWeekday('2026-11-01')).toBe(7)
    expect(isoWeekday('2026-11-02')).toBe(1)
    expect(isWeekend('2026-10-31')).toBe(true)
    expect(isWeekend('2026-10-30')).toBe(false)
  })
})
