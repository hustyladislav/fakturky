import { cs } from '@/i18n/cs'

const e = cs.bank.errors

/** Czech text for a bank-related API error (the server speaks English, the UI never shows it raw). */
export function bankErrorMessage(err: unknown): string {
  const message = (err as Error)?.message ?? ''
  const code = (err as { code?: string })?.code
  if (/different bank account/i.test(message)) {
    return /token/i.test(message) ? e.fioOther : e.otherAccount
  }
  if (code === 'TOO_MANY_REQUESTS' || /one request per 30 seconds/i.test(message))
    return e.rateLimit
  if (/Fio rejected the token|token has an invalid/i.test(message)) return e.fioToken
  if (/currency/i.test(message)) return e.currency
  if (code === 'CONFLICT' || code === 'NOT_FOUND') return e.conflict
  if (code === 'BAD_REQUEST') return e.unreadable
  return e.generic
}

/** The server asks for a manual column mapping when it cannot find a date and an amount column. */
export const needsMapping = (err: unknown) =>
  /Map the columns manually/i.test((err as Error)?.message ?? '')
