/**
 * The shared "what the document says" layer. Both renderers (react-pdf in `InvoiceDocument.tsx`, HTML in
 * `html/InvoiceSheet.tsx`) draw from this model, so title-by-type, label i18n, VAT recap shaping, legal texts
 * and amount formatting have exactly one implementation. This file must stay free of `@react-pdf/renderer`
 * and Node APIs: it is bundled into the browser.
 */
import {
  computeDocumentTotals,
  type DocumentLanguage,
  type DocumentTotals,
  type ExportParty,
  type ExportPayment,
  type MoneyInput,
  parseDecimal,
  round,
  type VatTreatment,
  vatTreatmentText,
} from '@fakturky/domain'
import {
  amount,
  countryName,
  currencyLabel,
  exchangeRate,
  formatDate,
  groupIban,
  percent,
  quantity,
} from './format.ts'
import { LABELS, type Labels } from './i18n.ts'
import { amountDue } from './qr.ts'
import type { InvoicePdfInput } from './types.ts'

/** Default accent: brand green. */
export const DEFAULT_ACCENT = '#1F4D3C'

export function resolveAccent(color: string | null | undefined): string {
  return /^#[0-9a-fA-F]{6}$/.test(color ?? '') ? (color as string) : DEFAULT_ACCENT
}

/** Tax documents state the unit price without VAT; derive it from the line base when prices were entered gross. */
export function unitPriceNet(
  qty: MoneyInput,
  entered: MoneyInput,
  base: string | undefined,
  gross?: boolean,
): MoneyInput {
  const q = parseDecimal(qty)
  return gross && base && !q.isZero() ? round(parseDecimal(base).div(q), 2) : entered
}

export function titleFor(
  doc: Pick<InvoicePdfInput, 'type' | 'vatPayer'>,
  t: Pick<
    Labels,
    'proforma' | 'creditNoteTax' | 'creditNote' | 'paymentReceipt' | 'invoiceTax' | 'invoice'
  >,
): string {
  switch (doc.type) {
    case 'proforma':
      return t.proforma
    case 'credit_note':
      return doc.vatPayer ? t.creditNoteTax : t.creditNote
    case 'payment_receipt':
      return t.paymentReceipt
    default:
      return doc.vatPayer ? t.invoiceTax : t.invoice
  }
}

// --------------------------------------------------------------------------------------------------------
// Draft input (editor preview)
// --------------------------------------------------------------------------------------------------------

export type SheetImage = Uint8Array | string | null | undefined

export interface SheetDraftLine {
  description?: string | null
  detail?: string | null
  quantity?: MoneyInput | null
  unit?: string | null
  unitPrice?: MoneyInput | null
  vatRate?: MoneyInput | null
  vatTreatment?: VatTreatment | null
  discountPercent?: MoneyInput | null
}

/**
 * A document that is still being typed: every field is optional and numbers may be unparsable. Use it for the
 * live editor preview; an issued document is a complete `InvoicePdfInput` (which is assignable to this).
 */
export interface InvoiceSheetDraft
  extends Partial<
    Omit<
      InvoicePdfInput,
      'supplier' | 'customer' | 'lines' | 'totals' | 'payment' | 'logo' | 'signature'
    >
  > {
  supplier?: Partial<ExportParty>
  customer?: Partial<ExportParty>
  lines?: SheetDraftLine[]
  /** Omit to compute from `lines`. */
  totals?: DocumentTotals
  payment?:
    | (Omit<Partial<ExportPayment>, 'bankAccount'> & { bankAccount?: ExportPayment['bankAccount'] })
    | null
  /** PNG/JPEG bytes, or a URL / data URL. */
  logo?: SheetImage
  signature?: SheetImage
}

export type InvoiceSheetInput = InvoiceSheetDraft | InvoicePdfInput

function safeDecimal(v: MoneyInput | null | undefined, fallback = '0'): string {
  if (v === null || v === undefined || v === '') return fallback
  try {
    return parseDecimal(v).toString()
  } catch {
    return fallback
  }
}

