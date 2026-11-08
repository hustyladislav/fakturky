import { describe, expect, it } from 'vitest'
import {
  buildVatReport,
  computeDp3,
  czDicDigits,
  euVatIdOf,
  isValidVatPeriod,
  vatFilingDeadline,
  vatPeriodRange,
  vatReminderPeriod,
  type VatReportCustomer,
  type VatReportDocument,
  type VatReportRecapRow,
} from '../src/vat-report.ts'

const customer = (name: string, dic: string | null = null, extra: Partial<VatReportCustomer> = {}) => ({
  name,
  country: 'CZ',
  dic,
  icDph: null,
  ...extra,
})

const std = (rate: '21' | '12', base: string, vat: string): VatReportRecapRow => ({
  vatRate: rate,
  vatTreatment: 'standard',
  baseCzk: base,
  vatCzk: vat,
})
const other = (
  vatTreatment: VatReportRecapRow['vatTreatment'],
  base: string,
): VatReportRecapRow => ({ vatRate: '0', vatTreatment, baseCzk: base, vatCzk: '0.00' })

const A = customer('Alfa s.r.o.', 'CZ12345678')
const C = customer('Gama a.s.', 'CZ87654321')
const D = customer('Delta stavby s.r.o.', 'CZ25596641')
const DE = customer('Berlin GmbH', null, { country: 'DE', icDph: 'DE123456789' })
const PL = customer('Warszawa Sp. z o.o.', 'PL1234567890', { country: 'PL' })
const FR = customer('Paris SARL', null, { country: 'FR' })

/** March 2026, hand-computed (see expectations below). */
const docs: VatReportDocument[] = [
  // A.4: 12 100 incl. VAT > 10 000 and customer has a DIČ
  { id: 'i1', type: 'invoice', number: '2026-0001', taxableDate: '2026-03-05', customer: A, recap: [std('21', '10000.00', '2100.00')] },
  // 60 500 incl. VAT but the customer is a consumer without DIČ → A.5
  { id: 'i2', type: 'invoice', number: '2026-0002', taxableDate: '2026-03-10', customer: customer('Jan Novák'), recap: [std('21', '50000.00', '10500.00')] },
  // 5 960 incl. VAT → A.5, both rates
  { id: 'i3', type: 'invoice', number: '2026-0003', taxableDate: '2026-03-12', customer: C, recap: [std('21', '4000.00', '840.00'), std('12', '1000.00', '120.00')] },
  // reverse charge 20 000 + 1 210 standard: whole document 21 210 → A.1 and A.4
  { id: 'i4', type: 'invoice', number: '2026-0004', taxableDate: '2026-03-15', customer: D, recap: [std('21', '1000.00', '210.00'), other('reverse_charge', '20000.00')] },
  // EU services, EUR 40 × 25.01 = 1 000.40
  { id: 'i5', type: 'invoice', number: '2026-0005', taxableDate: '2026-03-20', customer: DE, recap: [other('eu_reverse_charge', '1000.40')] },
  { id: 'i6', type: 'invoice', number: '2026-0006', taxableDate: '2026-03-25', customer: DE, recap: [other('eu_reverse_charge', '500.00')] },
  // credit note for Alfa: |−2 420| ≤ 10 000 → reduces A.5
  { id: 'c1', type: 'credit_note', number: 'D2026-0001', taxableDate: '2026-03-28', customer: A, recap: [std('21', '-2000.00', '-420.00')] },
  // EU services to a customer without VAT ID
  { id: 'i7', type: 'invoice', number: '2026-0007', taxableDate: '2026-03-30', customer: FR, recap: [other('eu_reverse_charge', '100.00')] },
  // export
  { id: 'i8', type: 'invoice', number: '2026-0008', taxableDate: '2026-03-31', customer: customer('NY Inc', null, { country: 'US' }), recap: [other('export', '3000.00')] },
  // EU goods
  { id: 'i9', type: 'invoice', number: '2026-0009', taxableDate: '2026-03-31', customer: PL, euSupplyKind: 'goods', recap: [other('eu_reverse_charge', '2000.50')] },
  // outside the period
  { id: 'x1', type: 'invoice', number: '2026-0099', taxableDate: '2026-04-01', customer: A, recap: [std('21', '99999.00', '20999.79')] },
  { id: 'x2', type: 'invoice', number: '2026-0098', taxableDate: '2026-02-28', customer: A, recap: [std('21', '99999.00', '20999.79')] },
]

