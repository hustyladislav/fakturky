/** Currencies offered first (the ones Czech freelancers invoice in), then everything else alphabetically. */
const COMMON = ['CZK', 'EUR', 'USD', 'GBP', 'PLN', 'CHF'] as const

/** Fallback for runtimes without Intl.supportedValuesOf (older browsers). */
const FALLBACK = [
  'AUD',
  'BGN',
  'CAD',
  'CNY',
  'DKK',
  'HUF',
  'JPY',
  'NOK',
  'RON',
  'SEK',
  'TRY',
  'UAH',
] as const

function allCodes(): string[] {
  try {
    const list = (
      Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
    ).supportedValuesOf?.('currency')
    if (list?.length) return list
  } catch {
    // fall through to the static list
  }
  return [...FALLBACK]
}

/** ISO 4217 codes: CZK, EUR, USD, GBP, PLN, CHF first, then the rest alphabetically. */
export const CURRENCY_CODES: readonly string[] = [
  ...COMMON,
  ...allCodes()
    .filter((c) => !(COMMON as readonly string[]).includes(c))
    .sort(),
]

export const COMMON_CURRENCIES: readonly string[] = COMMON

const names = (() => {
  try {
    return new Intl.DisplayNames(['cs'], { type: 'currency' })
  } catch {
    return null
  }
})()

/** "CZK · česká koruna" */
export function currencyLabel(code: string): string {
  const name = names?.of(code)
  return name && name !== code ? `${code} · ${name}` : code
}
