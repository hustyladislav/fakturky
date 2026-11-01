import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { escapeXml, generateIsdoc, splitStreet, type DocumentForExport } from '../src/isdoc.ts'
import { computeDocumentTotals } from '../src/vat.ts'

const lines = [
  { description: 'Vývoj webu & API', quantity: '10', unit: 'h', unitPrice: '1500', vatRate: '21' },
  { description: 'Hosting <rok>', quantity: '1', unit: 'ks', unitPrice: '1200', vatRate: '12' },
]

function sample(over: Partial<DocumentForExport> = {}): DocumentForExport {
  const totals = computeDocumentTotals(lines, { vatPayer: true, roundTotal: true })
  return {
    type: 'invoice',
    number: '2026-0001',
    uuid: '0190a1f2-7b3c-7d4e-8a5b-123456789abc',
    issueDate: '2026-11-01',
    taxableDate: '2026-11-01',
    vatPayer: true,
    supplier: {
      name: 'Jan Novák',
      ico: '27082440',
      dic: 'CZ27082440',
      street: 'Jankovcova 1522/53',
      city: 'Praha',
      zip: '17000',
      registerNote: 'Fyzická osoba zapsaná v živnostenském rejstříku.',
      email: 'jan@example.cz',
    },
    customer: { name: 'Zákazník s.r.o.', ico: '26168685', dic: 'CZ26168685', street: 'Radlická 3294/10', city: 'Praha', zip: '15000' },
    lines,
    totals,
    currency: 'CZK',
    payment: {
      method: 'bank_transfer',
      dueDate: '2026-11-15',
      variableSymbol: '20260001',
      bankAccount: {
        accountNumber: '19-2000145399',
        bankCode: '0800',
        bankName: 'Česká spořitelna',
        iban: 'CZ65 0800 0000 1920 0014 5399',
        bic: 'GIBACZPX',
      },
    },
    ...over,
  }
}

const XSD = fileURLToPath(new URL('./fixtures/isdoc-invoice-6.0.2.xsd', import.meta.url))

function hasXmllint(): boolean {
  try {
    execFileSync('xmllint', ['--version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function validate(xml: string): void {
  const dir = mkdtempSync(join(tmpdir(), 'isdoc-'))
  const file = join(dir, 'doc.xml')
  writeFileSync(file, xml)
  execFileSync('xmllint', ['--noout', '--schema', XSD, file], { stdio: 'pipe' })
}

describe('generateIsdoc', () => {
  it('produces the expected structure', () => {
    const xml = generateIsdoc(sample())
    expect(xml).toContain('<Invoice xmlns="http://isdoc.cz/namespace/2013" version="6.0.2">')
    expect(xml).toContain('<DocumentType>1</DocumentType>')
    expect(xml).toContain('Vývoj webu &amp; API')
    expect(xml).toContain('Hosting &lt;rok&gt;')
    expect(xml).toContain('<IBAN>CZ6508000000192000145399</IBAN>')
    expect(xml).toContain('<PayableRoundingAmount>')
  })

  it('rejects bad uuid and estimate-like unsupported input', () => {
    expect(() => generateIsdoc(sample({ uuid: 'nope' }))).toThrow(/UUID/)
    expect(() => generateIsdoc(sample({ currency: 'EUR' }))).toThrow(/exchangeRate/)
  })

  it('maps document types', () => {
    expect(generateIsdoc(sample({ type: 'credit_note' }))).toContain('<DocumentType>2</DocumentType>')
    expect(generateIsdoc(sample({ type: 'proforma' }))).toContain('<DocumentType>4</DocumentType>')
  })

  it.skipIf(!hasXmllint())('validates against the official ISDOC 6.0.2 XSD', () => {
    validate(generateIsdoc(sample()))
  })

  it.skipIf(!hasXmllint())('validates a non-payer, foreign-currency credit note and cash invoice', () => {
    const np = computeDocumentTotals(lines, { vatPayer: false })
    validate(generateIsdoc(sample({ vatPayer: false, totals: np, payment: null })))
    const eur = computeDocumentTotals(lines, { vatPayer: true, currency: 'EUR', exchangeRate: '25.2' })
    validate(
      generateIsdoc(
        sample({
          type: 'credit_note',
          currency: 'EUR',
          exchangeRate: '25.2',
          totals: eur,
          originalDocument: { number: '2026-0001', issueDate: '2026-10-01' },
          customer: { name: 'GmbH', street: 'Hauptstr. 5', city: 'Wien', zip: '1010', country: 'AT', dic: 'ATU12345678' },
        }),
      ),
    )
  })
})

describe('helpers', () => {
  it('escapes XML', () => {
    expect(escapeXml(`a&b<c>"d"'e'\u0001`)).toBe('a&amp;b&lt;c&gt;&quot;d&quot;&apos;e&apos;')
  })
  it('splits streets', () => {
    expect(splitStreet('Jankovcova 1522/53')).toEqual({ name: 'Jankovcova', number: '1522/53' })
    expect(splitStreet('Nábřeží 12a')).toEqual({ name: 'Nábřeží', number: '12a' })
    expect(splitStreet('Bez čísla')).toEqual({ name: 'Bez čísla', number: '' })
  })
})