const march = { kind: 'month', year: 2026, month: 3 } as const

describe('periods', () => {
  it('computes ranges', () => {
    expect(vatPeriodRange(march)).toEqual({ from: '2026-03-01', to: '2026-03-31' })
    expect(vatPeriodRange({ kind: 'quarter', year: 2026, quarter: 2 })).toEqual({ from: '2026-04-01', to: '2026-06-30' })
    expect(vatPeriodRange({ kind: 'month', year: 2024, month: 2 })).toEqual({ from: '2024-02-01', to: '2024-02-29' })
  })

  it('validates', () => {
    expect(isValidVatPeriod({ kind: 'month', year: 2026, month: 13 })).toBe(false)
    expect(isValidVatPeriod({ kind: 'quarter', year: 2026, quarter: 0 })).toBe(false)
    expect(isValidVatPeriod({ kind: 'quarter', year: 2026, quarter: 4 })).toBe(true)
    expect(() => vatPeriodRange({ kind: 'month', year: 2026, month: 0 })).toThrow()
  })

  it('deadline is 25 days after period end, moved off weekends', () => {
    expect(vatFilingDeadline({ kind: 'month', year: 2026, month: 5 })).toBe('2026-06-25') // Thursday
    expect(vatFilingDeadline(march)).toBe('2026-04-27') // 25 April is a Saturday
  })
})

describe('customer identifiers', () => {
  it('extracts Czech DIČ digits', () => {
    expect(czDicDigits({ country: 'CZ', dic: 'CZ 123 456 78' })).toBe('12345678')
    expect(czDicDigits({ country: 'CZ', dic: '12345678' })).toBe('12345678')
    expect(czDicDigits({ country: 'DE', dic: '12345678' })).toBeNull()
    expect(czDicDigits({ country: 'CZ', dic: null })).toBeNull()
    expect(czDicDigits({ country: 'SK', dic: 'SK2020123456' })).toBeNull()
  })

  it('extracts EU VAT IDs but never a Czech one', () => {
    expect(euVatIdOf({ icDph: 'DE 123 456 789', dic: null })).toEqual({ country: 'DE', number: '123456789' })
    expect(euVatIdOf({ icDph: null, dic: 'PL1234567890' })).toEqual({ country: 'PL', number: '1234567890' })
    expect(euVatIdOf({ icDph: null, dic: 'CZ12345678' })).toBeNull()
    expect(euVatIdOf({ icDph: null, dic: 'US123' })).toBeNull()
  })
})

