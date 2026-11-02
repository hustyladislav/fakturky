import { Decimal } from '@fakturky/domain'
import type { ImportContact, ImportDocument, ImportLine } from './types'

/** Tiny, dependency-free ISDOC reader: only the elements an invoice import needs. */

const unescapeXml = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&')

/** Inner XML of the first `<tag>` (namespace prefixes tolerated), or null. */
function block(xml: string, tag: string): string | null {
  const m = new RegExp(`<(?:\\w+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${tag}>`).exec(xml)
  return m?.[1] ?? null
}

function blocks(xml: string, tag: string): { attrs: string; inner: string }[] {
  const re = new RegExp(`<(?:\\w+:)?${tag}((?:\\s[^>]*)?)>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, 'g')
  return [...xml.matchAll(re)].map((m) => ({ attrs: m[1] ?? '', inner: m[2] ?? '' }))
}

function text(xml: string | null, tag: string): string | null {
  if (!xml) return null
  const inner = block(xml, tag)
  if (inner === null) return null
  // Leaf elements only: anything with child markup is not a text value.
  if (inner.includes('<')) return null
  const v = unescapeXml(inner).trim()
  return v === '' ? null : v
}

function party(xml: string | null): ImportContact {
  const street = [text(xml, 'StreetName'), text(xml, 'BuildingNumber')].filter(Boolean).join(' ')
  const countryBlock = xml ? block(xml, 'Country') : null
  return {
    name: text(xml ? block(xml, 'PartyName') : null, 'Name') ?? 'Bez názvu',
    ico: text(xml ? block(xml, 'PartyIdentification') : null, 'ID'),
    dic: text(xml ? block(xml, 'PartyTaxScheme') : null, 'CompanyID'),
    address: {
      street: street || undefined,
      city: text(xml, 'CityName') ?? undefined,
      zip: text(xml, 'PostalZone') ?? undefined,
    },
    country: (text(countryBlock, 'IdentificationCode') ?? 'CZ').toUpperCase(),
    emails: [text(xml, 'ElectronicMail')].filter((e): e is string => !!e),
    phone: text(xml, 'Telephone'),
  }
}

const PAYMENT_METHODS: Record<string, string> = {
  '10': 'cash',
  '48': 'card',
  '50': 'cash_on_delivery',
}

export type IsdocParseResult =
  | { ok: true; document: ImportDocument }
  | { ok: false; number: string; reason: string }

export function parseIsdoc(xml: string): IsdocParseResult {
  const number = text(xml, 'ID') ?? '?'
  if (!/<(?:\w+:)?Invoice[\s>]/.test(xml)) {
    return { ok: false, number, reason: 'Not an ISDOC invoice' }
  }
  const code = Number(text(xml, 'DocumentType') ?? '1')
  if ([2, 3, 6].includes(code)) {
    return { ok: false, number, reason: 'Credit/debit notes are not supported' }
  }

  const foreignCurrency = text(xml, 'ForeignCurrencyCode')
  const currency = (foreignCurrency ?? text(xml, 'LocalCurrencyCode') ?? 'CZK').toUpperCase()
  const rate = text(xml, 'CurrRate')

  const lines: ImportLine[] = blocks(block(xml, 'InvoiceLines') ?? '', 'InvoiceLine').map(
    ({ inner }) => {
      const qtyEl = blocks(inner, 'InvoicedQuantity')[0]
      const quantity = text(inner, 'InvoicedQuantity') ?? '1'
      const unit = /unitCode="([^"]*)"/.exec(qtyEl?.attrs ?? '')?.[1] ?? null
      const net = foreignCurrency
        ? (text(inner, 'LineExtensionAmountCurr') ?? text(inner, 'LineExtensionAmount'))
        : text(inner, 'LineExtensionAmount')
      const qty = new Decimal(quantity || '1')
      return {
        description: text(block(inner, 'Item'), 'Description') ?? '—',
        quantity,
        unit: unit ? unescapeXml(unit) : null,
        unitPrice:
          net === null || qty.isZero()
            ? (text(inner, 'UnitPrice') ?? '0')
            : new Decimal(net).div(qty).toString(),
        vatRate: text(block(inner, 'ClassifiedTaxCategory'), 'Percent') ?? '0',
      }
    },
  )

  // Reverse charge is encoded as zero-rate lines carrying the legal VAT note (as this app exports it).
  const reverseCharge =
    /přenesen[íi]\s+daňov/i.test(xml) && lines.every((l) => Number(l.vatRate) === 0)

  const details = block(xml, 'Details')
  const payable = text(xml, 'PayableAmount')
  const issueDate = text(xml, 'IssueDate') ?? ''
  const customerBlock = block(xml, 'AccountingCustomerParty')
  const customer = party(customerBlock)

  return {
    ok: true,
    document: {
      externalId: text(xml, 'UUID') ?? undefined,
      type: code === 4 ? 'proforma' : code === 5 ? 'payment_receipt' : 'invoice',
      number,
      issueDate,
      taxableDate: text(xml, 'TaxPointDate'),
      dueDate: text(details, 'PaymentDueDate') ?? issueDate,
      currency,
      exchangeRate: foreignCurrency && rate ? rate : null,
      language: 'cs',
      paymentMethod: PAYMENT_METHODS[text(xml, 'PaymentMeansCode') ?? ''] ?? 'bank_transfer',
      variableSymbol: text(details, 'VariableSymbol'),
      constantSymbol: text(details, 'ConstantSymbol'),
      introText: text(xml.replace(/<InvoiceLines>[\s\S]*<\/InvoiceLines>/, ''), 'Note'),
      customer,
      supplier: { ...party(block(xml, 'AccountingSupplierParty')) },
      bank: details
        ? {
            accountNumber: text(details, 'ID'),
            bankCode: text(details, 'BankCode'),
            iban: text(details, 'IBAN'),
            bic: text(details, 'BIC'),
          }
        : null,
      lines,
      payments: [],
      cancelled: false,
      reverseCharge,
      sourceTotal: payable && !foreignCurrency ? payable : null,
    },
  }
}
