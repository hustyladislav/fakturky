import { expect, test } from 'vitest'
import { toDocumentForExport } from './export'

const base = {
  type: 'proforma',
  number: 'Z2026-0001',
  id: 'x',
  issueDate: '2026-11-02',
  taxableDate: '2026-11-02',
  dueDate: '2026-11-16',
  currency: 'CZK',
  exchangeRate: null,
  roundTotal: false,
  pricesIncludeVat: false,
  paymentMethod: 'bank_transfer',
  vatMode: 'none',
  supplierSnapshot: { name: 'Plátce s.r.o.', vatStatus: 'payer' },
  customerSnapshot: { name: 'Odběratel' },
  bankSnapshot: null,
  introText: null,
  footerText: null,
  variableSymbol: null,
  constantSymbol: null,
} as unknown as Parameters<typeof toDocumentForExport>[0]

test("a VAT payer's proforma carries no VAT but still labels the supplier as a payer", () => {
  const doc = toDocumentForExport(base, [])
  expect(doc.vatPayer).toBe(false)
  expect(doc.supplierVatPayer).toBe(true)
})

test('a non-payer supplier stays a non-payer', () => {
  const doc = toDocumentForExport(
    { ...base, supplierSnapshot: { name: 'X', vatStatus: 'non_payer' } },
    [],
  )
  expect(doc.supplierVatPayer).toBe(false)
})