describe('buildVatReport (March 2026)', () => {
  const report = buildVatReport(march, docs)

  it('ignores documents outside the period', () => {
    expect(report.documentCount).toBe(10)
  })

  it('DPH rows', () => {
    // ř.1 base 10000+50000+4000+1000−2000, VAT 2100+10500+840+210−420
    expect(report.dp3['1']).toEqual({ base: '63000.00', vat: '13230.00' })
    expect(report.dp3['2']).toEqual({ base: '1000.00', vat: '120.00' })
    expect(report.dp3['20']).toEqual({ base: '2000.50', vat: '0.00' })
    expect(report.dp3['21'].base).toBe('1600.40') // 1000.40 + 500 + 100
    expect(report.dp3['22'].base).toBe('3000.00')
    expect(report.dp3['25'].base).toBe('20000.00')
    expect(report.dp3['26'].base).toBe('0.00')
  })

  it('KH A.1 lists reverse charge documents with the DIČ digits', () => {
    expect(report.kh.a1).toEqual([
      { documentId: 'i4', number: '2026-0004', dicOdb: '25596641', duzp: '2026-03-15', base: '20000.00', code: '4' },
    ])
  })

  it('KH A.4 lists only documents above 10 000 CZK incl. VAT with a customer DIČ', () => {
    expect(report.kh.a4).toEqual([
      { documentId: 'i1', number: '2026-0001', dicOdb: '12345678', dppd: '2026-03-05', base21: '10000.00', vat21: '2100.00', base12: '0.00', vat12: '0.00' },
      { documentId: 'i4', number: '2026-0004', dicOdb: '25596641', dppd: '2026-03-15', base21: '1000.00', vat21: '210.00', base12: '0.00', vat12: '0.00' },
    ])
  })

  it('KH A.5 accumulates the rest, credit notes negative', () => {
    expect(report.kh.a5).toEqual({ base21: '52000.00', vat21: '10920.00', base12: '1000.00', vat12: '120.00' })
  })

  it('A.4 + A.5 equals ř.1 and ř.2 of the return', () => {
    const { a4, a5 } = report.kh
    const b21 = a4.reduce((s, r) => s + Number(r.base21), 0) + Number(a5.base21)
    const v21 = a4.reduce((s, r) => s + Number(r.vat21), 0) + Number(a5.vat21)
    expect(b21).toBe(Number(report.dp3['1'].base))
    expect(v21).toBe(Number(report.dp3['1'].vat))
  })

  it('SH aggregates per VAT ID and code and rounds up to whole CZK', () => {
    expect(report.sh).toEqual([
      { country: 'DE', vatNumber: '123456789', code: '3', count: 2, valueCzk: '1500.40', valueWhole: '1501' },
      { country: 'PL', vatNumber: '1234567890', code: '0', count: 1, valueCzk: '2000.50', valueWhole: '2001' },
    ])
  })

  it('warns about documents that cannot be listed', () => {
    expect(report.warnings).toEqual([
      { code: 'large_domestic_without_dic', blocking: false, documentId: 'i2', number: '2026-0002' },
      { code: 'missing_vat_id_eu', blocking: true, documentId: 'i7', number: '2026-0007' },
    ])
  })

  it('records contributions for drill-down', () => {
    const rows = (k: string) => report.contributions.filter((c) => c.rowKey === k).map((c) => c.documentId)
    expect(rows('dp3.1')).toEqual(['i1', 'i2', 'i3', 'i4', 'c1'])
    expect(rows('dp3.2')).toEqual(['i3'])
    expect(rows('kh.A4')).toEqual(['i1', 'i4'])
    expect(rows('kh.A5')).toEqual(['i2', 'i3', 'c1'])
    expect(rows('kh.A1')).toEqual(['i4'])
    expect(rows('sh.3')).toEqual(['i5', 'i6'])
    expect(rows('sh.0')).toEqual(['i9'])
    expect(rows('dp3.21')).toEqual(['i5', 'i6', 'i7'])
  })
})

describe('edge cases', () => {
  it('reverse charge without customer DIČ is a blocking warning but still counts in ř.25', () => {
    const r = buildVatReport(march, [
      { id: 'a', type: 'invoice', number: '1', taxableDate: '2026-03-01', customer: customer('Bez DIČ'), recap: [other('reverse_charge', '500.00')] },
    ])
    expect(r.kh.a1).toEqual([])
    expect(r.dp3['25'].base).toBe('500.00')
    expect(r.warnings).toEqual([{ code: 'missing_dic_reverse_charge', blocking: true, documentId: 'a', number: '1' }])
  })

  it('the 10 000 limit is strict (exactly 10 000 goes to A.5) and uses the absolute value for credit notes', () => {
    const r = buildVatReport(march, [
      { id: 'a', type: 'invoice', number: '1', taxableDate: '2026-03-01', customer: A, recap: [std('21', '8264.46', '1735.54')] }, // 10 000.00
      { id: 'b', type: 'credit_note', number: '2', taxableDate: '2026-03-02', customer: A, recap: [std('21', '-8264.47', '-1735.55')] }, // −10 000.02
    ])
    expect(r.kh.a4.map((x) => x.documentId)).toEqual(['b'])
    expect(r.kh.a4[0]?.base21).toBe('-8264.47')
    expect(r.kh.a5.base21).toBe('8264.46')
  })

  it('a payment receipt counts by its payment date', () => {
    const r = buildVatReport(march, [
      { id: 'p', type: 'payment_receipt', number: 'P2026-0001', taxableDate: '2026-03-31', customer: A, recap: [std('21', '1000.00', '210.00')] },
    ])
    expect(r.dp3['1'].vat).toBe('210.00')
  })

  it('flags unsupported rates and exempt supplies', () => {
    const r = buildVatReport(march, [
      { id: 'a', type: 'invoice', number: '1', taxableDate: '2026-03-01', customer: A, recap: [{ vatRate: '15', vatTreatment: 'standard', baseCzk: '100.00', vatCzk: '15.00' }, other('exempt', '300.00')] },
    ])
    expect(r.warnings.map((w) => w.code)).toEqual(['unsupported_rate', 'exempt_manual'])
    expect(r.dp3.exempt.base).toBe('300.00')
    expect(r.dp3['1'].base).toBe('0.00')
  })

  it('empty period', () => {
    const r = buildVatReport(march, [])
    expect(r.documentCount).toBe(0)
    expect(r.sh).toEqual([])
    expect(r.kh.a5.base21).toBe('0.00')
  })

  it('uses the configured defaults for EU kind and reverse-charge code', () => {
    const r = buildVatReport(march, [
      { id: 'a', type: 'invoice', number: '1', taxableDate: '2026-03-01', customer: DE, recap: [other('eu_reverse_charge', '10.01')] },
      { id: 'b', type: 'invoice', number: '2', taxableDate: '2026-03-02', customer: A, recap: [other('reverse_charge', '10.00')] },
    ], { euSupplyKind: 'goods', reverseChargeCode: '14' })
    expect(r.dp3['20'].base).toBe('10.01')
    expect(r.sh[0]).toMatchObject({ code: '0', valueWhole: '11' })
    expect(r.kh.a1[0]?.code).toBe('14')
  })
})

