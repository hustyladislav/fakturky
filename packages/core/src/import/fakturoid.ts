import { Decimal, type FetchLike, IntegrationError } from '@fakturky/domain'
import { BRAND } from '../brand'
import type { ImportContact, ImportDocument, ImportLine } from './types'

const BASE = 'https://app.fakturoid.cz/api/v3'
const MAX_PAGES = 500

type Json = Record<string, unknown>
const str = (v: unknown): string | null =>
  v === null || v === undefined || v === '' ? null : String(v)
const num = (v: unknown, fallback: string): string => {
  const s = str(v)
  return s === null ? fallback : s
}

export type FakturoidCredentials = {
  accountSlug: string
  clientId: string
  clientSecret: string
  /** Contact for the mandatory User-Agent header; defaults to the project URL. */
  contactEmail?: string
}

/**
 * Minimal Fakturoid API v3 client (client-credentials flow). Credentials live only in memory for the
 * duration of an import and never appear in errors.
 */
export class FakturoidClient {
  private token: string | null = null
  private readonly userAgent: string

  constructor(
    private readonly creds: FakturoidCredentials,
    private readonly fetchFn: FetchLike = (input, init) => fetch(input, init),
  ) {
    if (!/^[a-z0-9][a-z0-9_-]*$/i.test(creds.accountSlug)) {
      throw new IntegrationError('Invalid Fakturoid account slug', 'invalid_input')
    }
    this.userAgent = `${BRAND.name} import (${creds.contactEmail ?? BRAND.repoUrl})`
  }

