import { useEffect, useMemo, useState } from 'react'
import { type InvoiceSheetInput, resolveSheetInput } from '../model.ts'
import { buildInvoiceQr } from '../qr.ts'
import type { QrData } from '../types.ts'

/**
 * Builds the payment QR (QR Platba for CZK, EPC for EUR) in the browser. Works on partial drafts: anything the
 * payload builders reject (incomplete IBAN, no amount yet) simply yields `null`. Recomputed only when a field
 * that ends up in the payload changes, not on every keystroke elsewhere.
 */
export function useInvoiceQr(doc: InvoiceSheetInput, enabled = true): QrData | null {
  const resolved = useMemo(() => resolveSheetInput(doc).doc, [doc])
  const pay = resolved.payment
  const acct = pay?.bankAccount
  const key = enabled
    ? JSON.stringify([
        resolved.totals.total,
        resolved.paidDeposits ?? 0,
        resolved.currency,
        resolved.supplier.name,
        resolved.number,
        pay?.method,
        pay?.dueDate,
        pay?.variableSymbol,
        pay?.constantSymbol,
        pay?.specificSymbol,
        acct?.iban,
        acct?.bic,
      ])
    : null
  const [qr, setQr] = useState<{ key: string; data: QrData | null } | null>(null)

  useEffect(() => {
    if (key === null) return
    let cancelled = false
    buildInvoiceQr(resolved)
      .then((data) => {
        if (!cancelled) setQr({ key, data })
      })
      .catch(() => {
        if (!cancelled) setQr({ key, data: null })
      })
    return () => {
      cancelled = true
    }
  }, [key])

  return key !== null && qr?.key === key ? qr.data : null
}
