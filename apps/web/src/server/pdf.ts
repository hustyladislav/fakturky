import { BRAND } from '@fakturky/core/brand'
import type { Services } from '@fakturky/core/context'
import { toDocumentForExport } from '@fakturky/core/export'
import type { DocumentLanguage } from '@fakturky/domain'
import { provideFontFiles, renderInvoicePdf } from '@fakturky/pdf'
import { useStorage } from 'nitro/storage'

const FONT_FILES = [
  'Inter-Regular.ttf',
  'Inter-Medium.ttf',
  'Inter-SemiBold.ttf',
  'GeistSerif-Regular.ttf',
]
let fontsLoaded: Promise<void> | null = null

/** Loads the bundled font assets once (Nitro server assets; plain disk reads are the fallback in dev/tests). */
function loadFonts(): Promise<void> {
  fontsLoaded ??= (async () => {
    try {
      const storage = useStorage('assets:pdf-fonts')
      const entries = await Promise.all(
        FONT_FILES.map(async (name) => [name, await storage.getItemRaw<Uint8Array>(name)] as const),
      )
      provideFontFiles(
        Object.fromEntries(entries.filter((e): e is [string, Uint8Array] => e[1] != null)),
      )
    } catch {
      /* not running under Nitro: the pdf package falls back to reading its own fonts/ directory */
    }
  })()
  return fontsLoaded
}

/** Renders an issued document with the look core resolved for it. Private notes are never part of the export. */
export const renderDocumentPdf: NonNullable<Services['renderPdf']> = async (
  doc,
  lines,
  original,
  look,
) => {
  await loadFonts()
  const base = toDocumentForExport(doc, lines, original)
  return renderInvoicePdf({
    ...base,
    note: null,
    lines: base.lines.map((l, i) => ({
      ...l,
      detail: lines[i]?.vatNote ? `${lines[i]?.vatNote}` : null,
      discountPercent: lines[i]?.discountPercent ?? '0',
    })),
    language: doc.language as DocumentLanguage,
    brandName: BRAND.name,
    showBrand: look.showBrand,
    accentColor: look.accentColor ?? undefined,
    logo: look.logo?.bytes,
    signature: look.signature?.bytes,
    headerText: doc.introText,
    footerText: doc.footerText,
  })
}

/** Decodes the router's base64 PDF into a download response. */
export function pdfFromBase64(file: { filename: string; contentBase64: string }) {
  return new Response(Buffer.from(file.contentBase64, 'base64'), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${file.filename}"`,
      'x-robots-tag': 'noindex, nofollow',
      'cache-control': 'private, no-store',
    },
  })
}
