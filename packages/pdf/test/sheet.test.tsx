import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ALL, logoSignature } from '../src/fixtures.ts'
import { buildInvoiceQr, InvoiceSheet, type InvoiceSheetInput } from '../src/html/index.ts'

function html(doc: InvoiceSheetInput, qr?: Awaited<ReturnType<typeof buildInvoiceQr>>): string {
  return renderToStaticMarkup(<InvoiceSheet doc={doc} qr={qr ?? null} />)
}

/** Visible text only, whitespace-normalised, NBSP folded. */
function text(markup: string): string {
  return markup
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[  ]/g, ' ')
    .replace(/\s+/g, ' ')
}

describe('InvoiceSheet (HTML twin of the PDF)', () => {
  it('(a) non-payer: plain title, no VAT column or recap', () => {
    const t = text(html(ALL['a-neplatce-czk']?.() as InvoiceSheetInput))
    expect(t).toContain('Faktura')
    expect(t).not.toContain('daňový doklad')
    expect(t).toContain('č. 2026012')
    expect(t).toContain('Neplátce DPH')
    expect(t).toContain('Konzultace a vývoj webu')
    expect(t).toContain('15 000,00 Kč')
    expect(t).not.toContain('Rekapitulace DPH')
    expect(t).toContain('Děkuji za spolupráci.')
    expect(t).toContain('Vystavil(a): Jan Novák')
  })

  it('(b) payer: tax title, VAT recap, totals', () => {
    const t = text(html(ALL['b-platce-czk-21-12']?.() as InvoiceSheetInput))
    expect(t).toContain('Faktura – daňový doklad')
    expect(t).toContain('Rekapitulace DPH (Kč)')
    expect(t).toContain('63 557,00 Kč')
    expect(t).toContain('Datum uskutečnění zdanitelného plnění')
    expect(t).toContain('CZ65 0800 0000 1920 0014 5399')
  })

  it('(c) EUR reverse charge: legal note, CZK conversion, rate', () => {
    const t = text(html(ALL['c-platce-eur-reverse-charge']?.() as InvoiceSheetInput))
    expect(t).toContain('Přenesení daňové povinnosti')
    expect(t).toContain('Kurz: 1 EUR = 25,215 Kč')
    expect(t).toContain('2 600,00 €')
    expect(t).toContain('DE811234567')
  })

  it('(d) 40 lines render as one continuous sheet', () => {
    const markup = html(ALL['d-40-lines']?.() as InvoiceSheetInput)
    expect(markup.match(/<tbody><tr>/g)?.length).toBeGreaterThanOrEqual(1)
    expect(text(markup)).toContain('Položka 40')
  })

  it('(e) English labels', () => {
    const t = text(html(ALL['e-english']?.() as InvoiceSheetInput))
    expect(t).toContain('Invoice – tax document')
    expect(t).toContain('No. 2026064')
    expect(t).toContain('Due date')
    expect(t).toContain('Thank you for your business.')
    expect(t).not.toContain('Datum')
  })

  it('(f) discount, deposits, rounding, logo and signature images', () => {
    const doc = {
      ...logoSignature(),
      logo: 'data:image/png;base64,AAAA',
      signature: 'data:image/png;base64,BBBB',
    }
    const markup = html(doc)
    const t = text(markup)
    expect(t).toContain('Sleva 10 %')
    expect(t).toContain('Zaokrouhlení')
    expect(t).toContain('Uhrazené zálohy')
    expect(t).toContain('Zbývá uhradit')
    expect(markup).toContain('src="data:image/png;base64,AAAA"')
    expect(markup).toContain('src="data:image/png;base64,BBBB"')
  })

  it('titles by type and VAT status', () => {
    const base = ALL['b-platce-czk-21-12']?.() as NonNullable<ReturnType<(typeof ALL)[string]>>
    const of = (type: typeof base.type, vatPayer: boolean) =>
      text(html({ ...base, type, vatPayer }))
    expect(of('proforma', true)).toContain('Zálohová faktura')
    expect(of('proforma', true)).toContain('Tento doklad není daňovým dokladem')
    expect(of('credit_note', true)).toContain('Opravný daňový doklad')
    expect(of('credit_note', false)).toContain('Opravný doklad')
    expect(of('payment_receipt', true)).toContain('Daňový doklad k přijaté platbě')
  })

  it('uses the accent colour and falls back to brand green', () => {
    const base = ALL['a-neplatce-czk']?.() as NonNullable<ReturnType<(typeof ALL)[string]>>
    expect(html({ ...base, accentColor: '#b3261e' })).toContain('--fk-accent:#b3261e')
    expect(html({ ...base, accentColor: 'nonsense' })).toContain('--fk-accent:#1F4D3C')
  })

  it('renders the QR as an accessible SVG', async () => {
    const doc = ALL['b-platce-czk-21-12']?.() as NonNullable<ReturnType<(typeof ALL)[string]>>
    const qr = await buildInvoiceQr(doc)
    const markup = html(doc, qr)
    expect(markup).toContain('role="img"')
    expect(markup).toContain('aria-label="QR Platba"')
    expect(markup).toContain('stroke="#000000"')
  })

  it('accepts an empty live draft', () => {
    const t = text(html({}))
    expect(t).toContain('bude přiděleno')
    expect(t).toContain('0,00 Kč')
  })

  it('accepts a partial draft with unparsable numbers', () => {
    const t = text(
      html({
        number: '',
        language: 'cs',
        vatPayer: true,
        customer: { name: 'Studio Lípa' },
        lines: [
          { description: 'Konzultace', quantity: '3', unitPrice: '1500' },
          { description: 'Rozpracováno', quantity: 'x', unitPrice: '' },
        ],
      }),
    )
    expect(t).toContain('bude přiděleno')
    expect(t).toContain('Studio Lípa')
    expect(t).toContain('Konzultace')
    expect(t).toContain('5 445,00 Kč')
  })

  it('uses semantic structure', () => {
    const markup = html(ALL['b-platce-czk-21-12']?.() as InvoiceSheetInput)
    expect(markup).toContain('<h2')
    expect(markup).toContain('scope="col"')
    expect(markup).toContain('<table')
    expect(markup).toContain('<dl')
  })
})
