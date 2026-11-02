import { looksLikeAbo, parseAbo } from './abo.ts'
import { parseCamt053 } from './camt.ts'
import { parseBankCsv } from './csv.ts'
import { type CsvParseOptions, type ParsedStatement, StatementParseError } from './types.ts'

export { parseAbo } from './abo.ts'
export { parseCamt053 } from './camt.ts'
export { detectCsvFormat, parseBankCsv, readDelimited } from './csv.ts'
export { decodeBankFile, parseBankAmount, parseBankDate } from './text.ts'
export * from './types.ts'

/** Detects CAMT.053 XML, ABO/GPC or CSV from the content and parses it. */
export function parseStatement(text: string, options: CsvParseOptions = {}): ParsedStatement {
  const head = text.replace(/^﻿/, '').trimStart()
  if (head.startsWith('<')) return parseCamt053(text)
  if (looksLikeAbo(head)) return parseAbo(head, options)
  if (head === '') throw new StatementParseError('The file is empty')
  return parseBankCsv(text, options)
}
