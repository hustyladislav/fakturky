/**
 * Browser-safe entry (`@fakturky/pdf/html`): the HTML twin of the PDF. Imports nothing from
 * `@react-pdf/renderer` or Node.
 */

export type { Labels } from '../i18n.ts'
export { LABELS } from '../i18n.ts'
export type {
  InvoiceSheetDraft,
  InvoiceSheetInput,
  SheetDraftLine,
  SheetImage,
  SheetModel,
} from '../model.ts'
export { buildSheetModel, resolveSheetInput } from '../model.ts'
export { amountDue, buildInvoiceQr } from '../qr.ts'
export type { ImageBytes, InvoicePdfInput, PdfLine, QrData } from '../types.ts'
export type { InvoiceSheetProps } from './InvoiceSheet.tsx'
export { InvoiceSheet, PAPER_HEIGHT, PAPER_WIDTH } from './InvoiceSheet.tsx'
export { imageSrc } from './image.ts'
export { useInvoiceQr } from './useInvoiceQr.ts'
