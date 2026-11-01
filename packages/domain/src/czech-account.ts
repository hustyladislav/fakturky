import { ibanCheckDigits } from './iban.ts'

export interface CzechAccount {
  /** Without leading zeros; empty when absent. */
  prefix: string
  /** Without leading zeros. */
  number: string
  /** 4 digits. */
  bankCode: string
}

const PREFIX_WEIGHTS = [10, 5, 8, 4, 2, 1]
const NUMBER_WEIGHTS = [6, 3, 7, 9, 10, 5, 8, 4, 2, 1]

/** Parses `[prefix-]number/bank`. Returns null on bad syntax; does not check the mod-11. */
export function parseCzechAccount(value: string): CzechAccount | null {
  const m = /^\s*(?:(\d{1,6})-)?(\d{2,10})\s*\/\s*(\d{4})\s*$/.exec(value)
  if (!m) return null
  return { prefix: (m[1] ?? '').replace(/^0+/, ''), number: m[2] as string, bankCode: m[3] as string }
}

function mod11Ok(digits: string, weights: number[]): boolean {
  const padded = digits.padStart(weights.length, '0')
  let sum = 0
  for (let i = 0; i < weights.length; i++) sum += Number(padded[i]) * (weights[i] as number)
  return sum % 11 === 0
}

/** Weighted mod-11 check of prefix and number (decreed by ČNB). */
export function isValidCzechAccountNumber(acc: Pick<CzechAccount, 'prefix' | 'number'>): boolean {
  if (acc.number.length > 10 || acc.prefix.length > 6) return false
  if (!/^\d*$/.test(acc.prefix) || !/^\d+$/.test(acc.number)) return false
  if (Number(acc.number) === 0) return false
  return (acc.prefix === '' || mod11Ok(acc.prefix, PREFIX_WEIGHTS)) && mod11Ok(acc.number, NUMBER_WEIGHTS)
}

export function isValidCzechAccount(value: string): boolean {
  const acc = parseCzechAccount(value)
  return acc !== null && isValidCzechAccountNumber(acc)
}

export function formatCzechAccount(acc: CzechAccount): string {
  return `${acc.prefix ? `${acc.prefix}-` : ''}${acc.number}/${acc.bankCode}`
}

/** `CZ` + check + bank(4) + prefix(6) + number(10). Throws on invalid input. */
export function czechAccountToIban(input: string | CzechAccount): string {
  const acc = typeof input === 'string' ? parseCzechAccount(input) : input
  if (!acc || !isValidCzechAccountNumber(acc)) throw new Error('Invalid Czech bank account')
  const bban = `${acc.bankCode}${acc.prefix.padStart(6, '0')}${acc.number.padStart(10, '0')}`
  return `CZ${ibanCheckDigits('CZ', bban)}${bban}`
}
