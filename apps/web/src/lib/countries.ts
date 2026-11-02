/** ISO 3166-1 alpha-2 codes offered for contacts: Czechia first, then the EU, then common non-EU countries. */
export const EU_COUNTRIES = [
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
] as const

const OTHER = ['GB', 'CH', 'NO', 'US', 'UA', 'CN', 'IN', 'JP', 'CA', 'AU', 'TR', 'AE'] as const

const names = new Intl.DisplayNames(['cs'], { type: 'region' })

export const countryLabel = (code: string) => {
  try {
    return names.of(code) ?? code
  } catch {
    return code
  }
}

const byName = (a: string, b: string) => countryLabel(a).localeCompare(countryLabel(b), 'cs')

export const COUNTRY_OPTIONS: string[] = [
  'CZ',
  ...[...EU_COUNTRIES].sort(byName),
  ...[...OTHER].sort(byName),
]
