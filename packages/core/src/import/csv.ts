import type { ImportContact, ImportDocument } from './types'

/** RFC 4180 parser with `;` / `,` / tab auto-detection (Czech Excel exports use `;`). */
export function parseCsv(input: string): string[][] {
  const src = input.replace(/^﻿/, '')
  const firstLine = src.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = [';', '\t', ','].reduce((best, d) =>
    firstLine.split(d).length > firstLine.split(best).length ? d : best,
  )
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === delimiter) {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.some((f) => f.trim() !== '')) rows.push(row)
      row = []
    } else field += c
  }
  row.push(field)
  if (row.some((f) => f.trim() !== '')) rows.push(row)
  return rows
}

const norm = (h: string) =>
  h
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')

const ALIASES: Record<string, string[]> = {
  name: ['name', 'nazev', 'jmeno', 'firma', 'odberatel_nazev'],
  ico: ['ico', 'ic', 'registration_no'],
  dic: ['dic', 'vat_no'],
  ic_dph: ['ic_dph', 'icdph'],
  email: ['email', 'e_mail'],
  phone: ['phone', 'telefon', 'tel'],
  street: ['street', 'ulice'],
  city: ['city', 'mesto'],
  zip: ['zip', 'psc'],
  country: ['country', 'zeme', 'stat'],
  note: ['note', 'poznamka'],
  number: ['number', 'cislo', 'cislo_dokladu', 'cislo_faktury'],
  type: ['type', 'typ', 'druh'],
  issue_date: ['issue_date', 'datum_vystaveni', 'vystaveno', 'issued_on'],
  taxable_date: ['taxable_date', 'duzp', 'datum_zdanitelneho_plneni'],
  due_date: ['due_date', 'splatnost', 'datum_splatnosti', 'due_on'],
  currency: ['currency', 'mena'],
  exchange_rate: ['exchange_rate', 'kurz'],
  customer: ['customer', 'odberatel', 'zakaznik', 'customer_name'],
  customer_ico: ['customer_ico', 'odberatel_ico', 'ico_odberatele'],
  customer_dic: ['customer_dic', 'odberatel_dic', 'dic_odberatele'],
  customer_email: ['customer_email', 'odberatel_email'],
  customer_street: ['customer_street', 'odberatel_ulice'],
  customer_city: ['customer_city', 'odberatel_mesto'],
  customer_zip: ['customer_zip', 'odberatel_psc'],
  customer_country: ['customer_country', 'odberatel_zeme'],
  variable_symbol: ['variable_symbol', 'variabilni_symbol', 'vs'],
  paid_on: ['paid_on', 'datum_uhrady', 'uhrazeno'],
  cancelled: ['cancelled', 'storno', 'stornovano'],
  description: ['description', 'popis', 'polozka', 'nazev_polozky'],
  quantity: ['quantity', 'mnozstvi', 'pocet'],
  unit: ['unit', 'jednotka', 'mj'],
  unit_price: ['unit_price', 'cena', 'jednotkova_cena', 'cena_bez_dph'],
  vat_rate: ['vat_rate', 'dph', 'sazba_dph'],
}

function indexer(header: string[]) {
  const cols = header.map(norm)
  return (row: string[], key: string): string => {
    const i = cols.findIndex((c) => ALIASES[key]?.includes(c))
    return i >= 0 ? (row[i] ?? '').trim() : ''
  }
}

