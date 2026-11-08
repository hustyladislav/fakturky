import { describe, expect, it } from 'vitest'
import { agingBucketOf, receivablesAging, type AgingDocument } from '../src/receivables.ts'

const TODAY = '2026-11-08'
const daysAgo = (n: number) => {
  const d = new Date(Date.UTC(2026, 10, 8 - n))
  return d.toISOString().slice(0, 10)
}
const doc = (days: number, extra: Partial<AgingDocument> = {}): AgingDocument => ({
  dueDate: daysAgo(days),
  currency: 'CZK',
  total: '1000.00',
  paidAmount: '0.00',
  totalCzk: null,
  ...extra,
})
const sums = (docs: AgingDocument[]) =>
  Object.fromEntries(receivablesAging(docs, TODAY).buckets.map((b) => [b.key, b.sumCzk]))

describe('agingBucketOf', () => {
  it('splits at every boundary', () => {
    expect(agingBucketOf(0)).toBeNull()
    expect(agingBucketOf(1)).toBe('d1_14')
    expect(agingBucketOf(14)).toBe('d1_14')
    expect(agingBucketOf(15)).toBe('d15_30')
    expect(agingBucketOf(30)).toBe('d15_30')
    expect(agingBucketOf(31)).toBe('d31_60')
    expect(agingBucketOf(60)).toBe('d31_60')
    expect(agingBucketOf(61)).toBe('d60plus')
  })
})

describe('receivablesAging', () => {
  it('buckets documents by the day they became overdue', () => {
    expect(sums([doc(1), doc(14), doc(15), doc(30), doc(31), doc(60), doc(61)])).toEqual({
      d1_14: '2000.00',
      d15_30: '2000.00',
      d31_60: '2000.00',
      d60plus: '1000.00',
    })
  })

  it('ignores documents due today, in the future or without a due date', () => {
    const r = receivablesAging([doc(0), doc(-5), doc(3, { dueDate: null })], TODAY)
    expect(r.buckets.every((b) => b.count === 0 && b.sumCzk === '0.00')).toBe(true)
  })

  it('counts only the unpaid remainder of a partly paid document', () => {
    expect(sums([doc(20, { paidAmount: '250.50' })]).d15_30).toBe('749.50')
  })

  it('skips fully paid and over-paid balances', () => {
    const r = receivablesAging([doc(20, { paidAmount: '1000.00' }), doc(20, { paidAmount: '1200.00' })], TODAY)
    expect(r.buckets.find((b) => b.key === 'd15_30')).toEqual({ key: 'd15_30', count: 0, sumCzk: '0.00' })
  })

  it('converts a foreign balance with the document ratio and flags it approximate', () => {
    // EUR 100 total = 2 500 CZK; 40 EUR paid -> 60 EUR left = 1 500 CZK
    const eur = doc(5, { currency: 'EUR', total: '100.00', paidAmount: '40.00', totalCzk: '2500.00' })
    const r = receivablesAging([eur], TODAY)
    expect(r.buckets[0]).toEqual({ key: 'd1_14', count: 1, sumCzk: '1500.00' })
    expect(r.approximate).toBe(true)
  })

  it('counts a foreign balance without a CZK value but never sums it as crowns', () => {
    const eur = doc(5, { currency: 'EUR', total: '100.00', paidAmount: '0', totalCzk: null })
    const r = receivablesAging([eur], TODAY)
    expect(r.buckets[0]).toEqual({ key: 'd1_14', count: 1, sumCzk: '0.00' })
    expect(r.approximate).toBe(true)
  })

  it('is exact for CZK only and avoids float drift', () => {
    const r = receivablesAging([doc(5, { total: '0.10' }), doc(5, { total: '0.20' })], TODAY)
    expect(r.buckets[0]?.sumCzk).toBe('0.30')
    expect(r.approximate).toBe(false)
  })
})
