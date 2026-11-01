import { Decimal, parseDecimal, round, toFixed, type MoneyInput } from './money.ts'
import { vatTreatmentText, type VatTreatment } from './vat.ts'
import type { DocumentTotals } from './vat.ts'

export const ISDOC_NAMESPACE = 'http://isdoc.cz/namespace/2013'
export const ISDOC_VERSION = '6.0.2'

export type ExportDocumentType = 'invoice' | 'proforma' | 'credit_note' | 'payment_receipt'
export type ExportPaymentMethod = 'bank_transfer' | 'cash' | 'card' | 'cash_on_delivery' | 'other'

export interface ExportParty {
  name: string
  ico?: string | null
  /** DIČ (CZ…) or IČ DPH (SK…). */
  dic?: string | null
  street: string
  city: string
  zip: string
  /** ISO 3166 alpha-2, default 'CZ'. */
  country?: string
  /** Free text such as "Fyzická osoba zapsaná v živnostenském rejstříku." */
  registerNote?: string | null
  email?: string | null
  phone?: string | null
}

export interface ExportLine {
  description: string
  quantity: MoneyInput
  unit?: string | null
  /** Unit price as entered (with VAT when `pricesIncludeVat`). */
  unitPrice: MoneyInput
  vatRate?: MoneyInput
  vatTreatment?: VatTreatment
}

export interface ExportPayment {
  method: ExportPaymentMethod
  dueDate: string
  variableSymbol?: string | null
  constantSymbol?: string | null
  specificSymbol?: string | null
  bankAccount?: {
    /** Domestic account `prefix-number`, without bank code. */
    accountNumber?: string
    bankCode?: string
    bankName?: string
    iban: string
    bic?: string
  } | null
}

export interface DocumentForExport {
  type: ExportDocumentType
  /** Human readable number, e.g. `2026-0001`. */
  number: string
  /** Globally unique id (UUID). */
  uuid: string
  issueDate: string
  /** DUZP; omitted for non-VAT-payers unless set. */
  taxableDate?: string | null
  vatPayer: boolean
  supplier: ExportParty
  customer: ExportParty
  lines: ExportLine[]
  pricesIncludeVat?: boolean
  /** Computed with `computeDocumentTotals` (same lines & options). */
  totals: DocumentTotals
  currency: string
  /** CZK per unit of `currency` (1 for CZK). */
  exchangeRate?: MoneyInput
  note?: string | null
  /** Credit notes: the corrected document. */
  originalDocument?: { number: string; issueDate: string; uuid?: string } | null
  payment?: ExportPayment | null
  /** Advances already paid, outside the totals. */
  paidDeposits?: MoneyInput
}

const DOCUMENT_TYPE_CODE: Record<ExportDocumentType, number> = {
  invoice: 1,
  credit_note: 2,
  proforma: 4,
  payment_receipt: 5,
}

const PAYMENT_MEANS_CODE: Record<ExportPaymentMethod, number> = {
  bank_transfer: 42,
  cash: 10,
  card: 48,
  cash_on_delivery: 10,
  other: 42,
}

