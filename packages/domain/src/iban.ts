export function normalizeIban(value: string): string {
  return value.replace(/\s/g, '').toUpperCase()
}

/** ISO 13616 mod-97 over the rearranged string, done in chunks to avoid BigInt for speed/portability. */
function mod97(numeric: string): number {
  let rem = 0
  for (const ch of numeric) rem = (rem * 10 + Number(ch)) % 97
  return rem
}

function toNumeric(s: string): string {
  let out = ''
  for (const ch of s) {
    const c = ch.charCodeAt(0)
    out += c >= 65 && c <= 90 ? String(c - 55) : ch
  }
  return out
}

const IBAN_LENGTHS: Record<string, number> = {
  CZ: 24, SK: 24, DE: 22, AT: 20, PL: 28, GB: 22, FR: 27, ES: 24, IT: 27, NL: 18, BE: 16,
  LT: 20, LV: 21, EE: 20, HU: 28, CH: 21, LU: 20, IE: 22, PT: 25, SI: 19, HR: 21, BG: 22,
  RO: 24, DK: 18, SE: 24, FI: 18, NO: 15, GR: 27, CY: 28, MT: 31, LI: 21,
}

export function isValidIban(value: string): boolean {
  const iban = normalizeIban(value)
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false
  const expected = IBAN_LENGTHS[iban.slice(0, 2)]
  if (expected !== undefined && iban.length !== expected) return false
  return mod97(toNumeric(iban.slice(4) + iban.slice(0, 4))) === 1
}

/** Computes the 2-digit check string for a country code and BBAN. */
export function ibanCheckDigits(countryCode: string, bban: string): string {
  const rem = mod97(toNumeric(`${bban}${countryCode}00`.toUpperCase()))
  return String(98 - rem).padStart(2, '0')
}

/** Groups in blocks of four: `CZ65 0800 0000 1920 0014 5399`. */
export function formatIban(value: string): string {
  return normalizeIban(value).replace(/(.{4})(?=.)/g, '$1 ')
}

export interface CzechAccountParts {
  prefix: string
  number: string
  bankCode: string
}

/** Extracts the domestic account from a CZ IBAN (prefix `''` when zero). Null for non-CZ / invalid IBANs. */
export function czechAccountFromIban(value: string): CzechAccountParts | null {
  const iban = normalizeIban(value)
  if (!iban.startsWith('CZ') || !isValidIban(iban)) return null
  const bankCode = iban.slice(4, 8)
  const prefix = iban.slice(8, 14).replace(/^0+/, '')
  const number = iban.slice(14, 24).replace(/^0+/, '') || '0'
  return { prefix, number, bankCode }
}
