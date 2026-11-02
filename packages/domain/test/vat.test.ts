import { describe, expect, it } from 'vitest'
import { allocateGross, computeDocumentTotals, splitGross, getVatRates, isValidVatRate, vatTreatmentText, VAT_TREATMENTS } from '../src/vat.ts'

describe('rates and texts', () => {
  it('lists rates per country', () => {
    expect(getVatRates('CZ')).toEqual(['21', '12'])
    expect(getVatRates('SK')).toEqual(['23', '19', '5'])
    expect(isValidVatRate('CZ', '21')).toBe(true)
    expect(isValidVatRate('CZ', 15)).toBe(false)
    expect(isValidVatRate('SK', '19')).toBe(true)
  })

  it('every non-standard treatment has legal text in all languages', () => {
    for (const t of VAT_TREATMENTS) {
      for (const l of ['cs', 'sk', 'en'] as const) {
        expect(vatTreatmentText(t, l) === '').toBe(t === 'standard')
      }
    }
    expect(vatTreatmentText('reverse_charge')).toContain('Daň odvede zákazník')
    expect(vatTreatmentText('exempt', 'en')).toBe('VAT exempt')
  })
})

describe('computeDocumentTotals', () => {
  it('basic payer invoice, two rates', () => {
    const t = computeDocumentTotals([
      { quantity: '10', unitPrice: '1500', vatRate: '21' },
      { quantity: '1', unitPrice: '1200', vatRate: '12' },
      { quantity: '2', unitPrice: '100', vatRate: '21' },
    ])
    expect(t.recap).toEqual([
      { vatRate: '21', vatTreatment: 'standard', base: '15200.00', vat: '3192.00', total: '18392.00' },
      { vatRate: '12', vatTreatment: 'standard', base: '1200.00', vat: '144.00', total: '1344.00' },
    ])
    expect(t.subtotal).toBe('16400.00')
    expect(t.vatTotal).toBe('3336.00')
    expect(t.total).toBe('19736.00')
    expect(t.rounding).toBe('0.00')
    expect(t.totalCzk).toBe('19736.00')
  })

  it('VAT is computed on the recap, not per line', () => {
    // 3 × 0.10 net at 21 %: per-line VAT = 0.02 each (0.06) but recap = round(0.30*0.21)=0.06; use 0.07 case
    const t = computeDocumentTotals(Array.from({ length: 3 }, () => ({ quantity: '1', unitPrice: '0.07', vatRate: '21' })))
    // recap: base 0.21 × 21 % = 0.0441 → 0.04; per-line would be 0.0147→0.01 ×3 = 0.03
    expect(t.vatTotal).toBe('0.04')
    expect(t.lines.reduce((a, l) => a + Number(l.vat), 0).toFixed(2)).toBe('0.04')
  })

  it('prices including VAT keep the entered gross', () => {
    const t = computeDocumentTotals(
      [
        { quantity: '1', unitPrice: '121', vatRate: '21' },
        { quantity: '3', unitPrice: '33.33', vatRate: '21' },
      ],
      { pricesIncludeVat: true },
    )
    expect(t.total).toBe('220.99')
    expect(t.recap[0]).toMatchObject({ base: '182.64', vat: '38.35', total: '220.99' })
  })

  it('VAT-inclusive line figures reconcile with the recap and keep the gross', () => {
    const t = computeDocumentTotals(Array.from({ length: 3 }, () => ({ quantity: '1', unitPrice: '0.03', vatRate: '21' })), { pricesIncludeVat: true })
    expect(t.recap[0]).toMatchObject({ base: '0.07', vat: '0.02', total: '0.09' })
    const sumOf = (k: 'base' | 'vat' | 'total') => t.lines.reduce((a, l) => a + Number(l[k]), 0).toFixed(2)
    expect([sumOf('base'), sumOf('vat'), sumOf('total')]).toEqual(['0.07', '0.02', '0.09'])
    expect(t.lines.map((l) => l.total)).toEqual(['0.03', '0.03', '0.03'])
  })

  it('line and document discounts', () => {
    const t = computeDocumentTotals(
      [{ quantity: '2', unitPrice: '1000', vatRate: '21', discountPercent: '10' }],
      { documentDiscountPercent: '5' },
    )
    expect(t.lines[0]).toMatchObject({ base: '1710.00', discount: '290.00' })
    expect(t.subtotal).toBe('1710.00')
    expect(t.vatTotal).toBe('359.10')
  })

  it('100 % discount yields zero', () => {
    const t = computeDocumentTotals([{ quantity: '1', unitPrice: '99', vatRate: '21', discountPercent: '100' }])
    expect(t.total).toBe('0.00')
  })

  it('whole-koruna rounding is a separate line', () => {
    const t = computeDocumentTotals([{ quantity: '1', unitPrice: '100.40', vatRate: '21' }], { roundTotal: true })
    expect(t.totalBeforeRounding).toBe('121.48')
    expect(t.total).toBe('121.00')
    expect(t.rounding).toBe('-0.48')
    const up = computeDocumentTotals([{ quantity: '1', unitPrice: '100.8', vatRate: '0' }], { roundTotal: true })
    expect(up.rounding).toBe('0.20')
  })

  it('non-payer has no recap and no VAT', () => {
    const t = computeDocumentTotals([{ quantity: '1', unitPrice: '1000', vatRate: '21' }], { vatPayer: false })
    expect(t.recap).toEqual([])
    expect(t.vatTotal).toBe('0.00')
    expect(t.total).toBe('1000.00')
    expect(t.lines[0]?.vatRate).toBe('0')
  })

  it('zero-VAT treatments group separately', () => {
    const t = computeDocumentTotals([
      { quantity: '1', unitPrice: '1000', vatRate: '21' },
      { quantity: '1', unitPrice: '500', vatTreatment: 'reverse_charge' },
      { quantity: '1', unitPrice: '300', vatTreatment: 'exempt' },
    ])
    expect(t.recap.map((r) => [r.vatTreatment, r.vat])).toEqual([
      ['standard', '210.00'],
      ['exempt', '0.00'],
      ['reverse_charge', '0.00'],
    ])
    expect(t.total).toBe('2010.00')
  })

  it('foreign currency: CZK equivalents', () => {
    const t = computeDocumentTotals([{ quantity: '1', unitPrice: '100', vatRate: '21' }], {
      currency: 'eur',
      exchangeRate: '24.335',
    })
    expect(t.currency).toBe('EUR')
    expect(t.total).toBe('121.00')
    expect(t.recap[0]).toMatchObject({ baseCzk: '2433.50', vatCzk: '511.04', totalCzk: '2944.54' })
    expect(t.vatTotalCzk).toBe('511.04')
    expect(t.totalCzk).toBe('2944.54')
  })

  it('negative quantities (credit notes)', () => {
    const t = computeDocumentTotals([{ quantity: '-1', unitPrice: '100', vatRate: '21' }])
    expect(t.total).toBe('-121.00')
  })

  it('empty document', () => {
    const t = computeDocumentTotals([])
    expect(t.total).toBe('0.00')
    expect(t.recap).toEqual([])
  })

  it('validates inputs', () => {
    const line = { quantity: '1', unitPrice: '1', vatRate: '21' }
    expect(() => computeDocumentTotals([{ ...line, discountPercent: '101' }])).toThrow()
    expect(() => computeDocumentTotals([line], { documentDiscountPercent: '-1' })).toThrow()
    expect(() => computeDocumentTotals([line], { exchangeRate: '0' })).toThrow()
    expect(() => computeDocumentTotals([{ ...line, vatRate: '-1' }])).toThrow()
  })
})

describe('allocateGross / splitGross', () => {
  it('spreads an amount proportionally and always adds up', () => {
    const parts = allocateGross('1000', ['1210', '1120'])
    expect(parts.map((p) => p.toFixed(2))).toEqual(['519.31', '480.69'])
    const odd = allocateGross('100', ['1', '1', '1'])
    expect(odd.reduce((a, b) => a.plus(b)).toFixed(2)).toBe('100.00')
  })

  it('splits a gross amount top-down', () => {
    const { base, vat } = splitGross('1210', '21')
    expect(base.toFixed(2)).toBe('1000.00')
    expect(vat.toFixed(2)).toBe('210.00')
    expect(splitGross('100', '0').vat.toFixed(2)).toBe('0.00')
  })
})