const COUNTRY_NAMES: Record<string, string> = {
  CZ: 'Česká republika',
  SK: 'Slovensko',
  DE: 'Německo',
  AT: 'Rakousko',
  PL: 'Polsko',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function escapeXml(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Splits `Jankovcova 1522/53` into street name and building number. */
export function splitStreet(street: string): { name: string; number: string } {
  const m = /^(.*?)[\s,]+(\d+[A-Za-z]?(?:\/\d+[A-Za-z]?)?)$/.exec(street.trim())
  return m ? { name: (m[1] ?? '').trim(), number: m[2] as string } : { name: street.trim(), number: '' }
}

class Xml {
  private out: string[] = []
  private depth = 0
  open(tag: string, attrs = ''): this {
    this.out.push(`${'  '.repeat(this.depth)}<${tag}${attrs ? ` ${attrs}` : ''}>`)
    this.depth++
    return this
  }
  close(tag: string): this {
    this.depth--
    this.out.push(`${'  '.repeat(this.depth)}</${tag}>`)
    return this
  }
  leaf(tag: string, value: string | number, attrs = ''): this {
    this.out.push(
      `${'  '.repeat(this.depth)}<${tag}${attrs ? ` ${attrs}` : ''}>${escapeXml(String(value))}</${tag}>`,
    )
    return this
  }
  toString(): string {
    return this.out.join('\n')
  }
}

function party(x: Xml, p: ExportParty, wrapper: string): void {
  const { name: streetName, number } = splitStreet(p.street)
  const country = (p.country ?? 'CZ').toUpperCase()
  x.open(wrapper).open('Party')
  x.open('PartyIdentification').leaf('ID', p.ico ?? '').close('PartyIdentification')
  x.open('PartyName').leaf('Name', p.name).close('PartyName')
  x.open('PostalAddress')
    .leaf('StreetName', streetName)
    .leaf('BuildingNumber', number)
    .leaf('CityName', p.city)
    .leaf('PostalZone', p.zip)
    .open('Country')
    .leaf('IdentificationCode', country)
    .leaf('Name', COUNTRY_NAMES[country] ?? country)
    .close('Country')
    .close('PostalAddress')
  if (p.dic) {
    x.open('PartyTaxScheme').leaf('CompanyID', p.dic).leaf('TaxScheme', 'VAT').close('PartyTaxScheme')
  }
  if (p.registerNote) {
    x.open('RegisterIdentification').leaf('Preformatted', p.registerNote).close('RegisterIdentification')
  }
  if (p.email || p.phone) {
    x.open('Contact')
    if (p.phone) x.leaf('Telephone', p.phone)
    if (p.email) x.leaf('ElectronicMail', p.email)
    x.close('Contact')
  }
  x.close('Party').close(wrapper)
}

/** Generates an ISDOC 6.0.2 invoice XML document. All amounts are in the local currency (CZK). */
export function generateIsdoc(doc: DocumentForExport): string {
  if (!UUID_RE.test(doc.uuid)) throw new Error('DocumentForExport.uuid must be a UUID')
  const typeCode = DOCUMENT_TYPE_CODE[doc.type]
  const foreign = doc.currency.toUpperCase() !== 'CZK'
  const rate = parseDecimal(doc.exchangeRate ?? 1)
  if (foreign && doc.exchangeRate === undefined) throw new Error('exchangeRate required for foreign currency')
  const t = doc.totals
  const czk = (v: string | Decimal) => (foreign ? toFixed(round(parseDecimal(v).times(rate), 2)) : toFixed(v))
  const amount = (v: string | Decimal) => czk(v)

  const x = new Xml()
  x.open('Invoice', `xmlns="${ISDOC_NAMESPACE}" version="${ISDOC_VERSION}"`)
  x.leaf('DocumentType', typeCode)
  x.leaf('ID', doc.number)
  x.leaf('UUID', doc.uuid.toLowerCase())
  x.leaf('IssuingSystem', 'Fakturky')
  x.leaf('IssueDate', doc.issueDate)
  if (doc.taxableDate) x.leaf('TaxPointDate', doc.taxableDate)
  x.leaf('VATApplicable', doc.vatPayer ? 'true' : 'false')
  x.leaf('ElectronicPossibilityAgreementReference', '')
  if (doc.note) x.leaf('Note', doc.note)
  x.leaf('LocalCurrencyCode', 'CZK')
  if (foreign) x.leaf('ForeignCurrencyCode', doc.currency.toUpperCase())
  x.leaf('CurrRate', foreign ? rate.toString() : '1')
  x.leaf('RefCurrRate', '1')
  party(x, doc.supplier, 'AccountingSupplierParty')
  party(x, doc.customer, 'AccountingCustomerParty')

  if (doc.originalDocument) {
    x.open('OriginalDocumentReferences').open('OriginalDocumentReference')
    x.leaf('ID', doc.originalDocument.number)
    x.leaf('IssueDate', doc.originalDocument.issueDate)
    x.close('OriginalDocumentReference').close('OriginalDocumentReferences')
  }

  if (doc.lines.length !== t.lines.length) throw new Error('lines and totals.lines differ in length')
  x.open('InvoiceLines')
  doc.lines.forEach((line, i) => {
    const lt = t.lines[i]
    if (!lt) return
    const qty = parseDecimal(line.quantity)
    const base = parseDecimal(lt.base)
    const gross = parseDecimal(lt.total)
    const unitNet = qty.isZero() ? new Decimal(0) : base.div(qty)
    const unitGross = qty.isZero() ? new Decimal(0) : gross.div(qty)
    x.open('InvoiceLine')
    x.leaf('ID', i + 1)
    x.leaf('InvoicedQuantity', qty.toString(), line.unit ? `unitCode="${escapeXml(line.unit)}"` : '')
    x.leaf('LineExtensionAmount', amount(lt.base))
    x.leaf('LineExtensionAmountTaxInclusive', amount(lt.total))
    x.leaf('LineExtensionTaxAmount', amount(lt.vat))
    x.leaf('UnitPrice', czk(round(unitNet, 4)))
    x.leaf('UnitPriceTaxInclusive', czk(round(unitGross, 4)))
    x.open('ClassifiedTaxCategory')
    x.leaf('Percent', lt.vatRate)
    x.leaf('VATCalculationMethod', doc.pricesIncludeVat ? 1 : 0)
    x.close('ClassifiedTaxCategory')
    const legal = doc.vatPayer ? vatTreatmentText(lt.vatTreatment, 'cs') : ''
    if (legal) x.leaf('VATNote', legal)
    x.open('Item').leaf('Description', line.description).close('Item')
    x.close('InvoiceLine')
  })
  x.close('InvoiceLines')

  x.open('TaxTotal')
  const recap = t.recap.length > 0 ? t.recap : [{ vatRate: '0', base: t.subtotal, vat: '0.00', total: t.subtotal }]
  for (const r of recap) {
    x.open('TaxSubTotal')
    const rb = foreign ? ((r as { baseCzk?: string }).baseCzk ?? czk(r.base)) : r.base
    const rv = foreign ? ((r as { vatCzk?: string }).vatCzk ?? czk(r.vat)) : r.vat
    const rt = foreign ? ((r as { totalCzk?: string }).totalCzk ?? czk(r.total)) : r.total
    x.leaf('TaxableAmount', rb)
    x.leaf('TaxAmount', rv)
    x.leaf('TaxInclusiveAmount', rt)
    x.leaf('AlreadyClaimedTaxableAmount', '0.00')
    x.leaf('AlreadyClaimedTaxAmount', '0.00')
    x.leaf('AlreadyClaimedTaxInclusiveAmount', '0.00')
    x.leaf('DifferenceTaxableAmount', rb)
    x.leaf('DifferenceTaxAmount', rv)
    x.leaf('DifferenceTaxInclusiveAmount', rt)
    x.open('TaxCategory').leaf('Percent', r.vatRate).leaf('TaxScheme', 'VAT').close('TaxCategory')
    x.close('TaxSubTotal')
  }
  x.leaf('TaxAmount', t.vatTotalCzk)
  x.close('TaxTotal')

  const deposits = toFixed(doc.paidDeposits ?? 0)
  const payable = toFixed(parseDecimal(t.totalCzk).minus(czk(deposits)))
  x.open('LegalMonetaryTotal')
  x.leaf('TaxExclusiveAmount', t.subtotalCzk)
  x.leaf('TaxInclusiveAmount', toFixed(parseDecimal(t.subtotalCzk).plus(t.vatTotalCzk)))
  x.leaf('AlreadyClaimedTaxExclusiveAmount', '0.00')
  x.leaf('AlreadyClaimedTaxInclusiveAmount', '0.00')
  x.leaf('DifferenceTaxExclusiveAmount', t.subtotalCzk)
  x.leaf('DifferenceTaxInclusiveAmount', toFixed(parseDecimal(t.subtotalCzk).plus(t.vatTotalCzk)))
  x.leaf('PayableRoundingAmount', czk(t.rounding))
  x.leaf('PaidDepositsAmount', czk(deposits))
  x.leaf('PayableAmount', payable)
  x.close('LegalMonetaryTotal')

  const p = doc.payment
  if (p && p.bankAccount && (p.method === 'bank_transfer' || p.method === 'other')) {
    const b = p.bankAccount
    x.open('PaymentMeans').open('Payment')
    x.leaf('PaidAmount', payable)
    x.leaf('PaymentMeansCode', PAYMENT_MEANS_CODE[p.method])
    x.open('Details')
    x.leaf('PaymentDueDate', p.dueDate)
    x.leaf('ID', b.accountNumber ?? '')
    x.leaf('BankCode', b.bankCode ?? '')
    x.leaf('Name', b.bankName ?? '')
    x.leaf('IBAN', b.iban.replace(/\s/g, ''))
    x.leaf('BIC', b.bic ?? '')
    if (p.variableSymbol) x.leaf('VariableSymbol', p.variableSymbol)
    if (p.constantSymbol) x.leaf('ConstantSymbol', p.constantSymbol)
    if (p.specificSymbol) x.leaf('SpecificSymbol', p.specificSymbol)
    x.close('Details').close('Payment').close('PaymentMeans')
  }

  x.close('Invoice')
  return `<?xml version="1.0" encoding="UTF-8"?>\n${x.toString()}\n`
}
