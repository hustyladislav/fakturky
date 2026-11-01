import { BRAND } from '@fakturky/core/brand'
import { toDocumentForExport } from '@fakturky/core/export'
import type { DocumentLanguage } from '@fakturky/domain'
import { provideFontFiles, renderInvoicePdf } from '@fakturky/pdf'
import { useStorage } from 'nitro/storage'

const FONT_FILES = [
  'Inter-Regular.ttf',
  'Inter-Medium.ttf',
  'Inter-SemiBold.ttf',
  'Fraunces-500.ttf',
  'Fraunces-600.ttf',
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

type Doc = Parameters<typeof toDocumentForExport>[0]
type Lines = Parameters<typeof toDocumentForExport>[1]

/** Renders an issued document. Private notes are never part of the export. */
export async function renderDocumentPdf(doc: Doc, lines: Lines): Promise<Uint8Array> {
  await loadFonts()
  const base = toDocumentForExport(doc, lines)
  return renderInvoicePdf({
    ...base,
    note: null,
    lines: base.lines.map((l, i) => ({ ...l, discountPercent: lines[i]?.discountPercent ?? '0' })),
    language: doc.language as DocumentLanguage,
    brandName: BRAND.name,
    headerText: doc.introText,
    footerText: doc.footerText,
  })
}

export function pdfResponse(bytes: Uint8Array, number: string | null, inline = false) {
  const name = `${number ?? 'faktura'}.pdf`
  return new Response(bytes as BodyInit, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `${inline ? 'inline' : 'attachment'}; filename="${name}"`,
      'x-robots-tag': 'noindex, nofollow',
      'cache-control': 'private, no-store',
    },
  })
}
