import { BRAND } from '@fakturky/core/brand'
import { partyFromSnapshot } from '@fakturky/core/export'
import type { RouterOutputs } from '@fakturky/core/router'
import type { DocumentLanguage, ExportPaymentMethod, VatTreatment } from '@fakturky/domain'
import { computeDocumentTotals } from '@fakturky/domain/vat'
import type { InvoiceSheetDraft, QrData } from '@fakturky/pdf/html'

export type DocumentDetail = RouterOutputs['documents']['get']
type Look = RouterOutputs['appearance']['get']
type Profile = RouterOutputs['businessProfile']['get']
type Contact = RouterOutputs['contacts']['get']
type Account = RouterOutputs['bankAccounts']['list'][number]

/** What the sheet needs beyond the document itself while it is still a draft (issued ones carry snapshots). */
export interface SheetSources {
  look?: Look | undefined
  profile?: Profile | undefined
  contact?: Contact | undefined
  accounts?: Account[] | undefined
}

const METHODS: ExportPaymentMethod[] = [
  'bank_transfer',
  'cash',
  'card',
  'cash_on_delivery',
  'other',
]
type Snap = Record<string, unknown> | null

/** The supplier block a document would be issued with, taken from the business profile. */
export function supplierSnapshot(p: Profile | undefined): Snap {
  if (!p) return null
  return {
    name: p.legalName,
    ico: p.ico,
    dic: p.dic,
    address: p.address,
    vatStatus: p.vatStatus,
    registryNote: p.registryNote,
    email: p.email,
    phone: p.phone,
  }
}

/** The customer block, taken from a contact. */
export function customerSnapshot(c: Contact | undefined): Snap {
  if (!c) return null
  return {
    name: c.name,
    ico: c.ico,
    dic: c.dic,
    icDph: c.icDph,
    address: c.address,
    country: c.country,
    emails: c.emails,
    phone: c.phone,
  }
}

/** The bank block, taken from a bank account. */
export function bankSnapshot(a: Account | undefined): Snap {
  if (!a) return null
  return {
    iban: a.iban,
    accountNumber: a.accountNumber,
    bankCode: a.bankCode,
    bic: a.bic,
    showQr: a.showQr,
  }
}

const str = (v: unknown) => (typeof v === 'string' && v ? v : null)

/** Account picked for a draft: the chosen one, else the currency's default. */
function accountFor(d: DocumentDetail, accounts: Account[] | undefined): Account | undefined {
  const list = (accounts ?? []).filter((a) => a.currency === d.currency)
  return (
    list.find((a) => a.id === d.bankAccountId) ?? list.find((a) => a.defaultForCurrency) ?? list[0]
  )
}

/**
 * The stored document as an `InvoiceSheet` input. Issued documents render from their frozen snapshots exactly
 * like `renderDocumentPdf` does on the server (same lines, totals, texts); a draft has no snapshots yet, so
 * the supplier, customer and bank come from the live profile, contact and account.
 */
export function detailToSheet(
  d: DocumentDetail,
  src: SheetSources,
): { doc: InvoiceSheetDraft; qr: QrData | null | undefined } {
  const isDraft = d.status === 'draft'
  const vatPayer = isDraft
    ? d.type === 'credit_note'
      ? d.vatMode !== 'none'
      : d.type !== 'proforma' && src.profile?.vatStatus === 'payer'
    : d.vatMode !== 'none'
  const supplier = isDraft ? supplierSnapshot(src.profile) : d.supplierSnapshot
  const customer = isDraft ? customerSnapshot(src.contact) : d.customerSnapshot
  const account = isDraft ? accountFor(d, src.accounts) : undefined
  const bank = isDraft ? bankSnapshot(account) : (d.bankSnapshot as Snap)
  const exchangeRate = d.currency === 'CZK' ? 1 : (d.exchangeRate ?? 1)

  const lines = d.lines.map((l) => ({
    description: l.description,
    detail: l.vatNote,
    quantity: l.quantity,
    unit: l.unit,
    unitPrice: l.unitPrice,
    vatRate: l.vatRate,
    vatTreatment: l.vatTreatment as VatTreatment,
    discountPercent: l.discountPercent,
  }))
  const totals = computeDocumentTotals(
    lines.map((l) => ({
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      vatRate: l.vatRate,
      vatTreatment: l.vatTreatment,
      discountPercent: l.discountPercent,
    })),
    {
      vatPayer,
      currency: d.currency,
      exchangeRate,
      roundTotal: d.roundTotal,
      pricesIncludeVat: d.pricesIncludeVat,
    },
  )

  const method = METHODS.includes(d.paymentMethod as ExportPaymentMethod)
    ? (d.paymentMethod as ExportPaymentMethod)
    : 'other'
  const iban = str(bank?.iban)
  const noPayment = d.type === 'payment_receipt' || d.type === 'credit_note'
  const issueDate = d.issueDate ?? undefined

  const doc: InvoiceSheetDraft = {
    type: d.type as 'invoice' | 'proforma' | 'credit_note' | 'payment_receipt',
    number: d.number ?? '',
    ...(issueDate ? { issueDate } : {}),
    taxableDate: vatPayer ? d.taxableDate : null,
    vatPayer,
    supplierVatPayer: str(supplier?.vatStatus) === 'payer' || vatPayer,
    supplier: partyFromSnapshot(supplier),
    customer: partyFromSnapshot(customer ?? (d.customerName ? { name: d.customerName } : null)),
    lines,
    totals,
    currency: d.currency,
    exchangeRate,
    pricesIncludeVat: d.pricesIncludeVat,
    originalDocument:
      d.type === 'credit_note' && d.parent?.number && d.parent.issueDate
        ? { number: d.parent.number, issueDate: d.parent.issueDate, uuid: d.parent.id }
        : null,
    payment: noPayment
      ? null
      : {
          method,
          dueDate: d.dueDate ?? d.issueDate ?? '',
          variableSymbol: d.variableSymbol,
          constantSymbol: d.constantSymbol,
          bankAccount: iban
            ? {
                accountNumber: str(bank?.accountNumber) ?? undefined,
                bankCode: str(bank?.bankCode) ?? undefined,
                iban,
                bic: str(bank?.bic) ?? undefined,
                showQr: bank?.showQr !== false,
              }
            : null,
        },
    language: d.language as DocumentLanguage,
    brandName: BRAND.name,
    ...(src.look ? { showBrand: src.look.showBrand } : {}),
    ...(src.look?.accentColor ? { accentColor: src.look.accentColor } : {}),
    logo: src.look?.logo ?? null,
    signature: src.look?.signature ?? null,
    headerText: d.introText,
    footerText: d.footerText,
    note: null,
  }
  // Issued: the server worked the QR out for what is still unpaid (none once settled). Draft: let the sheet build it.
  return { doc, qr: isDraft ? undefined : d.paymentQr }
}
