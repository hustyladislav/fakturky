import {
  buildEpc,
  buildSpayd,
  type Decimal,
  type DocumentForExport,
  renderQrSvg,
} from '@fakturky/domain'

/** QR Platba (CZK) / EPC (EUR) for the amount still due; same rules as the PDF payment block. */
export async function buildPublicQr(doc: DocumentForExport, due: Decimal) {
  const pay = doc.payment
  const account = pay?.bankAccount
  if (!pay || !account || pay.method !== 'bank_transfer' || due.lte(0)) return null
  const currency = doc.currency.toUpperCase()
  let payload: string
  let kind: 'spayd' | 'epc'
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
  if (!viewBox || !path) return null
  return { kind, viewBox: Number(viewBox), path }
}
