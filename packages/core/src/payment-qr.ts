import type { schema } from '@fakturky/db'
import type { MoneyInput, PaymentQrInput } from '@fakturky/domain'
import { toDocumentForExport } from './export'

type DocRow = typeof schema.document.$inferSelect
type LineRow = typeof schema.documentLine.$inferSelect

/**
 * Input of the shared payment-QR helper (`@fakturky/domain`) for a stored document: the web detail page, the public
 * page, the `qr.png` e-mail image and the PDF all derive the code from the same rules. `paid` = recorded payments.
 */
export function paymentQrInput(doc: DocRow, lines: LineRow[], paid: MoneyInput): PaymentQrInput {
  const x = toDocumentForExport(doc, lines)
  return {
    number: x.number,
    currency: x.currency,
    supplierName: x.supplier.name,
    payment: x.payment,
    total: doc.total,
    paid,
    status: doc.status,
  }
}