  private async authenticate(): Promise<string> {
    const basic = Buffer.from(`${this.creds.clientId}:${this.creds.clientSecret}`).toString(
      'base64',
    )
    const res = await this.fetchFn(`${BASE}/oauth/token`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${basic}`,
        'content-type': 'application/json',
        accept: 'application/json',
        'user-agent': this.userAgent,
      },
      body: JSON.stringify({ grant_type: 'client_credentials' }),
    })
    if (!res.ok) {
      throw new IntegrationError(
        res.status === 401 || res.status === 403
          ? 'Fakturoid rejected the client id / secret'
          : `Fakturoid authentication failed (HTTP ${res.status})`,
        'http_error',
        res.status,
      )
    }
    const body = (await res.json()) as { access_token?: string }
    if (!body.access_token) throw new IntegrationError('Fakturoid sent no token', 'bad_response')
    return body.access_token
  }

  private async get(path: string, page: number): Promise<Json[]> {
    this.token ??= await this.authenticate()
    const url = `${BASE}/accounts/${this.creds.accountSlug}/${path}${path.includes('?') ? '&' : '?'}page=${page}`
    for (let attempt = 0; ; attempt++) {
      const res = await this.fetchFn(url, {
        headers: {
          authorization: `Bearer ${this.token}`,
          accept: 'application/json',
          'user-agent': this.userAgent,
        },
      })
      if (res.status === 429 && attempt < 3) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
        continue
      }
      if (res.status === 401 && attempt === 0) {
        this.token = await this.authenticate()
        continue
      }
      if (!res.ok) {
        throw new IntegrationError(
          res.status === 404
            ? 'Fakturoid account not found (check the account slug)'
            : `Fakturoid request failed (HTTP ${res.status})`,
          'http_error',
          res.status,
        )
      }
      return (await res.json()) as Json[]
    }
  }

  private async all(path: string): Promise<Json[]> {
    const out: Json[] = []
    for (let page = 1; page <= MAX_PAGES; page++) {
      const rows = await this.get(path, page)
      out.push(...rows)
      if (rows.length < 40) break
    }
    return out
  }

  async subjects(): Promise<ImportContact[]> {
    return (await this.all('subjects.json')).map(mapSubject)
  }

  /** Issued invoices and proformas (drafts do not exist in Fakturoid; corrections are skipped by the importer). */
  async invoices(): Promise<{ documents: ImportDocument[]; unsupported: string[] }> {
    const documents: ImportDocument[] = []
    const unsupported: string[] = []
    for (const row of await this.all('invoices.json')) {
      const mapped = mapInvoice(row)
      if (mapped) documents.push(mapped)
      else unsupported.push(`${str(row.number) ?? str(row.id) ?? '?'} (${str(row.document_type)})`)
    }
    return { documents, unsupported }
  }
}

export function mapSubject(s: Json): ImportContact {
  const emails = [str(s.email), str(s.email_copy)].filter((e): e is string => !!e?.includes('@'))
  return {
    externalId: str(s.id) ?? undefined,
    name: str(s.name) ?? str(s.full_name) ?? 'Bez názvu',
    ico: str(s.registration_no),
    dic: str(s.vat_no),
    icDph: str(s.local_vat_no),
    address: {
      street: str(s.street) ?? undefined,
      city: str(s.city) ?? undefined,
      zip: str(s.zip) ?? undefined,
    },
    country: (str(s.country) ?? 'CZ').slice(0, 2).toUpperCase(),
    emails: [...new Set(emails)],
    phone: str(s.phone),
    note: str(s.private_note),
  }
}

const LANGUAGES: Record<string, 'cs' | 'sk' | 'en'> = { cz: 'cs', cs: 'cs', sk: 'sk', en: 'en' }
const PAYMENT_METHODS: Record<string, string> = {
  bank: 'bank_transfer',
  cash: 'cash',
  cod: 'cash_on_delivery',
  card: 'card',
}

/** Fakturoid sends domestic accounts as "1234/2010". */
function bankFrom(account: string | null, iban: string | null) {
  if (!account && !iban) return null
  const [number, code] = account?.split('/') ?? []
  return { accountNumber: number ?? null, bankCode: code ?? null, iban }
}

/** Null for document types the app does not model (corrections, tax documents for received payments). */
export function mapInvoice(i: Json): ImportDocument | null {
  const type = str(i.document_type) ?? 'invoice'
  if (type === 'correction' || type === 'tax_document') return null
  const docType = type === 'proforma' || type === 'partial_proforma' ? 'proforma' : 'invoice'

  const rawLines = Array.isArray(i.lines) ? (i.lines as Json[]) : []
  const lines: ImportLine[] = rawLines.map((l) => ({
    description: str(l.name) ?? '—',
    quantity: num(l.quantity, '1'),
    unit: str(l.unit_name),
    // Always the net price, whatever the document's VAT price mode was.
    unitPrice: num(l.unit_price_without_vat ?? l.unit_price, '0'),
    vatRate: num(l.vat_rate, '0'),
  }))

  const status = str(i.status)
  const currency = (str(i.currency) ?? 'CZK').toUpperCase()
  const total = str(i.total)
  const paidOn = str(i.paid_on)
  const rawPayments = Array.isArray(i.payments) ? (i.payments as Json[]) : []
  const payments = rawPayments
    .map((p) => ({ paidOn: str(p.paid_on), amount: str(p.amount) }))
    .filter((p): p is { paidOn: string; amount: string } => !!p.paidOn && !!p.amount)
  if (payments.length === 0 && status === 'paid' && paidOn && total) {
    payments.push({ paidOn, amount: total })
  }

  // Advances (final invoices) and partial payments: `remaining_amount` is what is still owed.
  const remaining = str(i.remaining_amount)
  if (remaining !== null && total !== null && status !== 'cancelled') {
    const paidSoFar = payments.reduce((sum, p) => sum.plus(p.amount), new Decimal(0))
    const implied = new Decimal(total).minus(remaining).minus(paidSoFar)
    if (implied.gt('0.005')) {
      payments.push({
        paidOn: (paidOn ?? str(i.issued_on) ?? '').slice(0, 10),
        amount: implied.toFixed(2),
      })
    }
  }

  const issueDate = (str(i.issued_on) ?? '').slice(0, 10)
  const country = (str(i.client_country) ?? 'CZ').slice(0, 2).toUpperCase()

  return {
    externalId: str(i.id) ?? undefined,
    type: docType,
    number: str(i.number) ?? `import-${str(i.id)}`,
    issueDate,
    taxableDate: str(i.taxable_fulfillment_due)?.slice(0, 10) ?? null,
    dueDate: (str(i.due_on) ?? issueDate).slice(0, 10),
    currency,
    exchangeRate: currency === 'CZK' ? null : str(i.exchange_rate),
    language: LANGUAGES[str(i.language) ?? 'cz'] ?? 'cs',
    paymentMethod: PAYMENT_METHODS[str(i.payment_method) ?? 'bank'] ?? 'other',
    variableSymbol: str(i.variable_symbol),
    constantSymbol: null,
    orderNumber: str(i.order_number),
    introText: str(i.note),
    footerText: str(i.footer_note),
    privateNote: str(i.private_note),
    customerExternalId: str(i.subject_id) ?? undefined,
    customer: {
      externalId: str(i.subject_id) ?? undefined,
      name: str(i.client_name) ?? 'Bez názvu',
      ico: str(i.client_registration_no),
      dic: str(i.client_vat_no),
      icDph: str(i.client_local_vat_no),
      address: {
        street: str(i.client_street) ?? undefined,
        city: str(i.client_city) ?? undefined,
        zip: str(i.client_zip) ?? undefined,
      },
      country,
      emails: [],
    },
    supplier: {
      name: str(i.your_name),
      ico: str(i.your_registration_no),
      dic: str(i.your_vat_no),
      address: {
        street: str(i.your_street),
        city: str(i.your_city),
        zip: str(i.your_zip),
        country: str(i.your_country),
      },
    },
    bank: bankFrom(str(i.bank_account), str(i.iban)),
    lines,
    payments,
    cancelled: status === 'cancelled',
    reverseCharge: i.transferred_tax_liability === true,
    oss: i.oss === 'service' || i.oss === 'goods',
    sourceTotal: total,
  }
}
