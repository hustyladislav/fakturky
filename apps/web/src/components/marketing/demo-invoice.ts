import { BRAND } from '@fakturky/core/brand'
import type { InvoiceSheetDraft } from '@fakturky/pdf/html'

/** Made-up supplier, customer and lines for the marketing visuals (never real data). */
export const demoInvoice: InvoiceSheetDraft = {
  type: 'invoice',
  language: 'cs',
  vatPayer: true,
  number: '2026-0042',
  issueDate: '2026-11-02',
  brandName: BRAND.name,
  supplier: {
    name: 'Jana Nováková',
    ico: '04817623',
    dic: 'CZ7355123456',
    street: 'Vinohradská 1234/56',
    city: 'Praha 2',
    zip: '120 00',
    country: 'CZ',
  },
  customer: {
    name: 'Novák & syn s.r.o.',
    ico: '25596641',
    dic: 'CZ25596641',
    street: 'Lipová 8',
    city: 'Ostrava',
    zip: '702 00',
    country: 'CZ',
  },
  lines: [
    {
      description: 'Návrh vizuální identity',
      quantity: '1',
      unit: 'ks',
      unitPrice: '12000',
      vatRate: '21',
    },
    {
      description: 'Webový redesign, 8 hodin',
      quantity: '8',
      unit: 'h',
      unitPrice: '1500',
      vatRate: '21',
    },
  ],
  payment: {
    method: 'bank_transfer',
    dueDate: '2026-11-16',
    variableSymbol: '20260042',
    bankAccount: {
      accountNumber: '19-2000145399',
      bankCode: '0800',
      iban: 'CZ6508000000192000145399',
      showQr: true,
    },
  },
}

export type AresSupplier = {
  ico: string
  name: string
  dic: string | null
  address: { street: string; city: string; zip: string; country: string }
  vatPayer: boolean
}

/** The demo invoice issued by a firm looked up in ARES (or a placeholder firm before any lookup). */
export function demoInvoiceFor(
  supplier: AresSupplier | null,
  placeholderName: string,
): InvoiceSheetDraft {
  return {
    ...demoInvoice,
    vatPayer: supplier?.vatPayer ?? true,
    supplier: supplier
      ? {
          name: supplier.name,
          ico: supplier.ico,
          ...(supplier.dic ? { dic: supplier.dic } : {}),
          street: supplier.address.street,
          city: supplier.address.city,
          zip: supplier.address.zip,
          country: supplier.address.country || 'CZ',
        }
      : { name: placeholderName },
  }
}
