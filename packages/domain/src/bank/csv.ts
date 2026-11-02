import {
  blankToNull,
  cleanSymbol,
  joinAccount,
  normalizeHeader,
  parseBankAmount,
  parseBankDate,
} from './text.ts'
import {
  type CsvField,
  type CsvParseOptions,
  type ParsedStatement,
  type ParsedTransaction,
  StatementParseError,
  type StatementFormat,
} from './types.ts'

/** RFC 4180-ish reader: quoted fields, doubled quotes, embedded newlines. Returns rows of raw cells. */
export function readDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i] as string
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else cell += c
    } else if (c === '"' && cell === '') {
      quoted = true
    } else if (c === delimiter) {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      cell = ''
      rows.push(row)
      row = []
    } else cell += c
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

/** Column aliases per field, normalised (see `normalizeHeader`), most specific first. */
const ALIASES: Record<CsvField, string[]> = {
  id: [
    'idoperace',
    'idpohybu',
    'idtransakce',
    'transactionid',
    'idtransakcebanky',
    'referencebanky',
    'id',
  ],
  date: [
    'datumzauctovani',
    'datum',
    'datumprovedeni',
    'datumpohybu',
    'datumuskutecneni',
    'completeddate',
    'datecompletedutc',
    'datecompleted',
    'starteddate',
    'datestartedutc',
    'datestarted',
    'bookingdate',
    'date',
    'datumsplatnosti',
  ],
  amount: ['objem', 'castka', 'zauctovanacastka', 'castkavmeneuctu', 'amount', 'paymentamount'],
  currency: ['mena', 'menauctu', 'currency', 'paymentcurrency'],
  variableSymbol: ['vs', 'variabilnisymbol', 'variabilni'],
  constantSymbol: ['ks', 'konstantnisymbol', 'konstantni'],
  specificSymbol: ['ss', 'specifickysymbol', 'specificky'],
  counterpartyAccount: [
    'protiucet',
    'cisloprotiuctu',
    'cislouctuprotistrany',
    'uctuprotistrany',
    'cisloprotiuctuiban',
    'beneficiaryiban',
    'beneficiaryaccountnumber',
    'ibanprotistrany',
  ],
  counterpartyBank: ['kodbanky', 'kodbankyprotistrany', 'kodbankyprotiuctu', 'kodprotibanky'],
  counterpartyName: [
    'nazevprotiuctu',
    'nazevprotistrany',
    'nazevuctuprotistrany',
    'protistrana',
    'payer',
    'counterparty',
    'description',
    'popis',
  ],
  message: [
    'zpravaproprijemce',
    'zprava',
    'zpravaprijemci',
    'reference',
    'uzivatelskaidentifikace',
    'upresneni',
    'poznamka',
    'note',
    'popisprijemce',
  ],
  state: ['state', 'stav', 'status'],
}

const REQUIRED: CsvField[] = ['date', 'amount']

/** Which export we think this is, from the header only. Drives number format hints and the UI label. */
export function detectCsvFormat(headers: string[]): StatementFormat {
  const h = new Set(headers.map(normalizeHeader))
  if (h.has('idoperace') || h.has('idpohybu')) return 'fio-csv'
  if (
    h.has('starteddate') ||
    h.has('completeddate') ||
    h.has('datestartedutc') ||
    h.has('datecompletedutc')
  ) {
    return 'revolut-csv'
  }
  if (h.has('zauctovanacastka') || h.has('menauctu')) return 'raiffeisen-csv'
  if (h.has('oznacenioperace')) return 'csob-csv'
  if (h.has('nazevprotistrany') || h.has('datumsplatnosti')) return 'kb-csv'
  return 'generic-csv'
}

const DECIMAL_HINT: Partial<Record<StatementFormat, 'comma' | 'dot'>> = {
  'fio-csv': 'comma',
  'csob-csv': 'comma',
  'kb-csv': 'comma',
  'raiffeisen-csv': 'comma',
  'revolut-csv': 'dot',
}

