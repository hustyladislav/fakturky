/** Source-independent shapes every importer maps into (Fakturoid API, CSV, ISDOC). */

export type ImportSource = 'fakturoid' | 'csv' | 'isdoc'

export type ImportContact = {
  /** Id in the source system, used to link invoices and to make re-imports idempotent. */
  externalId?: string
  name: string
  ico?: string | null
  dic?: string | null
  icDph?: string | null
  address: { street?: string; city?: string; zip?: string }
  country: string
  emails: string[]
  phone?: string | null
  note?: string | null
}

export type ImportLine = {
  description: string
  quantity: string
  unit?: string | null
  /** Unit price without VAT. */
  unitPrice: string
  vatRate: string
  discountPercent?: string
}

export type ImportPayment = { paidOn: string; amount: string }

export type ImportDocument = {
  externalId?: string
  type: 'invoice' | 'proforma' | 'payment_receipt'
  /** The original number; kept verbatim. */
  number: string
  issueDate: string
  taxableDate?: string | null
  dueDate: string
  currency: string
  exchangeRate?: string | null
  language: 'cs' | 'sk' | 'en'
  paymentMethod: string
  variableSymbol?: string | null
  constantSymbol?: string | null
  orderNumber?: string | null
  introText?: string | null
  footerText?: string | null
  privateNote?: string | null
  /** Link to an imported contact by its source id; otherwise `customer` is matched/created. */
  customerExternalId?: string
  customer: ImportContact
  supplier?: Record<string, unknown>
  bank?: {
    accountNumber?: string | null
    bankCode?: string | null
    iban?: string | null
    bic?: string | null
  } | null
  lines: ImportLine[]
  payments: ImportPayment[]
  cancelled: boolean
  reverseCharge: boolean
  /** One-Stop-Shop treatment (EU consumers). */
  oss?: boolean
  /** Total according to the source system; used to carry over rounding differences. */
  sourceTotal?: string | null
}

export type ImportBatch = { contacts: ImportContact[]; documents: ImportDocument[] }

export type ImportIssue = {
  kind: 'contact' | 'document'
  ref: string
  level: 'skipped' | 'failed' | 'warning'
  message: string
}

export type ImportSummary = {
  dryRun: boolean
  contacts: { created: number; skipped: number }
  documents: { created: number; skipped: number; failed: number }
  /** Series counters raised so newly issued numbers continue after the imported ones. */
  numberingAdjusted: number
  issues: ImportIssue[]
}
