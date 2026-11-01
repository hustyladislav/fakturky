const NBSP = ' '

/** Commercial rounding (half away from zero on the magnitude) to 2 decimals, on digit strings. */
function roundHalfUp(int: string, frac: string): [string, string] {
  const padded = frac.padEnd(2, '0')
  let digits = int + padded.slice(0, 2)
  if (padded.charCodeAt(2) >= 53) {
    // carry +1 through the digit string
    const arr = digits.split('')
    let i = arr.length - 1
    while (i >= 0) {
      if (arr[i] === '9') {
        arr[i] = '0'
        i--
      } else {
        arr[i] = String(Number(arr[i]) + 1)
        break
      }
    }
    digits = (i < 0 ? '1' : '') + arr.join('')
  }
  return [digits.slice(0, -2).replace(/^0+(?=\d)/, '') || '0', digits.slice(-2)]
}

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
  const [rInt, rFrac] = roundHalfUp(int, frac)
  return {
    negative: sign === '-' && /[1-9]/.test(rInt + rFrac),
    integer: rInt.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP),
    fraction: rFrac,
    currency: currency === 'CZK' ? 'Kč' : currency,
  }
}

/** `148 500,00 Kč` with non-breaking spaces. */
export function formatMoney(amount: string, currency = 'CZK'): string {
  const p = moneyParts(amount, currency)
  return `${p.negative ? '−' : ''}${p.integer},${p.fraction}${NBSP}${p.currency}`
}