/** Accepts YYYY-MM-DD and the Czech D. M. YYYY forms; returns null when unparseable. */
export function normalizeDate(value: string): string | null {
  const v = value.trim()
  let iso: string | null = null
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) iso = v.slice(0, 10)
  else {
    const m = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/.exec(v)
    if (m) iso = `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`
  }
  if (!iso) return null
  // Reject impossible calendar dates (2024-02-30): the round trip must be lossless.
  const date = new Date(`${iso}T00:00:00Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso ? null : iso
}

/** Normalizes a decimal cell (`1 234,50` → `1234.50`); null when not a number. */
const parseDec = (v: string): string | null => {
  const s = v.replace(/\s/g, '').replace(',', '.')
  return /^-?\d+(\.\d+)?$/.test(s) ? s : null
}

/** Lenient variant for optional cells (e.g. exchange rate): invalid → fallback. */
const dec = (v: string, fallback = '0') => parseDec(v) ?? fallback

const empty = (v: string) => (v === '' ? null : v)

export function contactsFromCsv(input: string): ImportContact[] {
  const [header, ...rows] = parseCsv(input)
  if (!header) return []
  const get = indexer(header)
  return rows
    .map((r) => ({
      name: get(r, 'name'),
      ico: empty(get(r, 'ico')),
      dic: empty(get(r, 'dic')),
      icDph: empty(get(r, 'ic_dph')),
      address: {
        street: get(r, 'street') || undefined,
        city: get(r, 'city') || undefined,
        zip: get(r, 'zip') || undefined,
      },
      country: (get(r, 'country') || 'CZ').slice(0, 2).toUpperCase(),
      emails: get(r, 'email')
        .split(/[,;\s]+/)
        .filter((e) => e.includes('@')),
      phone: empty(get(r, 'phone')),
      note: empty(get(r, 'note')),
    }))
    .filter((c) => c.name !== '')
}

export type CsvInvoiceResult = {
  documents: ImportDocument[]
  problems: { number: string; message: string }[]
}

/** One row per invoice line; rows sharing a `number` form one document. */
export function invoicesFromCsv(input: string): CsvInvoiceResult {
  const [header, ...rows] = parseCsv(input)
  const documents = new Map<string, ImportDocument>()
  const problems: CsvInvoiceResult['problems'] = []
  const invalid = new Set<string>()
  if (!header) return { documents: [], problems }
  const get = indexer(header)

  for (const r of rows) {
    const number = get(r, 'number')
    if (!number) continue
    if (invalid.has(number)) continue
    let doc = documents.get(number)
    if (!doc) {
      const issueDate = normalizeDate(get(r, 'issue_date'))
      if (!issueDate) {
        // A malformed document-level field rejects every row of the invoice.
        invalid.add(number)
        problems.push({ number, message: 'Missing or invalid issue date' })
        continue
      }
      const currency = (get(r, 'currency') || 'CZK').toUpperCase()
      const type = /proforma|zaloh/i.test(get(r, 'type')) ? 'proforma' : 'invoice'
      doc = {
        type,
        number,
        issueDate,
        taxableDate: normalizeDate(get(r, 'taxable_date')),
        dueDate: normalizeDate(get(r, 'due_date')) ?? issueDate,
        currency,
        exchangeRate: currency === 'CZK' ? null : empty(dec(get(r, 'exchange_rate'), '')),
        language: 'cs',
        paymentMethod: 'bank_transfer',
        variableSymbol: empty(get(r, 'variable_symbol')),
        customer: {
          name: get(r, 'customer') || 'Bez názvu',
          ico: empty(get(r, 'customer_ico')),
          dic: empty(get(r, 'customer_dic')),
          address: {
            street: get(r, 'customer_street') || undefined,
            city: get(r, 'customer_city') || undefined,
            zip: get(r, 'customer_zip') || undefined,
          },
          country: (get(r, 'customer_country') || 'CZ').slice(0, 2).toUpperCase(),
          emails: get(r, 'customer_email')
            .split(/[,;\s]+/)
            .filter((e) => e.includes('@')),
        },
        lines: [],
        payments: [],
        cancelled: /^(1|true|ano|yes)$/i.test(get(r, 'cancelled')),
        reverseCharge: false,
      }
      const paidOn = normalizeDate(get(r, 'paid_on'))
      if (paidOn) doc.payments.push({ paidOn, amount: '__total__' })
      documents.set(number, doc)
    }
    const description = get(r, 'description')
    if (!description && (get(r, 'unit_price') !== '' || get(r, 'quantity') !== '')) {
      // An amount without a description would silently vanish from the totals.
      invalid.add(number)
      problems.push({ number, message: 'A line has an amount but no description' })
      continue
    }
    if (description) {
      // Money cells must parse: never import altered amounts silently.
      const quantity = get(r, 'quantity') === '' ? '1' : parseDec(get(r, 'quantity'))
      const unitPrice = parseDec(get(r, 'unit_price'))
      const vatRate = get(r, 'vat_rate') === '' ? '0' : parseDec(get(r, 'vat_rate'))
      if (quantity === null || unitPrice === null || vatRate === null) {
        const what = quantity === null ? 'quantity' : unitPrice === null ? 'unit price' : 'VAT rate'
        invalid.add(number)
        problems.push({ number, message: `Invalid or missing ${what} on line "${description}"` })
        continue
      }
      doc.lines.push({ description, quantity, unit: empty(get(r, 'unit')), unitPrice, vatRate })
    }
  }
  return {
    documents: [...documents.values()].filter((d) => !invalid.has(d.number)),
    problems,
  }
}
