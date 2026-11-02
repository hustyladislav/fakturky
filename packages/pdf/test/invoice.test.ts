import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { computeDocumentTotals } from '@fakturky/domain'
import { extractText, getDocumentProxy } from 'unpdf'
import { beforeAll, describe, expect, it } from 'vitest'
import { renderInvoicePdf } from '../src/index.ts'
import { ALL } from './fixtures.ts'
import { renderPngs } from './preview.ts'

const examplesDir = fileURLToPath(new URL('../examples/', import.meta.url))

const n = (v: string) => v.replace(/\s+/g, '').toLowerCase()

interface Rendered {
  pdf: Uint8Array
  pages: number
  text: string
  /** Lower-cased, whitespace-free: robust against letter-spaced uppercase labels. */
  flat: string
}
const rendered: Record<string, Rendered> = {}

async function inspect(pdf: Uint8Array): Promise<Rendered> {
  const doc = await getDocumentProxy(pdf.slice())
  const { text, totalPages } = await extractText(doc, { mergePages: true })
  const clean = text.replace(/\u00a0/g, ' ')
  return { pdf, pages: totalPages, text: clean, flat: n(clean) }
}

beforeAll(async () => {
  await mkdir(examplesDir, { recursive: true })
  for (const [name, make] of Object.entries(ALL)) {
    const pdf = await renderInvoicePdf(make())
    await writeFile(`${examplesDir}${name}.pdf`, pdf)
    rendered[name] = await inspect(pdf)
    const pngs = await renderPngs(pdf, 2, Math.min(rendered[name].pages, 3))
    for (const [i, png] of pngs.entries()) {
      await writeFile(`${examplesDir}${name}${i === 0 ? '' : `-p${i + 1}`}.png`, png)
    }
  }
})

const get = (n: string) => rendered[n] as Rendered

