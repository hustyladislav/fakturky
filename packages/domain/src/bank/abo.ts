import { Decimal } from '../money.ts'
import { aboAccount, blankToNull, cleanSymbol, parseShortDate } from './text.ts'
import { type ParsedStatement, type ParsedTransaction, StatementParseError } from './types.ts'

/** ISO 4217 numeric codes that appear in the currency field of Fio/ČSOB GPC files. */
const NUMERIC_CURRENCY: Record<string, string> = {
  '203': 'CZK',
  '978': 'EUR',
  '840': 'USD',
  '826': 'GBP',
  '985': 'PLN',
  '348': 'HUF',
  '756': 'CHF',
  '578': 'NOK',
  '752': 'SEK',
  '208': 'DKK',
  '946': 'RON',
  '975': 'BGN',
}

const slice = (line: string, from: number, to: number) => line.slice(from - 1, to)

/**
 * ABO / GPC statement (Czech standard, fixed width, records 074 header, 075 transaction, 078/079 free text).
 * Layout (1-based): 075 → account 4-19, counter-account 20-35 (6 prefix + 10 number), document 36-48,
 * amount in haléře 49-60, posting code 61 (1 debit, 2 credit, 4 storno debit, 5 storno credit), VS 62-71,
 * bank code 74-77 + KS 78-81, SS 82-91, value date 92-97 (DDMMYY), name 98-117, currency 118-122.
 * The text should be decoded as Windows-1250 when it is not valid UTF-8 (see `decodeBankFile`).
 */
export function parseAbo(text: string, options: { currency?: string } = {}): ParsedStatement {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/)
  const warnings: string[] = []
  const transactions: ParsedTransaction[] = []
  let accountNumber: string | null = null
  let statementDate: string | null = null
  let last: ParsedTransaction | null = null
  let seen = false

  for (const [i, raw] of lines.entries()) {
    if (raw.trim() === '') continue
    const type = raw.slice(0, 3)
    if (type === '074') {
      seen = true
      accountNumber = aboAccount(slice(raw, 4, 19).trim())
      statementDate = parseShortDate(slice(raw, 109, 114))
      last = null
    } else if (type === '075') {
      seen = true
      if (raw.length < 97) {
        warnings.push(`Line ${i + 1}: record 075 is too short`)
        continue
      }
      const amountMinor = slice(raw, 49, 60).trim()
      const code = slice(raw, 61, 61)
      const bookedOn = parseShortDate(slice(raw, 92, 97)) ?? statementDate
      if (!/^\d+$/.test(amountMinor) || !bookedOn) {
        warnings.push(`Line ${i + 1}: skipped (unreadable amount or date)`)
        continue
      }
      let sign: 1 | -1
      if (code === '2' || code === '4') sign = 1
      else if (code === '1' || code === '5') sign = -1
      else {
        warnings.push(`Line ${i + 1}: skipped (unknown posting code ${JSON.stringify(code)})`)
        continue
      }
      const amount = new Decimal(amountMinor).div(100).times(sign).toFixed(2)
      const bank = slice(raw, 74, 77).trim()
      const counter = aboAccount(slice(raw, 20, 35).trim())
      const currencyField = slice(raw, 118, 122).trim().replace(/^0+/, '')
      const currency =
        NUMERIC_CURRENCY[currencyField] ?? options.currency?.toUpperCase() ?? 'CZK'
      const tx: ParsedTransaction = {
        bookedOn,
        amount: amount === '-0.00' ? '0.00' : amount,
        currency,
        variableSymbol: cleanSymbol(slice(raw, 62, 71)),
        constantSymbol: cleanSymbol(slice(raw, 78, 81)),
        specificSymbol: cleanSymbol(slice(raw, 82, 91)),
        counterpartyAccount:
          counter && /^\d{1,4}$/.test(bank) && Number(bank) > 0
            ? `${counter}/${bank.padStart(4, '0')}`
            : counter,
        counterpartyName: blankToNull(slice(raw, 98, 117)),
        message: null,
        externalId: null,
      }
      transactions.push(tx)
      last = tx
    } else if (type === '078' || type === '079') {
      const extra = [blankToNull(slice(raw, 4, 38)), blankToNull(slice(raw, 39, 73))].filter(
        (v): v is string => v !== null,
      )
      if (last && extra.length > 0) {
        last.message = [last.message, ...extra].filter(Boolean).join(' ')
      }
    }
    // 076 (payment-order detail) and unknown records carry nothing needed for pairing.
  }
  if (!seen) {
    throw new StatementParseError('Not an ABO/GPC statement (no 074/075 records found)')
  }
  return { format: 'abo', iban: null, accountNumber, transactions, warnings }
}

export function looksLikeAbo(text: string): boolean {
  return /^(074|075)/m.test(text.slice(0, 2000)) && !text.trimStart().startsWith('<')
}
