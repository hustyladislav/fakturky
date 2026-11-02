import { Decimal } from '../money.ts'

/**
 * Decodes an uploaded statement: UTF-8 (BOM allowed) when valid, otherwise Windows-1250, which is what
 * KB, ČSOB, Raiffeisen and most ABO/GPC exports use.
 */
export function decodeBankFile(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, '')
  } catch {
    return new TextDecoder('windows-1250').decode(bytes)
  }
}

export function isRealDate(y: number, m: number, d: number): boolean {
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0')

/** Accepts 05.01.2026, 5. 1. 2026, 2026-01-05, 2026-01-05T10:00:00+0100, 05/01/2026, 05.01.2026 10:22. Returns YYYY-MM-DD or null. */
export function parseBankDate(raw: string): string | null {
  const s = raw.trim()
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s+].*)?$/.exec(s)
  if (m) return ymd(Number(m[1]), Number(m[2]), Number(m[3]))
  m = /^(\d{1,2})\s*[./]\s*(\d{1,2})\s*[./]\s*(\d{4})(?:[,\s].*)?$/.exec(s)
  if (m) return ymd(Number(m[3]), Number(m[2]), Number(m[1]))
  // English month names (Revolut Business): "Jan 10, 2026" / "10 Jan 2026"
  m = /^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/.exec(s)
  if (m) return ymd(Number(m[3]), monthIndex(m[1] as string), Number(m[2]))
  m = /^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?,?\s+(\d{4})/.exec(s)
  if (m) return ymd(Number(m[3]), monthIndex(m[2] as string), Number(m[1]))
  return null
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const monthIndex = (abbr: string) => MONTHS.indexOf(abbr.toLowerCase()) + 1

function ymd(y: number, m: number, d: number): string | null {
  return isRealDate(y, m, d) ? `${pad(y, 4)}-${pad(m)}-${pad(d)}` : null
}

/** Two-digit-year ABO date (DDMMYY). */
export function parseShortDate(ddmmyy: string): string | null {
  const m = /^(\d{2})(\d{2})(\d{2})$/.exec(ddmmyy)
  if (!m) return null
  const yy = Number(m[3])
  return ymd(yy < 70 ? 2000 + yy : 1900 + yy, Number(m[2]), Number(m[1]))
}

/**
 * Parses "1 210,00", "-1.210,50", "1,210.50", "+500", "(120.00)" into a signed decimal string.
 * With both separators the last one is the decimal mark; a lone comma is a decimal comma.
 */
export function parseBankAmount(raw: string, decimal: 'auto' | 'comma' | 'dot' = 'auto'): string | null {
  let s = raw.replace(/[\s  ]/g, '').replace(/[A-Za-z]{3}$/, '')
  if (s === '') return null
  let negative = false
  if (/^\(.*\)$/.test(s)) {
    negative = true
    s = s.slice(1, -1)
  }
  if (s.startsWith('-') || s.startsWith('−')) {
    negative = !negative
    s = s.slice(1)
  } else if (s.startsWith('+')) {
    s = s.slice(1)
  }
  if (!/^[\d.,]+$/.test(s)) return null
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  let decimalMark: ',' | '.' | null
  if (decimal === 'comma') decimalMark = ','
  else if (decimal === 'dot') decimalMark = '.'
  else if (lastComma >= 0 && lastDot >= 0) decimalMark = lastComma > lastDot ? ',' : '.'
  else if (lastComma >= 0) decimalMark = ','
  else if (lastDot >= 0) decimalMark = '.'
  else decimalMark = null
  let normalized = s
  if (decimalMark) {
    const thousands = decimalMark === ',' ? /\./g : /,/g
    normalized = s.replace(thousands, '')
    if (decimalMark === ',') normalized = normalized.replace(',', '.')
    if ((normalized.match(/\./g) ?? []).length > 1) return null
  }
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null
  const d = new Decimal(normalized)
  const out = (negative ? d.negated() : d).toFixed(2)
  return out === '-0.00' ? '0.00' : out
}

/** Digits only, no leading zeros, max 10 digits; anything else is not a usable symbol. */
export function cleanSymbol(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.trim().replace(/^0+(?=\d)/, '')
  if (!/^\d{1,10}$/.test(digits)) return null
  return /^0+$/.test(digits) ? null : digits
}

export const blankToNull = (v: string | null | undefined): string | null => {
  const t = v?.replace(/\s+/g, ' ').trim()
  return t ? t : null
}

/** Joins "account" and "bank code" columns into "account/bank" unless the account already has a bank or is an IBAN. */
export function joinAccount(account: string | null, bank: string | null): string | null {
  const a = blankToNull(account)
  if (!a) return null
  const b = blankToNull(bank)
  if (!b || a.includes('/') || /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(a.replace(/\s/g, ''))) return a
  return `${a}/${b.replace(/^0+(?=\d)/, '').padStart(4, '0')}`
}

/** Strips leading zeros from a 16-char ABO account ("000000" prefix + 10-digit number). */
export function aboAccount(raw16: string): string | null {
  const s = raw16.padStart(16, '0')
  const prefix = s.slice(0, 6).replace(/^0+/, '')
  const number = s.slice(6).replace(/^0+/, '')
  if (!number) return null
  return prefix ? `${prefix}-${number}` : number
}

export function normalizeHeader(h: string): string {
  return h
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}
