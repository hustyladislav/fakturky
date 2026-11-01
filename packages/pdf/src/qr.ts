import { buildEpc, buildSpayd, parseDecimal, renderQrSvg } from '@fakturky/domain'
import type { InvoicePdfInput, QrData } from './types.ts'

export function amountDue(doc: InvoicePdfInput): string {
  return parseDecimal(doc.totals.total)
    .minus(parseDecimal(doc.paidDeposits ?? 0))
    .toFixed(2)
}

/** QR Platba for CZK, EPC for EUR; nothing for other currencies, non-transfers or non-positive amounts. */
export async function buildInvoiceQr(doc: InvoicePdfInput): Promise<QrData | null> {
  const pay = doc.payment
  const account = pay?.bankAccount
  if (!pay || !account || pay.method !== 'bank_transfer') return null
  const due = parseDecimal(amountDue(doc))
  if (due.lte(0)) return null
  const currency = doc.currency.toUpperCase()
  let payload: string
  let kind: QrData['kind']
  if (currency === 'CZK') {
    kind = 'spayd'
    payload = buildSpayd({
      iban: account.iban,
      ...(account.bic ? { bic: account.bic } : {}),
      amount: due,
      currency,
      recipientName: doc.supplier.name,
      ...(pay.variableSymbol ? { variableSymbol: pay.variableSymbol } : {}),
      ...(pay.constantSymbol ? { constantSymbol: pay.constantSymbol } : {}),
      ...(pay.specificSymbol ? { specificSymbol: pay.specificSymbol } : {}),
      dueDate: pay.dueDate,
      message: doc.number,
    })
  } else if (currency === 'EUR') {
    kind = 'epc'
    payload = buildEpc({
      name: doc.supplier.name,
      iban: account.iban,
      ...(account.bic ? { bic: account.bic } : {}),
      amount: due,
      remittance: pay.variableSymbol ? `VS ${pay.variableSymbol} ${doc.number}` : doc.number,
    })
  } else {
    return null
  }
  const svg = await renderQrSvg(payload, { margin: 0 })
  const viewBox = /viewBox="0 0 (\d+) \d+"/.exec(svg)?.[1]
  const path =
    /<path[^>]*stroke="[^"]*"[^>]*\sd="([^"]+)"/.exec(svg)?.[1] ??
    /<path[^>]*\sd="([^"]+)"[^>]*stroke=/.exec(svg)?.[1]
  if (!viewBox || !path) throw new Error('Unexpected QR SVG output')
  return { kind, viewBox: Number(viewBox), path }
}
