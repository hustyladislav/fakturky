import { renderToBuffer } from '@react-pdf/renderer'
import { registerFonts } from './fonts.ts'
import { InvoiceDocument } from './InvoiceDocument.tsx'
import { buildInvoiceQr } from './qr.ts'
import type { InvoicePdfInput } from './types.ts'

let queue: Promise<unknown> = Promise.resolve()

/** Renders the invoice to PDF bytes. Server-only (reads bundled fonts from disk). Renders run one at a time. */
export async function renderInvoicePdf(doc: InvoicePdfInput): Promise<Uint8Array> {
  const qr = await buildInvoiceQr(doc)
  const job = queue.then(async () => {
    registerFonts()
    const buffer = await renderToBuffer(InvoiceDocument({ doc, qr }))
    return new Uint8Array(buffer)
  })
  queue = job.catch(() => undefined)
  return job
}
