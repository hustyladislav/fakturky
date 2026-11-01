import { toFixed, parseDecimal, type MoneyInput } from '../money.ts'
import { normalizeIban } from '../iban.ts'

export interface EpcOptions {
  /** Beneficiary name, max 70 chars. */
  name: string
  iban: string
  bic?: string
  /** EUR amount, 0.01 – 999 999 999.99. Omit for an amount-less code. */
  amount?: MoneyInput
  /** Structured creditor reference (ISO 11649) – mutually exclusive with `remittance`. */
  reference?: string
  /** Unstructured remittance text, max 140 chars. */
  remittance?: string
}

/** Builds an EPC069-12 (SEPA credit transfer) QR payload, version 002, UTF-8. */
export function buildEpc(opts: EpcOptions): string {
  if (opts.reference && opts.remittance) throw new Error('Use either reference or remittance, not both')
  let amount = ''
  if (opts.amount !== undefined) {
    const a = parseDecimal(opts.amount)
    if (a.lte(0) || a.gt('999999999.99')) throw new Error('EPC amount out of range')
    amount = `EUR${toFixed(a)}`
  }
  return [
    'BCD',
    '002',
    '1',
    'SCT',
    opts.bic?.toUpperCase() ?? '',
    opts.name.slice(0, 70),
    normalizeIban(opts.iban),
    amount,
    '',
    opts.reference ?? '',
    (opts.remittance ?? '').slice(0, 140),
  ]
    .join('\n')
}