export interface ResolvedSheet {
  doc: InvoicePdfInput
  /** True when the number is not assigned yet. */
  numberPending: boolean
}

/** Fills every gap of a draft so the renderers can treat it like an issued document. */
export function resolveSheetInput(input: InvoiceSheetInput): ResolvedSheet {
  const d = input as InvoiceSheetDraft
  const language: DocumentLanguage = d.language ?? 'cs'
  const vatPayer = d.vatPayer ?? false
  const currency = (d.currency ?? 'CZK').toUpperCase()
  const lines = (d.lines ?? [])
    .filter(
      (l) =>
        (l.description ?? '').trim() !== '' ||
        safeDecimal(l.unitPrice) !== '0' ||
        (l.detail ?? '').trim() !== '',
    )
    .map((l) => ({
      description: l.description ?? '',
      detail: l.detail ?? null,
      quantity: safeDecimal(l.quantity, '1'),
      unit: l.unit ?? null,
      unitPrice: safeDecimal(l.unitPrice),
      ...(l.vatRate !== undefined && l.vatRate !== null
        ? { vatRate: safeDecimal(l.vatRate, '21') }
        : {}),
      ...(l.vatTreatment ? { vatTreatment: l.vatTreatment } : {}),
      ...(l.discountPercent !== undefined && l.discountPercent !== null
        ? { discountPercent: safeDecimal(l.discountPercent) }
        : {}),
    }))
  let rate: string | undefined
  if (d.exchangeRate !== undefined && d.exchangeRate !== null) {
    const r = safeDecimal(d.exchangeRate, '1')
    rate = parseDecimal(r).gt(0) ? r : '1'
  }
  const totals =
    d.totals ??
    computeDocumentTotals(
      lines.map((l) => ({
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        // A payer's line without an explicit rate is taken at the standard rate so the preview shows VAT.
        ...(l.vatRate !== undefined
          ? { vatRate: l.vatRate }
          : vatPayer && !l.vatTreatment
            ? { vatRate: '21' }
            : {}),
        ...(l.vatTreatment ? { vatTreatment: l.vatTreatment } : {}),
        ...(l.discountPercent !== undefined ? { discountPercent: l.discountPercent } : {}),
      })),
      {
        vatPayer,
        currency,
        ...(rate ? { exchangeRate: rate } : {}),
        ...(d.pricesIncludeVat !== undefined ? { pricesIncludeVat: d.pricesIncludeVat } : {}),
      },
    )
  const pay = d.payment
  const payment: ExportPayment | null = pay
    ? {
        method: pay.method ?? 'bank_transfer',
        dueDate: pay.dueDate ?? '',
        variableSymbol: pay.variableSymbol ?? null,
        constantSymbol: pay.constantSymbol ?? null,
        specificSymbol: pay.specificSymbol ?? null,
        bankAccount: pay.bankAccount ?? null,
      }
    : null
  const party = (p: Partial<ExportParty> | undefined): ExportParty => ({
    name: '',
    street: '',
    city: '',
    zip: '',
    ...p,
  })
  const number = (d.number ?? '').trim()
  const doc: InvoicePdfInput = {
    type: d.type ?? 'invoice',
    number,
    uuid: d.uuid ?? '00000000-0000-4000-8000-000000000000',
    issueDate: d.issueDate ?? '',
    taxableDate: d.taxableDate ?? null,
    vatPayer,
    ...(d.supplierVatPayer !== undefined ? { supplierVatPayer: d.supplierVatPayer } : {}),
    supplier: party(d.supplier),
    customer: party(d.customer),
    lines,
    ...(d.pricesIncludeVat !== undefined ? { pricesIncludeVat: d.pricesIncludeVat } : {}),
    totals,
    currency,
    ...(rate ? { exchangeRate: rate } : {}),
    note: d.note ?? null,
    originalDocument: d.originalDocument ?? null,
    payment,
    ...(d.paidDeposits !== undefined ? { paidDeposits: safeDecimal(d.paidDeposits) } : {}),
    language,
    brandName: d.brandName ?? '',
    ...(d.showBrand !== undefined ? { showBrand: d.showBrand } : {}),
    ...(d.accentColor ? { accentColor: d.accentColor } : {}),
    issuedBy: d.issuedBy ?? null,
    headerText: d.headerText ?? null,
    footerText: d.footerText ?? null,
    correctionReason: d.correctionReason ?? null,
    logo: typeof d.logo === 'string' ? null : d.logo,
    signature: typeof d.signature === 'string' ? null : d.signature,
  }
  return { doc, numberPending: number === '' }
}

