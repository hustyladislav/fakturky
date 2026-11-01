import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Font } from '@react-pdf/renderer'

const dataUrls = new Map<string, string>()

function file(name: string): string {
  let url = dataUrls.get(name)
  if (!url) {
    const bytes = readFileSync(fileURLToPath(new URL(`../fonts/${name}`, import.meta.url)))
    url = `data:font/ttf;base64,${bytes.toString('base64')}`
    dataUrls.set(name, url)
  }
  return url
}

/**
 * Registers bundled Inter + Fraunces (latin-ext) and disables hyphenation.
 *
 * Re-registers from scratch on every call: react-pdf keeps the loaded fontkit font (and its glyph
 * subset) on the registered source, so reusing it across documents corrupts glyph/ToUnicode maps of every
 * document after the first (wrong characters, broken text extraction). `renderInvoicePdf` serialises renders
 * for the same reason.
 */
export function registerFonts(): void {
  Font.clear()
  // `clear()` also drops react-pdf's built-in default family, which unstyled nodes still resolve to.
  Font.register({
    family: 'Helvetica',
    fonts: [{ src: 'Helvetica' }, { src: 'Helvetica-Bold', fontWeight: 700 }],
  })
  Font.register({
    family: 'Inter',
    fonts: [
      { src: file('Inter-Regular.ttf'), fontWeight: 400 },
      { src: file('Inter-Medium.ttf'), fontWeight: 500 },
      { src: file('Inter-SemiBold.ttf'), fontWeight: 600 },
    ],
  })
  Font.register({
    family: 'Fraunces',
    fonts: [
      { src: file('Fraunces-500.ttf'), fontWeight: 500 },
      { src: file('Fraunces-600.ttf'), fontWeight: 600 },
    ],
  })
  Font.registerHyphenationCallback((word) => [word])
}
