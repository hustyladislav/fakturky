import Decimal from 'decimal.js-light'

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP })

export { Decimal }

export type MoneyInput = Decimal | string | number

/** Parses a decimal string (dot or comma separator, spaces allowed). Throws on garbage. */
export function parseDecimal(value: MoneyInput): Decimal {
  if (value instanceof Decimal) return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`Invalid decimal: ${value}`)
    return new Decimal(value)
  }
  const normalized = value.replace(/[\s  ]/g, '').replace(',', '.')
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(normalized)) {
    throw new Error(`Invalid decimal: ${JSON.stringify(value)}`)
  }
  return new Decimal(normalized)
}

export function isDecimalString(value: string): boolean {
  try {
    parseDecimal(value)
    return true
  } catch {
    return false
  }
}

/** Rounds half away from zero to `dp` places (commercial rounding). */
export function round(value: MoneyInput, dp = 2): Decimal {
  return parseDecimal(value).toDecimalPlaces(dp, Decimal.ROUND_HALF_UP)
}

/** Fixed-point string with `dp` decimals, dot separator. Suitable for DB `numeric`. */
export function toFixed(value: MoneyInput, dp = 2): string {
  const r = round(value, dp)
  return r.isZero() ? (0).toFixed(dp) : r.toFixed(dp)
}

export function sum(values: readonly MoneyInput[]): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(parseDecimal(v)), new Decimal(0))
}

const NBSP = ' '

/** Grouping/decimal separators per supported locale. */
const LOCALES = {
  cs: { group: NBSP, decimal: ',' },
  sk: { group: NBSP, decimal: ',' },
  en: { group: ',', decimal: '.' },
} as const

export type MoneyLocale = keyof typeof LOCALES

const SYMBOLS: Record<string, string> = {
  CZK: 'Kč',
  EUR: '€',
  USD: '$',
  GBP: '£',
  PLN: 'zł',
}

function groupDigits(int: string, sep: string): string {
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, sep)
}

/** Formats a number with locale separators, no currency. */
export function formatNumber(value: MoneyInput, dp = 2, locale: MoneyLocale = 'cs'): string {
  const { group, decimal } = LOCALES[locale]
  const r = round(value, dp)
  const negative = r.isNegative() && !r.isZero()
  const [int = '0', frac] = r.abs().toFixed(dp).split('.')
  const body = groupDigits(int, group) + (frac ? decimal + frac : '')
  return negative ? `-${body}` : body
}

/**
 * Formats an amount with currency. cs/sk: `1 234,50 Kč` (suffix, NBSP); en: `€1,234.50` for known
 * symbols, otherwise `1,234.50 CHF`.
 */
export function formatMoney(
  amount: MoneyInput,
  currency: string,
  locale: MoneyLocale = 'cs',
): string {
  const code = currency.toUpperCase()
  const n = formatNumber(amount, 2, locale)
  if (locale === 'en') {
    const symbol = SYMBOLS[code]
    if (symbol && code !== 'CZK' && code !== 'PLN') {
      return n.startsWith('-') ? `-${symbol}${n.slice(1)}` : `${symbol}${n}`
    }
    return `${n}${NBSP}${symbol ?? code}`
  }
  return `${n}${NBSP}${SYMBOLS[code] ?? code}`
}

export function formatCzk(amount: MoneyInput): string {
  return formatMoney(amount, 'CZK', 'cs')
}
