import type { DocumentForExport, DocumentLanguage, ExportLine } from '@fakturky/domain'

export type PdfLine = ExportLine & {
  /** Secondary description line, shown muted under the title. */
  detail?: string | null
  /** Per-line discount in percent, printed under the description. */
  discountPercent?: string | number
}

export type ImageBytes = Uint8Array | null | undefined

export interface InvoicePdfInput extends Omit<DocumentForExport, 'lines'> {
  lines: PdfLine[]
  language: DocumentLanguage
  /** Product name for the "Vystaveno ve …" line. Pass `BRAND.name`; never hardcoded here. */
  brandName: string
  /** Hide the "Vystaveno ve …" line (user setting). Default true. */
  showBrand?: boolean
  /** Name printed under "Vystavil(a)". */
  issuedBy?: string | null
  /** Intro text above the items table. */
  headerText?: string | null
  /** Closing text next to the payment block (e.g. "Děkuji za spolupráci."). */
  footerText?: string | null
  /** Credit notes: reason for the correction. */
  correctionReason?: string | null
  /** PNG or JPEG bytes. */
  logo?: ImageBytes
  /** PNG or JPEG bytes of a handwritten signature or stamp. */
  signature?: ImageBytes
}

export interface QrData {
  kind: 'spayd' | 'epc'
  viewBox: number
  /** SVG path data of the dark modules (stroke 1). */
  path: string
}