function detectDelimiter(sample: string): ',' | ';' | '\t' {
  const first = sample.split(/\r?\n/).filter((l) => l.trim() !== '')
  const score = (d: string) => {
    let best = 0
    for (const line of first.slice(0, 40)) {
      const n = readDelimited(line, d)[0]?.length ?? 0
      if (n > best) best = n
    }
    return best
  }
  const cands: Array<',' | ';' | '\t'> = [';', ',', '\t']
  return cands.reduce((a, b) => (score(b) > score(a) ? b : a))
}

/** The header row is the first row that maps both a date and an amount column (skips Fio's account preamble). */
function findHeader(
  rows: string[][],
  mapping: CsvParseOptions['mapping'],
): { index: number; columns: Partial<Record<CsvField, number>> } | null {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const row = rows[i] as string[]
    const columns = mapColumns(row, mapping)
    if (REQUIRED.every((f) => columns[f] !== undefined) && row.length >= 3) {
      return { index: i, columns }
    }
  }
  return null
}

function mapColumns(
  headers: string[],
  mapping: CsvParseOptions['mapping'],
): Partial<Record<CsvField, number>> {
  const norm = headers.map(normalizeHeader)
  const out: Partial<Record<CsvField, number>> = {}
  for (const field of Object.keys(ALIASES) as CsvField[]) {
    const explicit = mapping?.[field]
    if (explicit) {
      const at = norm.indexOf(normalizeHeader(explicit))
      if (at >= 0) out[field] = at
      continue
    }
    for (const alias of ALIASES[field]) {
      const at = norm.indexOf(alias)
      if (at >= 0) {
        out[field] = at
        break
      }
    }
  }
  return out
}

const FINAL_STATES = new Set(['completed', 'dokonceno', 'zauctovano', 'booked', 'hotovo'])

export function parseBankCsv(text: string, options: CsvParseOptions = {}): ParsedStatement {
  const clean = text.replace(/^﻿/, '')
  const delimiter = options.delimiter ?? detectDelimiter(clean)
  const rows = readDelimited(clean, delimiter)
  const header = findHeader(rows, options.mapping)
  if (!header) {
    throw new StatementParseError(
      'Could not find a header row with a date and an amount column. Map the columns manually.',
    )
  }
  const headers = rows[header.index] as string[]
  const format = options.mapping ? 'generic-csv' : detectCsvFormat(headers)
  const decimal = DECIMAL_HINT[format] ?? 'auto'
  const col = header.columns
  const warnings: string[] = []
  const transactions: ParsedTransaction[] = []

  const iban =
    rows
      .slice(0, header.index)
      .flat()
      .map((c) => c.replace(/\s/g, '').toUpperCase())
      .find((c) => /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(c)) ?? null

  const defaultCurrency = options.currency?.toUpperCase() ?? null
  for (let r = header.index + 1; r < rows.length; r++) {
    const cells = rows[r] as string[]
    const get = (f: CsvField) => {
      const at = col[f]
      return at === undefined ? null : blankToNull(cells[at])
    }
    const line = r + 1
    const state = get('state')
    if (state && !FINAL_STATES.has(normalizeHeader(state))) continue
    // Summary / footer rows without a date are not transactions.
    const dateRaw = get('date')
    const amountRaw = get('amount')
    if (!dateRaw && !amountRaw) continue
    const bookedOn = dateRaw ? parseBankDate(dateRaw) : null
    const amount = amountRaw ? parseBankAmount(amountRaw, decimal) : null
    if (!bookedOn || !amount) {
      warnings.push(`Row ${line}: skipped (unreadable date or amount)`)
      continue
    }
    const currency = (get('currency') ?? defaultCurrency)?.toUpperCase() ?? null
    if (!currency || !/^[A-Z]{3}$/.test(currency)) {
      warnings.push(`Row ${line}: skipped (missing currency)`)
      continue
    }
    const name = get('counterpartyName')
    const message = get('message')
    transactions.push({
      bookedOn,
      amount,
      currency,
      variableSymbol: cleanSymbol(get('variableSymbol')),
      constantSymbol: cleanSymbol(get('constantSymbol')),
      specificSymbol: cleanSymbol(get('specificSymbol')),
      counterpartyAccount: joinAccount(get('counterpartyAccount'), get('counterpartyBank')),
      counterpartyName: name,
      message,
      externalId: get('id'),
    })
  }
  return { format, iban, accountNumber: null, transactions, warnings }
}
