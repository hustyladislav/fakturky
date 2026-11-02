import jsQR from 'jsqr'
import { describe, expect, it } from 'vitest'
import type { ExportPayment } from '../src/isdoc.ts'
import {
  amountDue,
  buildPaymentQrPayload,
  type PaymentQrGraphic,
  type PaymentQrInput,
  renderPaymentQr,
} from '../src/qr/payment.ts'
import { renderQrPng } from '../src/qr/png.ts'

const IBAN = 'CZ6508000000192000145399'

const payment = (over: Partial<ExportPayment> = {}): ExportPayment => ({
  method: 'bank_transfer',
  dueDate: '2026-11-15',
  variableSymbol: '20260001',
  bankAccount: { iban: IBAN, bic: 'GIBACZPX' },
  ...over,
})

const doc = (over: Partial<PaymentQrInput> = {}): PaymentQrInput => ({
  number: '2026-0001',
  currency: 'CZK',
  supplierName: 'Jan Novák',
  payment: payment(),
  total: '12100.00',
  status: 'issued',
  ...over,
})

describe('amountDue', () => {
  it('is the total minus payments and advances', () => {
    expect(amountDue('12100', '2100')).toBe('10000.00')
    expect(amountDue('12100')).toBe('12100.00')
    expect(amountDue('100', '120')).toBe('-20.00')
  })
})

describe('buildPaymentQrPayload', () => {
  it('builds a QR Platba string for CZK with VS, due date and the amount due after deposits', () => {
    const qr = buildPaymentQrPayload(doc({ paid: '2100' }))
    expect(qr).toEqual({
      kind: 'spayd',
      amountDue: '10000.00',
      payload: `SPD*1.0*ACC:${IBAN}+GIBACZPX*AM:10000.00*CC:CZK*RN:JAN NOVAK*X-VS:20260001*DT:20261115*MSG:2026-0001`,
    })
  })

  it('carries constant and specific symbols', () => {
    const qr = buildPaymentQrPayload(
      doc({ payment: payment({ constantSymbol: '0308', specificSymbol: '77' }) }),
    )
    expect(qr?.payload).toContain('*X-KS:0308')
    expect(qr?.payload).toContain('*X-SS:77')
  })

  it('builds an EPC payload for EUR', () => {
    const qr = buildPaymentQrPayload(doc({ currency: 'eur', total: '250', paid: '50' }))
    expect(qr?.kind).toBe('epc')
    expect(qr?.amountDue).toBe('200.00')
    expect(qr?.payload.split('\n')).toEqual([
      'BCD',
      '002',
      '1',
      'SCT',
      'GIBACZPX',
      'Jan Novák',
      IBAN,
      'EUR200.00',
      '',
      '',
      'VS 20260001 2026-0001',
    ])
  })

  it('is null when paid, fully covered by deposits or cancelled', () => {
    expect(buildPaymentQrPayload(doc({ status: 'paid' }))).toBeNull()
    expect(buildPaymentQrPayload(doc({ status: 'cancelled' }))).toBeNull()
    expect(buildPaymentQrPayload(doc({ status: 'draft' }))).toBeNull()
    expect(buildPaymentQrPayload(doc({ paid: '12100' }))).toBeNull()
    expect(buildPaymentQrPayload(doc({ paid: '13000' }))).toBeNull()
  })

  it('is null for other currencies, other payment methods and a missing account', () => {
    expect(buildPaymentQrPayload(doc({ currency: 'USD' }))).toBeNull()
    expect(buildPaymentQrPayload(doc({ payment: payment({ method: 'cash' }) }))).toBeNull()
    expect(buildPaymentQrPayload(doc({ payment: payment({ bankAccount: null }) }))).toBeNull()
    expect(buildPaymentQrPayload(doc({ payment: null }))).toBeNull()
  })

  it('honours the account setting that hides the QR', () => {
    const hidden = payment({ bankAccount: { iban: IBAN, showQr: false } })
    expect(buildPaymentQrPayload(doc({ payment: hidden }))).toBeNull()
    const shown = payment({ bankAccount: { iban: IBAN, showQr: true } })
    expect(buildPaymentQrPayload(doc({ payment: shown }))?.kind).toBe('spayd')
  })

  it('works without a status (PDF input)', () => {
    expect(buildPaymentQrPayload(doc({ status: undefined }))?.kind).toBe('spayd')
  })
})

/** Rasterises the dark-module path (`M x y.5 h n m dx 0 …`) into RGBA with a white quiet zone. */
function rasterize(qr: PaymentQrGraphic, scale = 6, quiet = 4) {
  const size = (qr.viewBox + quiet * 2) * scale
  const rgba = new Uint8ClampedArray(size * size * 4).fill(255)
  const fill = (x: number, y: number, n: number) => {
    for (let px = (x + quiet) * scale; px < (x + n + quiet) * scale; px++) {
      for (let py = (y + quiet) * scale; py < (y + 1 + quiet) * scale; py++) {
        const i = (py * size + px) * 4
        rgba[i] = rgba[i + 1] = rgba[i + 2] = 0
      }
    }
  }
  let x = 0
  let y = 0
  for (const [, cmd, a, b] of qr.path.matchAll(/([MmHh])(-?[\d.]+)(?: (-?[\d.]+))?/g)) {
    if (cmd === 'M') [x, y] = [Number(a), Math.floor(Number(b))]
    else if (cmd === 'm') [x, y] = [x + Number(a), y + Math.floor(Number(b))]
    else if (cmd === 'h') {
      fill(x, y, Number(a))
      x += Number(a)
    }
  }
  return { rgba, size }
}

describe('renderPaymentQr', () => {
  it('draws a code that decodes back to the SPAYD string', async () => {
    const input = doc({ paid: '2100' })
    const qr = await renderPaymentQr(input)
    expect(qr?.kind).toBe('spayd')
    const { rgba, size } = rasterize(qr as PaymentQrGraphic)
    const decoded = jsQR(rgba, size, size)
    expect(decoded?.data).toBe(buildPaymentQrPayload(input)?.payload)
    expect(decoded?.data).toContain('AM:10000.00')
    expect(decoded?.data).toContain('X-VS:20260001')
  })

  it('is null when there is nothing to pay', async () => {
    expect(await renderPaymentQr(doc({ status: 'paid' }))).toBeNull()
  })
})

describe('renderQrPng', () => {
  it('returns a PNG', async () => {
    const png = await renderQrPng('SPD*1.0*ACC:CZ6508000000192000145399*CC:CZK')
    expect(Buffer.from(png.subarray(0, 8)).toString('hex')).toBe('89504e470d0a1a0a')
  })
})
