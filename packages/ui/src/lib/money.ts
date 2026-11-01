const NBSP = ' '

export interface MoneyParts {
  negative: boolean
  integer: string
  fraction: string
  currency: string
}

/**
 * Splits a decimal string (never a JS number) into Czech-formatted parts:
 * integer grouped with non-breaking spaces, fraction always two digits.
 */
export function moneyParts(amount: string, currency = 'CZK'): MoneyParts {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(amount.trim())
  if (!match) throw new Error(`Invalid decimal amount: ${amount}`)
  const [, sign, int = '0', frac = ''] = match
  return {
    negative: sign === '-',
    integer: int.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP),
    fraction: frac.padEnd(2, '0').slice(0, 2),
    currency: currency === 'CZK' ? 'Kč' : currency,
  }
}

/** `148 500,00 Kč` with non-breaking spaces. */
export function formatMoney(amount: string, currency = 'CZK'): string {
  const p = moneyParts(amount, currency)
  return `${p.negative ? '−' : ''}${p.integer},${p.fraction}${NBSP}${p.currency}`
}