// --------------------------------------------------------------------------------------------------------
// Model
// --------------------------------------------------------------------------------------------------------

export interface PartyModel {
  label: string
  name: string
  street: string
  cityLine: string
  country: string
  ico: string | null
  dic: string | null
  vatStatus: string | null
  registerNote: string | null
  contact: string | null
  icoLabel: string
  dicLabel: string
}

export interface LineModel {
  title: string
  detail: string | null
  discount: string | null
  quantity: string
  unit: string
  unitPrice: string
  vat: string
  total: string
}

export interface RecapRow {
  key: string
  rate: string
  base: string
  vat: string
  total: string
}

export interface SheetModel {
  lang: DocumentLanguage
  t: Labels
  accent: string
  currency: string
  currencyLabel: string
  title: string
  /** `č. 2026012`, or null while a draft has no number. */
  number: string | null
  pendingNumberText: string
  numberPending: boolean
  supplierName: string
  meta: { label: string; value: string }[]
  supplier: PartyModel
  customer: PartyModel
  correction: { line: string; reason: string | null } | null
  headerText: string | null
  columns: { showVat: boolean; priceHeader: string; totalHeader: string }
  lines: LineModel[]
  payment: {
    qrLabel: (kind: 'spayd' | 'epc') => string
    heading: string
    rows: { key: string; value: string; bold?: boolean }[]
  } | null
  footerText: string | null
  proformaNotice: string | null
  signature: { issuedBy: string } | null
  recap: {
    heading: string
    heads: { rate: string; base: string; vat: string; total: string }
    rows: RecapRow[]
    sum: RecapRow
  } | null
  plainSums: { key: string; value: string }[]
  czkRecap: { heading: string; rows: RecapRow[] } | null
  exchangeRateLine: string | null
  adjustments: { key: string; value: string }[]
  total: { label: string; value: string }
  note: string | null
  legal: { heading: string; items: string[] } | null
  footer: { supplierLine: string; brand: string | null; pageLabel: string }
  /** Document title for metadata / accessible name. */
  documentName: string
}

function partyModel(
  p: ExportParty,
  label: string,
  t: Labels,
  lang: DocumentLanguage,
  vatPayer: boolean | undefined,
): PartyModel {
  const cc = (p.country ?? 'CZ').toUpperCase()
  return {
    label,
    name: p.name,
    street: p.street,
    cityLine: `${p.zip} ${p.city}`.trim(),
    country: p.street || p.city || p.name ? countryName(cc, lang) : '',
    ico: p.ico || null,
    dic: p.dic || null,
    vatStatus: vatPayer === undefined ? null : vatPayer ? t.vatPayer : t.nonVatPayer,
    registerNote: p.registerNote || null,
    contact: [p.email, p.phone].filter(Boolean).join('  ·  ') || null,
    icoLabel: t.ico,
    dicLabel: t.dic,
  }
}

