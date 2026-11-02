import { cleanSymbol, joinAccount, parseBankAmount, parseBankDate } from '../bank/text.ts'
import type { ParsedTransaction } from '../bank/types.ts'
import { type ClientOptions, IntegrationError, request } from './fetch.ts'

const BASE = 'https://fioapi.fio.cz/v1/rest'

/** Fio allows one request per token every 30 seconds. */
export const FIO_MIN_INTERVAL_MS = 30_000

type FioColumn = { value: string | number | null } | null

export type FioAccountInfo = {
  accountId: string | null
  bankId: string | null
  iban: string | null
  currency: string | null
}

export type FioStatement = { info: FioAccountInfo; transactions: ParsedTransaction[] }

const str = (c: FioColumn | undefined): string | null => {
  const v = c?.value
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

/** Maps Fio's `transactions.json` payload (columnN objects) onto bank-neutral transactions. */
export function parseFioJson(body: unknown): FioStatement {
  const stmt = (body as { accountStatement?: Record<string, unknown> } | null)?.accountStatement
  if (!stmt || typeof stmt !== 'object') {
    throw new IntegrationError('Unexpected response from Fio', 'bad_response')
  }
  const info = (stmt.info ?? {}) as Record<string, unknown>
  const text = (v: unknown) => (v === null || v === undefined ? null : String(v))
  const rows = ((stmt.transactionList as { transaction?: unknown[] } | null)?.transaction ??
    []) as Array<Record<string, FioColumn>>
  const transactions: ParsedTransaction[] = []
  for (const row of rows) {
    const amount = parseBankAmount(String(row.column1?.value ?? ''), 'dot')
    const bookedOn = parseBankDate(str(row.column0) ?? '')
    const currency = str(row.column14)?.toUpperCase()
    const id = str(row.column22)
    if (!amount || !bookedOn || !currency || !id) continue
    const bank = str(row.column3)
    transactions.push({
      bookedOn,
      amount,
      currency,
      variableSymbol: cleanSymbol(str(row.column5)),
      constantSymbol: cleanSymbol(str(row.column4)),
      specificSymbol: cleanSymbol(str(row.column6)),
      counterpartyAccount: joinAccount(str(row.column2), bank),
      counterpartyName: str(row.column10) ?? str(row.column7),
      message: str(row.column16) ?? str(row.column7) ?? str(row.column25),
      externalId: id,
    })
  }
  return {
    info: {
      accountId: text(info.accountId),
      bankId: text(info.bankId),
      iban: text(info.iban),
      currency: text(info.currency),
    },
    transactions,
  }
}

/**
 * Downloads booked transactions for a period (`from`/`to` = YYYY-MM-DD) with a read-only token.
 * The token is part of the URL by Fio's design, so it is never put into an error message.
 */
export async function fetchFioTransactions(
  token: string,
  from: string,
  to: string,
  opts: ClientOptions = {},
): Promise<FioStatement> {
  if (!/^[A-Za-z0-9]{20,100}$/.test(token)) {
    throw new IntegrationError('The Fio token has an invalid format', 'invalid_input')
  }
  let res: Response
  try {
    res = await request(
      `${BASE}/periods/${token}/${from}/${to}/transactions.json`,
      { headers: { accept: 'application/json' } },
      { timeoutMs: 20_000, ...opts },
    )
  } catch {
    // Transport errors can echo the URL (and with it the token); say nothing about the cause.
    throw new IntegrationError('Could not reach Fio', 'unavailable')
  }
  switch (res.status) {
    case 200:
      break
    case 409:
      throw new IntegrationError('Fio allows one request per 30 seconds', 'http_error', 409)
    case 500:
      throw new IntegrationError('Fio rejected the token (invalid or expired)', 'http_error', 500)
    case 422:
      throw new IntegrationError(
        'Fio refused the period (older than 90 days needs authorization in Fio internet banking)',
        'http_error',
        422,
      )
    default:
      throw new IntegrationError(`Fio responded with HTTP ${res.status}`, 'http_error', res.status)
  }
  let body: unknown
  try {
    body = await res.json()
  } catch {
    throw new IntegrationError('Fio returned an unreadable response', 'bad_response')
  }
  return parseFioJson(body)
}
