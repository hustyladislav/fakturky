import { expect, test } from 'vitest'
import { groupByMonth } from './invoice-groups'

const d = (issueDate: string | null, status: string, total: string, extra = {}) => ({
  issueDate,
  status,
  total,
  totalCzk: null,
  currency: 'CZK',
  ...extra,
})

test('groups consecutive months and sums issued/paid in CZK', () => {
  const groups = groupByMonth([
    d('2026-11-02', 'issued', '1000.00'),
    d('2026-11-01', 'draft', '5000.00'),
    d('2026-11-01', 'issued', '-250.00'),
    d('2026-10-30', 'paid', '100.00', { currency: 'EUR', totalCzk: '2500.00' }),
    d('2026-10-02', 'cancelled', '999.00'),
    d(null, 'draft', '1.00'),
  ])
  expect(groups.map((g) => [g.key, g.rows.length, g.sum])).toEqual([
    ['2026-11', 3, '750.00'],
    ['2026-10', 2, '2500.00'],
    ['none', 1, '0.00'],
  ])
})