export function buildSheetModel(input: InvoiceSheetInput): SheetModel {
  const { doc, numberPending } = resolveSheetInput(input)
  const lang = doc.language
  const t = LABELS[lang]
  const cur = doc.currency.toUpperCase()
  const cl = currencyLabel(cur)
  const money = (v: string | number) => `${amount(v, lang)} ${cl}`
  const payer = doc.vatPayer
  const isProforma = doc.type === 'proforma'
  const showRecap = payer && !isProforma && doc.totals.recap.length > 0
  const foreign = cur !== 'CZK'
  const rate = parseDecimal(doc.exchangeRate ?? doc.totals.exchangeRate)
  const title = titleFor(doc, t)
  const pay = doc.payment
  const acct = pay?.bankAccount
  const due = amountDue(doc)
  const deposits = parseDecimal(doc.paidDeposits ?? 0)
  const hasRounding = !parseDecimal(doc.totals.rounding).isZero()
  const rateLine = `${t.exchangeRate}: 1 ${cur} = ${exchangeRate(rate, lang)} Kč`

  const legalTexts: { treatment: VatTreatment; text: string }[] = []
  for (const r of doc.totals.recap) {
    if (r.vatTreatment !== 'standard' && !legalTexts.some((l) => l.treatment === r.vatTreatment)) {
      legalTexts.push({ treatment: r.vatTreatment, text: vatTreatmentText(r.vatTreatment, lang) })
    }
  }

  const meta: { label: string; value: string }[] = [
    { label: t.issueDate, value: doc.issueDate ? formatDate(doc.issueDate, lang) : '—' },
  ]
  if (payer && doc.taxableDate)
    meta.push({ label: t.taxableDate, value: formatDate(doc.taxableDate, lang) })
  if (pay?.dueDate) meta.push({ label: t.dueDate, value: formatDate(pay.dueDate, lang) })
  if (pay) meta.push({ label: t.paymentMethod, value: t.methods[pay.method] ?? pay.method })

  const accountLine = acct?.accountNumber
    ? `${acct.accountNumber}${acct.bankCode ? `/${acct.bankCode}` : ''}`
    : null

  const payRows: { key: string; value: string; bold?: boolean }[] = []
  if (acct?.bankName) payRows.push({ key: t.bank, value: acct.bankName })
  if (accountLine) payRows.push({ key: t.accountNumber, value: accountLine, bold: true })
  if (acct?.iban) payRows.push({ key: t.iban, value: groupIban(acct.iban) })
  if (acct?.bic) payRows.push({ key: t.bic, value: acct.bic })
  if (pay?.variableSymbol)
    payRows.push({ key: t.variableSymbol, value: pay.variableSymbol, bold: true })
  if (pay?.constantSymbol) payRows.push({ key: t.constantSymbol, value: pay.constantSymbol })
  if (pay?.specificSymbol) payRows.push({ key: t.specificSymbol, value: pay.specificSymbol })

  const recapRow = (r: (typeof doc.totals.recap)[number], czk: boolean): RecapRow => ({
    key: `${czk ? 'czk-' : ''}${r.vatTreatment}-${r.vatRate}`,
    rate: r.vatTreatment === 'standard' ? percent(r.vatRate) : t.treatments[r.vatTreatment],
    base: amount(czk ? (r.baseCzk ?? '0') : r.base, lang),
    vat: amount(czk ? (r.vatCzk ?? '0') : r.vat, lang),
    total: amount(czk ? (r.totalCzk ?? '0') : r.total, lang),
  })

  const adjustments: { key: string; value: string }[] = []
  if (hasRounding) adjustments.push({ key: t.rounding, value: money(doc.totals.rounding) })
  if (!deposits.isZero())
    adjustments.push({ key: t.deposits, value: money(`-${deposits.abs().toString()}`) })

  const plainSums: { key: string; value: string }[] =
    !showRecap && payer
      ? [
          { key: t.base, value: money(doc.totals.subtotal) },
          { key: t.vat, value: money(doc.totals.vatTotal) },
        ]
      : []

  return {
    lang,
    t,
    accent: resolveAccent(doc.accentColor),
    currency: cur,
    currencyLabel: cl,
    title,
    number: numberPending ? null : `${t.numberPrefix} ${doc.number}`,
    pendingNumberText: t.numberPending,
    numberPending,
    supplierName: doc.supplier.name,
    meta,
    supplier: partyModel(doc.supplier, t.supplier, t, lang, doc.supplierVatPayer ?? payer),
    customer: partyModel(doc.customer, t.customer, t, lang, undefined),
    correction:
      doc.type === 'credit_note' && doc.originalDocument
        ? {
            line: t.corrects
              .replace('{number}', doc.originalDocument.number)
              .replace('{date}', formatDate(doc.originalDocument.issueDate, lang)),
            reason: doc.correctionReason ? `${t.correctionReason}: ${doc.correctionReason}` : null,
          }
        : null,
    headerText: doc.headerText || null,
    columns: {
      showVat: payer,
      priceHeader: t.unitPrice,
      totalHeader: !payer
        ? t.lineTotal
        : doc.pricesIncludeVat
          ? t.lineTotalIncVat
          : t.lineTotalExVat,
    },
    lines: doc.lines.map((line, i) => {
      const lt = doc.totals.lines[i]
      const discount =
        line.discountPercent !== undefined && line.discountPercent !== null
          ? parseDecimal(line.discountPercent)
          : null
      return {
        title: line.description,
        detail: line.detail || null,
        discount:
          discount && !discount.isZero() ? `${t.discount} ${percent(discount.toString())}` : null,
        quantity: quantity(line.quantity, lang),
        unit: line.unit ?? '',
        unitPrice: amount(
          unitPriceNet(line.quantity, line.unitPrice, lt?.base, doc.pricesIncludeVat),
          lang,
        ),
        vat: lt && lt.vatTreatment === 'standard' ? percent(lt.vatRate) : '–',
        total: lt ? amount(lt.base, lang) : '',
      }
    }),
    payment:
      pay && (acct || pay.variableSymbol)
        ? {
            qrLabel: (kind) => (kind === 'spayd' ? t.qrSpayd : t.qrEpc),
            heading: t.paymentDetails,
            rows: payRows,
          }
        : null,
    footerText: doc.footerText || null,
    proformaNotice: isProforma ? t.notTaxDocument : null,
    signature:
      doc.signature || doc.issuedBy
        ? { issuedBy: doc.issuedBy ? `${t.issuedBy}: ${doc.issuedBy}` : t.issuedBy }
        : null,
    recap: showRecap
      ? {
          heading: `${t.vatRecap} (${cl})`,
          heads: { rate: t.rate, base: t.base, vat: t.vat, total: t.total },
          rows: doc.totals.recap.map((r) => recapRow(r, false)),
          sum: {
            key: 'sum',
            rate: t.sum,
            base: amount(doc.totals.subtotal, lang),
            vat: amount(doc.totals.vatTotal, lang),
            total: amount(doc.totals.totalBeforeRounding, lang),
          },
        }
      : null,
    plainSums,
    czkRecap:
      foreign && payer && showRecap
        ? {
            heading: `${t.recapCzk} (Kč)`,
            rows: doc.totals.recap.map((r) => recapRow(r, true)),
          }
        : null,
    exchangeRateLine: foreign ? rateLine : null,
    adjustments,
    total: {
      label:
        doc.type === 'credit_note' ? t.creditTotal : deposits.isZero() ? t.amountDue : t.remaining,
      value: money(due),
    },
    note: doc.note || null,
    legal:
      legalTexts.length > 0
        ? {
            heading: t.taxNote,
            items: legalTexts.map(
              (l) =>
                `${l.text}${
                  l.treatment === 'eu_reverse_charge' && doc.customer.dic
                    ? ` — ${t.customerVatId}: ${doc.customer.dic}`
                    : ''
                }`,
            ),
          }
        : null,
    footer: {
      supplierLine: `${[doc.supplier.name, doc.supplier.registerNote]
        .filter(Boolean)
        .map((part) => String(part).replace(/\.+$/, ''))
        .join(', ')}.`,
      brand: doc.showBrand === false || !doc.brandName ? null : `${t.issuedIn} ${doc.brandName}`,
      pageLabel: t.page,
    },
    documentName: `${title} ${doc.number}`.trim(),
  }
}