describe('computeDp3', () => {
  const report = buildVatReport(march, docs)

  it('rounds each row to whole CZK and derives the summary rows', () => {
    const f = computeDp3(report, { r40Base: '100000', r40Deduction: '21000', r41Base: '0', r41Deduction: '0' })
    expect(f.r1).toEqual({ base: '63000', vat: '13230' })
    expect(f.r2).toEqual({ base: '1000', vat: '120' })
    expect(f.r20).toBe('2001') // 2000.50 half-up
    expect(f.r21).toBe('1600')
    expect(f.r22).toBe('3000')
    expect(f.r25).toBe('20000')
    expect(f.r62).toBe('13350')
    expect(f.r46).toBe('21000')
    expect(f.r63).toBe('21000')
    expect(f.r64).toBe('0')
    expect(f.r65).toBe('7650')
  })

  it('tax to pay when output exceeds deduction', () => {
    const f = computeDp3(report, { r40Deduction: '1000.40' })
    expect(f.r63).toBe('1000')
    expect(f.r64).toBe('12350')
    expect(f.r65).toBe('0')
  })

  it('works without manual input', () => {
    const f = computeDp3(report)
    expect(f.r64).toBe('13350')
    expect(f.r46).toBe('0')
  })
})

describe('foreign currency', () => {
  it('a missing exchange rate is a blocking warning', () => {
    const r = buildVatReport(march, [
      { id: 'e', type: 'invoice', number: '1', taxableDate: '2026-03-01', customer: A, missingExchangeRate: true, recap: [std('21', '100.00', '21.00')] },
    ])
    expect(r.warnings).toEqual([{ code: 'missing_exchange_rate', blocking: true, documentId: 'e', number: '1' }])
  })
})

describe('vatReminderPeriod', () => {
  // Q3 2026 ends 30. 9.; 25 days later is Sunday 25. 10., so the deadline moves to Monday 26. 10.
  it('quarterly: stays on the last quarter up to and including the deadline day', () => {
    const q3 = { kind: 'quarter', year: 2026, quarter: 3 }
    expect(vatReminderPeriod('2026-10-01', 'quarterly')).toEqual(q3)
    expect(vatReminderPeriod('2026-10-25', 'quarterly')).toEqual(q3)
    expect(vatReminderPeriod('2026-10-26', 'quarterly')).toEqual(q3)
  })
  it('quarterly: moves to the running quarter the day after the deadline', () => {
    expect(vatReminderPeriod('2026-10-27', 'quarterly')).toEqual({ kind: 'quarter', year: 2026, quarter: 4 })
  })
  it('monthly: May 2026 deadline is Thursday 25. 6.; flips on the 26th', () => {
    expect(vatReminderPeriod('2026-06-25', 'monthly')).toEqual({ kind: 'month', year: 2026, month: 5 })
    expect(vatReminderPeriod('2026-06-26', 'monthly')).toEqual({ kind: 'month', year: 2026, month: 6 })
  })
  it('crosses the year boundary', () => {
    expect(vatReminderPeriod('2027-01-10', 'quarterly')).toEqual({ kind: 'quarter', year: 2026, quarter: 4 })
    expect(vatReminderPeriod('2027-01-10', 'monthly')).toEqual({ kind: 'month', year: 2026, month: 12 })
  })
  it('first days of a month before the deadline still point back', () => {
    expect(vatReminderPeriod('2026-11-08', 'monthly')).toEqual({ kind: 'month', year: 2026, month: 10 })
  })
})
