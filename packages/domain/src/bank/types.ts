/** A bank statement line in a bank-neutral shape. `amount` is a signed decimal string (credit > 0, debit < 0). */
export type ParsedTransaction = {
  /** YYYY-MM-DD */
  bookedOn: string
  amount: string
  /** ISO 4217 alpha code, upper case. */
  currency: string
  variableSymbol: string | null
  constantSymbol: string | null
  specificSymbol: string | null
  /** "[prefix-]number/bankCode" for Czech accounts, otherwise the IBAN / account string the bank printed. */
  counterpartyAccount: string | null
  counterpartyName: string | null
  message: string | null
  /** Id assigned by the bank when the format carries one; null means the caller derives a fingerprint. */
  externalId: string | null
}

export type StatementFormat =
  | 'fio-csv'
  | 'revolut-csv'
  | 'csob-csv'
  | 'kb-csv'
  | 'raiffeisen-csv'
  | 'generic-csv'
  | 'abo'
  | 'camt053'

export type ParsedStatement = {
  format: StatementFormat
  /** Own account as printed in the file, when it carries one (CAMT/Fio preamble: IBAN; ABO: "[prefix-]number"). */
  iban: string | null
  accountNumber: string | null
  transactions: ParsedTransaction[]
  /** Non-fatal problems (skipped rows, unparsable values). Always Czech-agnostic English; the UI wraps them. */
  warnings: string[]
}

export class StatementParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StatementParseError'
  }
}

/** Fields a CSV column can be mapped to (used by the generic mapped import). */
export const CSV_FIELDS = [
  'date',
  'amount',
  'currency',
  'variableSymbol',
  'constantSymbol',
  'specificSymbol',
  'counterpartyAccount',
  'counterpartyBank',
  'counterpartyName',
  'message',
  'id',
  'state',
] as const
export type CsvField = (typeof CSV_FIELDS)[number]

export type CsvParseOptions = {
  /** Used when the file has no currency column. */
  currency?: string
  /** Explicit header name per field; overrides the auto-detected columns (the "generic mapped CSV"). */
  mapping?: Partial<Record<CsvField, string>>
  /** Force the delimiter; detected from the header otherwise. */
  delimiter?: ',' | ';' | '\t'
}
