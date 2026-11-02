import type { schema } from '@fakturky/db'
import {
  computeDocumentTotals,
  type DocumentForExport,
  type ExportParty,
  type ExportPaymentMethod,
  type VatTreatment,
} from '@fakturky/domain'

type DocRow = typeof schema.document.$inferSelect
type LineRow = typeof schema.documentLine.$inferSelect

type Snapshot = Record<string, unknown> | null

const str = (v: unknown) => (typeof v === 'string' && v ? v : null)

function party(s: Snapshot): ExportParty {
  const a = ((s?.address as Record<string, string | undefined>) ?? {}) as Record<
    string,
    string | undefined
  >
  return {
    name: str(s?.name) ?? '',
    ico: str(s?.ico),
    dic: str(s?.dic) ?? str(s?.icDph),
    street: a.street ?? '',
    city: a.city ?? '',
    zip: a.zip ?? '',
    country: str(s?.country) ?? a.country ?? 'CZ',
    registerNote: str(s?.registryNote),
    email: str(s?.email),
    phone: str(s?.phone),
  }
}

const METHODS: ExportPaymentMethod[] = [
  'bank_transfer',
  'cash',
  'card',
  'cash_on_delivery',
  'other',
]

/** Maps an issued document (snapshots + lines) to the shape shared by PDF and ISDOC export. Never includes private notes. */
export function toDocumentForExport(
  doc: DocRow,
  lines: LineRow[],
  original?: { number: string; issueDate: string; uuid: string } | null,
): DocumentForExport {
  const vatPayer = doc.vatMode !== 'none'
  const exchangeRate = doc.currency === 'CZK' ? 1 : (doc.exchangeRate ?? 1)
  const totals = computeDocumentTotals(
    lines.map((l) => ({
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      vatRate: l.vatRate,
      vatTreatment: l.vatTreatment as VatTreatment,
      discountPercent: l.discountPercent,
    })),
    {
      vatPayer,
      currency: doc.currency,
      exchangeRate,
      roundTotal: doc.roundTotal,
      pricesIncludeVat: doc.pricesIncludeVat,
    },
  )
  const bank = doc.bankSnapshot as Snapshot
  const method = METHODS.includes(doc.paymentMethod as ExportPaymentMethod)
    ? (doc.paymentMethod as ExportPaymentMethod)
    : 'other'
  return {
    type:
      doc.type === 'proforma'
        ? 'proforma'
        : doc.type === 'credit_note'
          ? 'credit_note'
          : doc.type === 'payment_receipt'
            ? 'payment_receipt'
            : 'invoice',
    originalDocument: original ?? null,
    pricesIncludeVat: doc.pricesIncludeVat,
    number: doc.number ?? '',
    uuid: doc.id,
    issueDate: doc.issueDate ?? '',
    taxableDate: vatPayer ? doc.taxableDate : null,
    vatPayer,
    supplier: party(doc.supplierSnapshot),
    customer: party(doc.customerSnapshot),
    lines: lines.map((l) => ({
      vatNote: l.vatNote,
      description: l.description,
      quantity: l.quantity,
      unit: l.unit,
      unitPrice: l.unitPrice,
      vatRate: l.vatRate,
      vatTreatment: l.vatTreatment as VatTreatment,
    })),
    totals,
    currency: doc.currency,
    exchangeRate,
    note: [doc.introText, doc.footerText].filter(Boolean).join('\n') || null,
    // A receipt documents money already received and a credit note reverses a claim: neither asks for payment.
    payment:
      doc.type === 'payment_receipt' || doc.type === 'credit_note'
        ? null
        : {
            method,
            dueDate: doc.dueDate ?? doc.issueDate ?? '',
            variableSymbol: doc.variableSymbol,
            constantSymbol: doc.constantSymbol,
            bankAccount: str(bank?.iban)
              ? {
                  accountNumber: str(bank?.accountNumber) ?? undefined,
                  bankCode: str(bank?.bankCode) ?? undefined,
                  iban: str(bank?.iban) as string,
                  bic: str(bank?.bic) ?? undefined,
                }
              : null,
          },
  }
}
