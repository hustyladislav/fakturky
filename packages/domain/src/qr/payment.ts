import type { ExportPayment } from '../isdoc.ts'
import { type MoneyInput, parseDecimal, toFixed } from '../money.ts'
import { buildEpc } from './epc.ts'
import { renderQrSvg } from './render.ts'
import { buildSpayd } from './spayd.ts'

export type PaymentQrKind = 'spayd' | 'epc'

export interface PaymentQrInput {
  /** Document number; goes into the payment message. */
  number: string
  currency: string
  supplierName: string
  payment?: ExportPayment | null
  /** Document total (with VAT). */
  total: MoneyInput
  /** Payments and advances already received; subtracted from the total. */
  paid?: MoneyInput
  /** When given, only `issued` documents are payable (paid, cancelled and draft documents get no QR). */
  status?: 'draft' | 'issued' | 'paid' | 'cancelled'
}

export interface PaymentQrPayload {
  kind: PaymentQrKind
  /** The text encoded in the QR code. */
  payload: string
  /** Amount still due, 2 decimals. */
  amountDue: string
}

/** Vector form of a rendered QR: SVG path data of the dark modules (stroke 1) in a `viewBox` x `viewBox` grid, no quiet zone. */
export interface PaymentQrGraphic {
  kind: PaymentQrKind
  viewBox: number
  path: string
}

/** Total minus payments and advances, 2 decimals (negative for an overpaid document). */
export function amountDue(total: MoneyInput, paid: MoneyInput = 0): string {
  return toFixed(parseDecimal(total).minus(parseDecimal(paid)), 2)
}

/**
 * The QR payload for the amount still due: QR Platba (SPAYD) for CZK, EPC for EUR.
 * `null` for other currencies, non-bank-transfer payments, a missing account, nothing left to pay or an unpayable status.
 */
export function buildPaymentQrPayload(doc: PaymentQrInput): PaymentQrPayload | null {
  const pay = doc.payment
  const account = pay?.bankAccount
  if (!pay || !account || pay.method !== 'bank_transfer') return null
  if (account.showQr === false) return null
  if (doc.status && doc.status !== 'issued') return null
  const due = parseDecimal(amountDue(doc.total, doc.paid))
  if (due.lte(0)) return null
  const currency = doc.currency.toUpperCase()
  if (currency === 'CZK') {
    return {
      kind: 'spayd',
      amountDue: toFixed(due, 2),
      payload: buildSpayd({
        iban: account.iban,
        ...(account.bic ? { bic: account.bic } : {}),
        amount: due,
        currency,
        recipientName: doc.supplierName,
        ...(pay.variableSymbol ? { variableSymbol: pay.variableSymbol } : {}),
        ...(pay.constantSymbol ? { constantSymbol: pay.constantSymbol } : {}),
        ...(pay.specificSymbol ? { specificSymbol: pay.specificSymbol } : {}),
        dueDate: pay.dueDate,
        message: doc.number,
      }),
    }
  }
  if (currency === 'EUR') {
    return {
      kind: 'epc',
      amountDue: toFixed(due, 2),
      payload: buildEpc({
        name: doc.supplierName,
        iban: account.iban,
        ...(account.bic ? { bic: account.bic } : {}),
        amount: due,
        remittance: pay.variableSymbol ? `VS ${pay.variableSymbol} ${doc.number}` : doc.number,
      }),
    }
  }
  return null
}

/** Extracts the grid size and the dark-module path from `qrcode`'s SVG output (rendered with margin 0). */
export function parseQrSvg(svg: string): { viewBox: number; path: string } {
  const viewBox = /viewBox="0 0 (\d+) \d+"/.exec(svg)?.[1]
  const path =
    /<path[^>]*stroke="[^"]*"[^>]*\sd="([^"]+)"/.exec(svg)?.[1] ??
    /<path[^>]*\sd="([^"]+)"[^>]*stroke=/.exec(svg)?.[1]
  if (!viewBox || !path) throw new Error('Unexpected QR SVG output')
  return { viewBox: Number(viewBox), path }
}

/** The payment QR as vector data for the web page (SVG) and the PDF; same rules as `buildPaymentQrPayload`. */
export async function renderPaymentQr(doc: PaymentQrInput): Promise<PaymentQrGraphic | null> {
  const qr = buildPaymentQrPayload(doc)
  if (!qr) return null
  return { kind: qr.kind, ...parseQrSvg(await renderQrSvg(qr.payload, { margin: 0 })) }
}