describe('invoice PDF', () => {
  it('renders valid PDFs', () => {
    for (const r of Object.values(rendered)) {
      expect(new TextDecoder().decode(r.pdf.slice(0, 5))).toBe('%PDF-')
    }
  })

  it('(a) non-payer: plain Faktura, Neplátce, no VAT recap, QR Platba', () => {
    const r = get('a-neplatce-czk')
    expect(r.pages).toBe(1)
    expect(r.flat).toContain(n('Faktura'))
    expect(r.flat).not.toContain(n('daňový doklad'))
    expect(r.flat).toContain(n('Neplátce DPH'))
    expect(r.flat).toContain(n('Fyzická osoba zapsaná v živnostenském rejstříku'))
    expect(r.flat).not.toContain(n('Rekapitulace DPH'))
    expect(r.flat).not.toContain(n('uskutečnění zdanitelného plnění'))
    expect(r.flat).toContain(n('15 000,00 Kč'))
    expect(r.flat).toContain(n('QR Platba'))
    expect(r.flat).toContain(n('CZ6508000000192000145399'))
    expect(r.flat).toContain(n('Strana 1 / 1'))
    expect(r.flat).toContain(n('Vystaveno v aplikaci Fakturky'))
  })

  it('(b) payer: tax document, DUZP, recap per rate', () => {
    const r = get('b-platce-czk-21-12')
    expect(r.pages).toBe(1)
    expect(r.flat).toContain(n('Faktura – daňový doklad'))
    expect(r.flat).toContain(n('Plátce DPH'))
    expect(r.flat).toContain(n('Datum uskutečnění zdanitelného plnění'))
    expect(r.flat).toContain(n('CZ7106151234'))
    expect(r.flat).toContain(n('Rekapitulace DPH'))
    expect(r.flat).toContain(n('21 %'))
    expect(r.flat).toContain(n('12 %'))
    // 48 500 × 21 % = 10 185; 4 350 × 12 % = 522
    expect(r.flat).toContain(n('10 185,00'))
    expect(r.flat).toContain(n('522,00'))
    expect(r.flat).toContain(n('63 557,00 Kč'))
  })

  it('(c) EUR + reverse charge: legal text, CZK equivalents, rate, EPC QR', () => {
    const r = get('c-platce-eur-reverse-charge')
    expect(r.flat).toContain(n('Přenesení daňové povinnosti'))
    expect(r.flat).toContain(n('DE811234567'))
    expect(r.flat).toContain(n('Přepočet DPH na Kč'))
    expect(r.flat).toContain(n('1 EUR = 25,215 Kč'))
    expect(r.flat).toContain(n('SEPA QR'))
    expect(r.flat).toContain(n('2 600,00 €'))
    expect(r.flat).toContain(n('Německo'))
  })

  it('(d) 40 lines: multiple pages, header repeats, page numbering', () => {
    const r = get('d-40-lines')
    expect(r.pages).toBeGreaterThanOrEqual(2)
    expect(r.flat).toContain(n(`Strana 1 / ${r.pages}`))
    expect(r.flat).toContain(n(`Strana ${r.pages} / ${r.pages}`))
    expect(r.flat.match(/množství/g)?.length).toBe(r.pages)
    expect(r.flat).toContain(n('Položka 40'))
  })

  it('(e) English labels', () => {
    const r = get('e-english')
    expect(r.flat).toContain(n('Invoice – tax document'))
    expect(r.flat).toContain(n('Issue date'))
    expect(r.flat).toContain(n('Due date'))
    expect(r.flat).toContain(n('Reverse charge'))
    expect(r.flat).toContain(n('Page 1 / 1'))
    expect(r.flat).toContain(n('Issued with Fakturky'))
    expect(r.flat).toContain(n('VAT summary'))
    expect(r.flat).not.toContain(n('Datum'))
  })

  it('renders Czech/Slovak diacritics', async () => {
    const doc = ALL['a-neplatce-czk']?.()
    if (!doc) throw new Error('fixture')
    const sample = 'ěščřžýáíéúůďťň ĚŠČŘŽÝÁÍÉÚŮĎŤŇ ľĺŕô'
    doc.lines[0] = { ...doc.lines[0]!, description: sample }
    const r = await inspect(await renderInvoicePdf(doc))
    expect(r.text).toContain(sample)
  })

  it('titles by type and VAT status', async () => {
    const base = ALL['b-platce-czk-21-12']?.()
    if (!base) throw new Error('fixture')
    const textOf = async (type: typeof base.type, vatPayer: boolean) =>
      (await inspect(await renderInvoicePdf({ ...base, type, vatPayer }))).text
    const proforma = n(await textOf('proforma', true))
    expect(proforma).toContain(n('Zálohová faktura'))
    expect(proforma).toContain(n('Tento doklad není daňovým dokladem'))
    expect(n(await textOf('credit_note', true))).toContain(n('Opravný daňový doklad'))
    expect(n(await textOf('credit_note', false))).toContain(n('Opravný doklad'))
    expect(n(await textOf('payment_receipt', true))).toContain(n('Daňový doklad k přijaté platbě'))
  })

  it('renders logo, signature, discount, advances and rounding', async () => {
    const { createCanvas } = await import('@napi-rs/canvas')
    const c = createCanvas(120, 40)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#1F4D3C'
    ctx.fillRect(0, 0, 120, 40)
    const png = new Uint8Array(c.toBuffer('image/png'))
    const base = ALL['b-platce-czk-21-12']?.()
    if (!base) throw new Error('fixture')
    const lines = [{ ...base.lines[0]!, discountPercent: '10' }, ...base.lines.slice(1)]
    const totals = computeDocumentTotals(lines, { vatPayer: true, roundTotal: true })
    const r = await inspect(
      await renderInvoicePdf({
        ...base,
        lines,
        totals,
        logo: png,
        signature: png,
        paidDeposits: '10000',
        note: null,
        showBrand: false,
      }),
    )
    await writeFile(`${examplesDir}f-logo-signature.pdf`, r.pdf)
    await writeFile(
      `${examplesDir}f-logo-signature.png`,
      (await renderPngs(r.pdf, 2))[0] as Uint8Array,
    )
    expect(r.pages).toBe(1)
    expect(r.flat).toContain(n('Sleva 10 %'))
    expect(r.flat).toContain(n('Uhrazené zálohy'))
    expect(r.flat).toContain(n('Zbývá uhradit'))
    expect(r.flat).toContain(n('Zaokrouhlení'))
    expect(r.flat).not.toContain(n('Vystaveno v aplikaci'))
  })
})
