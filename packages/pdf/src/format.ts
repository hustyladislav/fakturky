import {
  Decimal,
  type DocumentLanguage,
  formatDateCs,
  formatNumber,
  type MoneyInput,
  parseDecimal,
} from '@fakturky/domain'

const EN_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

export function formatDate(iso: string, lang: DocumentLanguage): string {
  if (lang !== 'en') return formatDateCs(iso).replaceAll(' ', ' ')
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${EN_MONTHS[(m ?? 1) - 1]} ${y}`
}

/** Amount without currency, locale separators, always 2 decimals. */
export function amount(value: MoneyInput, lang: DocumentLanguage): string {
  return formatNumber(value, 2, lang)
}

/** Quantity: up to 3 decimals, trailing zeros trimmed. */
export function quantity(value: MoneyInput, lang: DocumentLanguage): string {
  const q = parseDecimal(value).toDecimalPlaces(3)
  const dp = Math.min(q.decimalPlaces(), 3)
  return formatNumber(q, dp, lang)
}

/** Exchange rate: up to 4 decimals, trailing zeros trimmed. */
export function exchangeRate(value: MoneyInput, lang: DocumentLanguage): string {
  const r = parseDecimal(value).toDecimalPlaces(4)
  return formatNumber(r, r.decimalPlaces(), lang)
}

export function percent(rate: MoneyInput): string {
  return `${new Decimal(rate).toString().replace('.', ',')} %`
}

const CURRENCY_LABEL: Record<string, string> = {
  CZK: 'Kč',
  EUR: '€',
  USD: '$',
  GBP: '£',
  PLN: 'zł',
}
export function currencyLabel(code: string): string {
  return CURRENCY_LABEL[code.toUpperCase()] ?? code.toUpperCase()
}

export function countryName(code: string | undefined, lang: DocumentLanguage): string {
  const cc = (code ?? 'CZ').toUpperCase()
  if (cc === 'CZ' && lang === 'cs') return 'Česká republika'
  if (cc === 'CZ' && lang === 'sk') return 'Česká republika'
  try {
    return new Intl.DisplayNames([lang], { type: 'region' }).of(cc) ?? cc
  } catch {
    return cc
  }
}

/** `1 234 567` style grouping for IČO-like display is not needed; IBAN gets groups of four. */
export function groupIban(iban: string): string {
  return iban
    .replace(/\s+/g, '')
    .replace(/(.{4})/g, '$1 ')
    .trim()
}
