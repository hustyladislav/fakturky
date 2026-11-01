import { isValidIco } from './ico.ts'

export const EU_VAT_PREFIXES = [
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'EL', 'ES', 'FI', 'FR', 'HR', 'HU', 'IE',
  'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK', 'XI',
] as const

/** Format-only patterns of EU VAT IDs (no checksum), without the country prefix. */
const EU_FORMATS: Record<string, RegExp> = {
  AT: /^U\d{8}$/,
  BE: /^[01]\d{9}$/,
  BG: /^\d{9,10}$/,
  CY: /^\d{8}[A-Z]$/,
  CZ: /^\d{8,10}$/,
  DE: /^\d{9}$/,
  DK: /^\d{8}$/,
  EE: /^\d{9}$/,
  EL: /^\d{9}$/,
  ES: /^[A-Z0-9]\d{7}[A-Z0-9]$/,
  FI: /^\d{8}$/,
  FR: /^[A-Z0-9]{2}\d{9}$/,
  HR: /^\d{11}$/,
  HU: /^\d{8}$/,
  IE: /^(\d{7}[A-Z]{1,2}|\d[A-Z+*]\d{5}[A-Z])$/,
  IT: /^\d{11}$/,
  LT: /^(\d{9}|\d{12})$/,
  LU: /^\d{8}$/,
  LV: /^\d{11}$/,
  MT: /^\d{8}$/,
  NL: /^\d{9}B\d{2}$/,
  PL: /^\d{10}$/,
  PT: /^\d{9}$/,
  RO: /^\d{2,10}$/,
  SE: /^\d{12}$/,
  SI: /^\d{8}$/,
  SK: /^\d{10}$/,
  XI: /^(\d{9}|\d{12}|GD\d{3}|HA\d{3})$/,
}

export function normalizeVatId(value: string): string {
  return value.replace(/[\s.-]/g, '').toUpperCase()
}

export interface ParsedVatId {
  countryCode: string
  number: string
}

/** Splits a VAT ID into country prefix and number; null when the prefix is not an EU one. */
export function parseVatId(value: string): ParsedVatId | null {
  const v = normalizeVatId(value)
  const countryCode = v.slice(0, 2)
  if (!(EU_VAT_PREFIXES as readonly string[]).includes(countryCode)) return null
  return { countryCode, number: v.slice(2) }
}

/** Czech DIČ: `CZ` + 8 digits (legal entity, IČO), 9–10 digits (natural person: rodné číslo or special). */
export function isValidCzDic(value: string): boolean {
  const v = normalizeVatId(value)
  if (!/^CZ\d{8,10}$/.test(v)) return false
  const digits = v.slice(2)
  // Legal entities: 8 digits that equal a valid IČO (starting with 0–6).
  if (digits.length === 8) return isValidIco(digits)
  return true
}

/** Slovak IČ DPH: `SK` + 10 digits, divisible by 11, first digit non-zero, third digit in 2,3,4,7,8,9. */
export function isValidSkVatId(value: string): boolean {
  const v = normalizeVatId(value)
  if (!/^SK[1-9]\d{9}$/.test(v)) return false
  const digits = v.slice(2)
  if (!['2', '3', '4', '7', '8', '9'].includes(digits[2] ?? '')) return false
  return BigInt(digits) % 11n === 0n
}

/** Format validation for any EU VAT ID (checksum only for CZ legal entities and SK). */
export function isValidEuVatId(value: string): boolean {
  const parsed = parseVatId(value)
  if (!parsed) return false
  if (parsed.countryCode === 'CZ') return isValidCzDic(value)
  if (parsed.countryCode === 'SK') return isValidSkVatId(value)
  return EU_FORMATS[parsed.countryCode]?.test(parsed.number) ?? false
}
