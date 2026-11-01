import { toFixed, type MoneyInput } from '../money.ts'
import { normalizeIban } from '../iban.ts'

export interface SpaydOptions {
  iban: string
  bic?: string
  amount?: MoneyInput
  currency?: string
  variableSymbol?: string
  constantSymbol?: string
  specificSymbol?: string
  /** Due date as ISO `YYYY-MM-DD`. */
  dueDate?: string
  /** Message for the recipient, max 60 chars. */
  message?: string
  /** Recipient name, max 35 chars. */
  recipientName?: string
  /** Embedded QR Faktura (SID) payload, URL-encoded into `X-INV`. */
  invoice?: SpaydInvoice
}

export interface SpaydInvoice {
  /** Document number (ID). */
  id: string
  /** Issue date `YYYY-MM-DD`. */
  issueDate: string
  /** Supplier IČO (INR). */
  supplierIco?: string
  /** Supplier DIČ (VII). */
  supplierDic?: string
  /** Customer IČO (INP). */
  customerIco?: string
  /** Customer DIČ (VIR). */
  customerDic?: string
  /** DUZP `YYYY-MM-DD`. */
  duzp?: string
  /** Total with VAT. */
  total?: MoneyInput
  currency?: string
}

/** SPAYD allows only upper-case ASCII-ish text; diacritics removed, `*` escaped as `%2A`. */
export function spaydText(value: string, max: number): string {
  const ascii = value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7e]/g, '')
    .toUpperCase()
    .slice(0, max)
  return ascii.replace(/%/g, '%25').replace(/\*/g, '%2A')
}

function digitsOnly(v: string, max: number): string {
  return v.replace(/\D/g, '').slice(0, max)
}

function compactDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error(`Invalid ISO date: ${iso}`)
  return iso.replaceAll('-', '')
}

/** Builds the SID (QR Faktura) string, with `*` separators already encoded as `%2A` for `X-INV`. */
export function buildSid(inv: SpaydInvoice): string {
  const enc = (v: string) => encodeURIComponent(v).replace(/\*/g, '%2A')
  const parts = ['SID', '1.0', `ID:${enc(inv.id)}`, `DD:${compactDate(inv.issueDate)}`]
  if (inv.total !== undefined) parts.push(`AM:${toFixed(inv.total)}`)
  if (inv.currency) parts.push(`CC:${inv.currency.toUpperCase()}`)
  if (inv.duzp) parts.push(`DUZP:${compactDate(inv.duzp)}`)
  if (inv.supplierIco) parts.push(`INR:${enc(inv.supplierIco)}`)
  if (inv.supplierDic) parts.push(`VII:${enc(inv.supplierDic)}`)
  if (inv.customerIco) parts.push(`INP:${enc(inv.customerIco)}`)
  if (inv.customerDic) parts.push(`VIR:${enc(inv.customerDic)}`)
  return parts.join('%2A')
}

/** Builds a SPAYD 1.0 (QR Platba) string. Field order follows the spec examples. */
export function buildSpayd(opts: SpaydOptions): string {
  const iban = normalizeIban(opts.iban)
  const parts = ['SPD', '1.0']
  parts.push(`ACC:${opts.bic ? `${iban}+${opts.bic.toUpperCase()}` : iban}`)
  if (opts.amount !== undefined) parts.push(`AM:${toFixed(opts.amount)}`)
  parts.push(`CC:${(opts.currency ?? 'CZK').toUpperCase()}`)
  if (opts.recipientName) parts.push(`RN:${spaydText(opts.recipientName, 35)}`)
  if (opts.variableSymbol) parts.push(`X-VS:${digitsOnly(opts.variableSymbol, 10)}`)
  if (opts.specificSymbol) parts.push(`X-SS:${digitsOnly(opts.specificSymbol, 10)}`)
  if (opts.constantSymbol) parts.push(`X-KS:${digitsOnly(opts.constantSymbol, 10)}`)
  if (opts.dueDate) parts.push(`DT:${compactDate(opts.dueDate)}`)
  if (opts.message) parts.push(`MSG:${spaydText(opts.message, 60)}`)
  if (opts.invoice) parts.push(`X-INV:${buildSid(opts.invoice)}`)
  return parts.join('*')
}
