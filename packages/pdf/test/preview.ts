import { renderPageAsImage } from 'unpdf'

/** Renders pages of a PDF to PNG bytes (first `maxPages`) using @napi-rs/canvas. */
export async function renderPngs(pdf: Uint8Array, scale = 2, maxPages = 1): Promise<Uint8Array[]> {
  const out: Uint8Array[] = []
  for (let page = 1; page <= maxPages; page++) {
    const img = await renderPageAsImage(pdf.slice(), page, {
      canvasImport: () => import('@napi-rs/canvas'),
      scale,
    })
    out.push(new Uint8Array(img))
  }
  return out
}
