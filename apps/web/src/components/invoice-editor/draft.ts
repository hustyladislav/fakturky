import type { DocumentLanguage } from '@fakturky/domain'
import type { VatTreatment } from '@fakturky/domain/vat'
import { trimDecimal } from '@/lib/invoice-numbers'
import type { InvoicePrefill } from '@/lib/invoice-prefill'
import type { PickedCustomer } from './customer-card'
import { emptyLine, type Line, nextLineKey } from './items-table'

/** Everything the user can edit on the invoice form; one flat object so sections stay props-light. */
export interface DraftFields {
  docType: 'invoice' | 'proforma'
  customer: PickedCustomer | null
  issueDate: string
  dueDate: string
  taxableDate: string
  currency: string
  exchangeRate: string
  roundTotal: boolean
  bankAccountId: string
  paymentMethod: string
  introText: string
  footerText: string
  privateNote: string
  orderNumber: string
  language: DocumentLanguage
  lines: Line[]
}

export function emptyFields(today: string, dueDate: string): DraftFields {
  return {
    docType: 'invoice',
    customer: null,
    issueDate: today,
    dueDate,
    taxableDate: today,
    currency: 'CZK',
    exchangeRate: '',
    roundTotal: false,
    bankAccountId: '',
    paymentMethod: 'bank_transfer',
    introText: '',
    footerText: '',
    privateNote: '',
    orderNumber: '',
    language: 'cs',
    lines: [emptyLine()],
  }
}

/** A VAT payer has no 0 % rate: unspecified/zero falls back to the base rate. */
export function prefillLines(prefill: InvoicePrefill, vatPayer: boolean): Line[] {
  return prefill.lines.map((l) => ({
    key: nextLineKey(),
    description: l.description,
    quantity: l.quantity || '1',
    unit: 'ks',
    unitPrice: l.unitPrice,
    vatRate: vatPayer && (!l.vatRate || Number(l.vatRate) === 0) ? '21' : (l.vatRate ?? '0'),
    vatTreatment: 'standard',
    vatNote: '',
  }))
}

interface StoredDocument {
  contactId: string | null
  customerName: string | null
  issueDate: string | null
  dueDate: string | null
  taxableDate: string | null
  currency: string
  exchangeRate: string | null
  roundTotal: boolean
  bankAccountId: string | null
  paymentMethod: string
  language: string | null
  orderNumber: string | null
  introText: string | null
  footerText: string | null
  privateNote: string | null
  lines: {
    description: string
    quantity: string
    unit: string | null
    unitPrice: string
    vatRate: string
    vatTreatment: string | null
    vatNote: string | null
  }[]
}

/** A stored draft as editable fields (`docType` is irrelevant for an existing document). */
export function fieldsFromDocument(d: StoredDocument, today: string): Omit<DraftFields, 'docType'> {
  return {
    customer: d.contactId ? { id: d.contactId, name: d.customerName ?? '' } : null,
    issueDate: d.issueDate ?? today,
    dueDate: d.dueDate ?? today,
    taxableDate: d.taxableDate ?? d.issueDate ?? today,
    currency: d.currency,
    exchangeRate: d.exchangeRate ? trimDecimal(d.exchangeRate) : '',
    roundTotal: d.roundTotal,
    bankAccountId: d.bankAccountId ?? '',
    paymentMethod: d.paymentMethod,
    language: (d.language as DocumentLanguage) ?? 'cs',
    orderNumber: d.orderNumber ?? '',
    introText: d.introText ?? '',
    footerText: d.footerText ?? '',
    privateNote: d.privateNote ?? '',
    lines: d.lines.length
      ? d.lines.map((l) => ({
          key: nextLineKey(),
          description: l.description,
          quantity: trimDecimal(l.quantity),
          unit: l.unit ?? '',
          unitPrice: trimDecimal(l.unitPrice),
          vatRate: trimDecimal(l.vatRate),
          vatTreatment: (l.vatTreatment as VatTreatment) ?? 'standard',
          vatNote: l.vatNote ?? '',
        }))
      : [emptyLine()],
  }
}

/** The "Další možnosti" block opens by itself when a stored draft already uses it. */
export function usesMoreOptions(d: DraftFields): boolean {
  return !!(d.introText || d.footerText || d.privateNote || d.orderNumber || d.language !== 'cs')
}
