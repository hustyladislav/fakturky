import { amountDue as domainAmountDue, renderPaymentQr } from '@fakturky/domain'
import type { InvoicePdfInput, QrData } from './types.ts'

export function amountDue(doc: InvoicePdfInput): string {
  return domainAmountDue(doc.totals.total, doc.paidDeposits ?? 0)
}

/** QR Platba for CZK, EPC for EUR; nothing for other currencies, non-transfers or non-positive amounts. */
export function buildInvoiceQr(doc: InvoicePdfInput): Promise<QrData | null> {
  return renderPaymentQr({
    number: doc.number,
    currency: doc.currency,
    supplierName: doc.supplier.name,
    payment: doc.payment,
    total: doc.totals.total,
    paid: doc.paidDeposits ?? 0,
  })
}
