import { type Db, schema } from '@fakturky/db'
import {
  buildPaymentQrPayload,
  Decimal,
  formatDateCs,
  formatMoney,
  todayPrague,
} from '@fakturky/domain'
import { MailError, type Services } from '../context'
import { DomainError } from '../errors'
import { paymentQrInput } from './payment-qr'
import { renderIssuedPdf } from './pdf'
import { forExport, get } from './queries'
import { logActivity, scoped } from './shared'
import { paidSums } from './status'

const { document } = schema

/**
 * E-mails an issued (open) invoice with the PDF attached and the public link; records `sent`.
 * `reminder` sends a payment reminder instead (records `reminded`).
 */
export async function send(
  db: Db,
  orgId: string,
  actorId: string,
  id: string,
  services: Services | undefined,
  opts: {
    to?: string
    message?: string | null
    reminder?: boolean
    /** The caller already recorded the `reminded` activity (it claims the stage before sending). */
    alreadyLogged?: boolean
  } = {},
) {
  const found = await forExport(db, orgId, id)
  if (!found) throw new DomainError('NOT_FOUND', 'Issued document not found')
  const { doc, lines } = found
  if (doc.status === 'cancelled' || (opts.reminder && doc.status !== 'issued')) {
    throw new DomainError('CONFLICT', 'This document cannot be sent')
  }
  if (doc.type === 'credit_note' && opts.reminder) {
    throw new DomainError('CONFLICT', 'Reminders do not apply to credit notes')
  }
  if (opts.reminder && (!doc.dueDate || doc.dueDate >= todayPrague())) {
    throw new DomainError('CONFLICT', 'Reminders can only be sent for overdue invoices')
  }
  const customerEmails = (doc.customerSnapshot?.emails as string[] | undefined) ?? []
  const to = opts.to ?? customerEmails[0]
  if (!to) throw new DomainError('PRECONDITION_FAILED', 'The customer has no e-mail address')
  if (
    !services?.sendInvoice ||
    !services.renderPdf ||
    !services.publicBaseUrl ||
    !doc.publicToken
  ) {
    throw new MailError('EMAIL_NOT_CONFIGURED')
  }
  const bytes = await renderIssuedPdf(db, services.renderPdf, {
    doc,
    lines,
    original: found.original,
  })
  const paid = (await paidSums(db, orgId, [id])).get(id) ?? new Decimal(0)
  const hasQr = buildPaymentQrPayload(paymentQrInput(doc, lines, paid)) !== null
  const supplier = doc.supplierSnapshot ?? {}
  await services.sendInvoice({
    to,
    replyTo: (supplier.email as string | null) ?? null,
    supplierName: String(supplier.name ?? ''),
    number: doc.number ?? '',
    total: formatMoney(doc.total, doc.currency),
    dueDate: doc.dueDate ? formatDateCs(doc.dueDate) : '',
    publicUrl: `${services.publicBaseUrl}/f/${doc.publicToken}`,
    qrUrl: hasQr ? `${services.publicBaseUrl}/f/${doc.publicToken}/qr.png` : null,
    message: opts.message ?? null,
    isReminder: opts.reminder ?? false,
    language: doc.language as 'cs' | 'sk' | 'en',
    pdf: { filename: `${doc.number}.pdf`, bytes },
  })
  await db.transaction(async (tx) => {
    if (!opts.reminder) {
      await tx.update(document).set({ sentAt: new Date() }).where(scoped(orgId, id))
    }
    if (!opts.alreadyLogged) {
      await logActivity(tx, orgId, actorId, id, opts.reminder ? 'reminded' : 'sent', { to })
    }
  })
  return get(db, orgId, id)
}
