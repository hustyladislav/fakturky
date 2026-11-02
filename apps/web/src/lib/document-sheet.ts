import { BRAND } from '@fakturky/core/brand'
import { partyFromSnapshot } from '@fakturky/core/export'
import type { RouterOutputs } from '@fakturky/core/router'
import type { DocumentLanguage, ExportPaymentMethod, VatTreatment } from '@fakturky/domain'
import { computeDocumentTotals } from '@fakturky/domain/vat'
import type { InvoiceSheetDraft, QrData } from '@fakturky/pdf/html'
import { num, validNum } from './invoice-numbers'

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
    showBrand: d.look.showBrand,
    ...(d.look.accentColor ? { accentColor: d.look.accentColor } : {}),
    logo: d.look.logo,
    signature: d.look.signature,
    headerText: d.introText,
    footerText: d.footerText,
    note: null,
  }
  // Issued: the server worked the QR out for what is still unpaid (none once settled). Draft: let the sheet build it.
  return { doc, qr: isDraft ? undefined : d.paymentQr }
}

// --------------------------------------------------------------------------------------------------------
// Live preview of the editor
// --------------------------------------------------------------------------------------------------------

export interface FormLine {
  description: string
  quantity: string
  unit: string
  unitPrice: string
  vatRate: string
  vatTreatment: VatTreatment
  vatNote: string
}

export interface FormSheetState {
  type: 'invoice' | 'proforma' | 'credit_note' | 'payment_receipt'
  issueDate: string
  taxableDate: string
  dueDate: string
  vatPayer: boolean
  currency: string
  exchangeRate: string
  roundTotal: boolean
  language: DocumentLanguage
  paymentMethod: string
  introText: string
  footerText: string
  lines: FormLine[]
  customerName: string | null
}

/**
 * The editor's state as an `InvoiceSheet` draft. Numbers typed the Czech way ("1 500,5") are normalised;
 * anything unparsable counts as 0 so the preview never throws while someone is typing.
 */
export function formToSheet(
  s: FormSheetState,
  src: Omit<SheetSources, 'accounts'> & { account?: Account | undefined },
): InvoiceSheetDraft {
  const clean = (v: string, fallback = '0') => (validNum(v) ? num(v) : fallback)
  const foreign = s.currency !== 'CZK'
  const rate = foreign && validNum(s.exchangeRate) && Number(num(s.exchangeRate)) > 0
  const lines = s.lines
    .filter((l) => l.description.trim() !== '' || Number(clean(l.unitPrice)) !== 0)
    .map((l) => ({
      description: l.description,
      detail: s.vatPayer && l.vatTreatment === 'exempt' ? l.vatNote.trim() || null : null,
      quantity: clean(l.quantity, '1'),
      unit: l.unit || null,
      unitPrice: clean(l.unitPrice),
      vatRate: s.vatPayer && l.vatTreatment === 'standard' ? clean(l.vatRate) : '0',
      vatTreatment: s.vatPayer ? l.vatTreatment : ('standard' as const),
    }))
  const totals = computeDocumentTotals(
    lines.map(({ quantity, unitPrice, vatRate, vatTreatment }) => ({
      quantity,
      unitPrice,
      vatRate,
      vatTreatment,
    })),
    {
      vatPayer: s.vatPayer,
      currency: s.currency,
      exchangeRate: rate ? num(s.exchangeRate) : 1,
      roundTotal: s.roundTotal,
    },
  )
  const bank = bankSnapshot(src.account)
  const iban = str(bank?.iban)
  const supplier = supplierSnapshot(src.profile)
  const customer = customerSnapshot(src.contact)
  const noPayment = s.type === 'payment_receipt' || s.type === 'credit_note'
  return {
    type: s.type,
    number: '',
    issueDate: s.issueDate,
    taxableDate: s.vatPayer ? s.taxableDate : null,
    vatPayer: s.vatPayer,
    supplierVatPayer: str(supplier?.vatStatus) === 'payer' || s.vatPayer,
    supplier: partyFromSnapshot(supplier),
    customer: partyFromSnapshot(customer ?? (s.customerName ? { name: s.customerName } : null)),
    lines,
    totals,
    currency: s.currency,
    ...(rate ? { exchangeRate: num(s.exchangeRate) } : {}),
    payment: noPayment
      ? null
      : {
          method: METHODS.includes(s.paymentMethod as ExportPaymentMethod)
            ? (s.paymentMethod as ExportPaymentMethod)
            : 'other',
          dueDate: s.dueDate,
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
    language: s.language,
    brandName: BRAND.name,
    ...(src.look ? { showBrand: src.look.showBrand } : {}),
    ...(src.look?.accentColor ? { accentColor: src.look.accentColor } : {}),
    logo: src.look?.logo ?? null,
    signature: src.look?.signature ?? null,
    headerText: s.introText.trim() || null,
    footerText: s.footerText.trim() || null,
    note: null,
  }
}
