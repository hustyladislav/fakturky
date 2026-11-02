import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildVatReport, type VatReportDocument, type VatReportRecapRow } from '../src/vat-report.ts'
import {
  generateDp3Xml,
  generateKhXml,
  generateShXml,
  parseCzechStreet,
  taxpayerDicDigits,
  VatXmlError,
  type VatTaxpayer,
} from '../src/vat-xml.ts'

const xsd = (name: string) => fileURLToPath(new URL(`./fixtures/xsd/${name}`, import.meta.url))

function hasXmllint(): boolean {
  try {
    execFileSync('xmllint', ['--version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}
const XMLLINT = hasXmllint()

function validate(xml: string, schema: string): void {
  const dir = mkdtempSync(join(tmpdir(), 'vat-xml-'))
  const file = join(dir, 'doc.xml')
  writeFileSync(file, xml)
  try {
    execFileSync('xmllint', ['--noout', '--schema', xsd(schema), file], { stdio: 'pipe' })
  } catch (e) {
    throw new Error(`XSD validation failed:\n${(e as { stderr?: Buffer }).stderr?.toString()}\n${xml}`)
  }
}

const std = (rate: '21' | '12', base: string, vat: string): VatReportRecapRow => ({
  vatRate: rate,
  vatTreatment: 'standard',
  baseCzk: base,
  vatCzk: vat,
})
const other = (t: VatReportRecapRow['vatTreatment'], base: string): VatReportRecapRow => ({
  vatRate: '0',
  vatTreatment: t,
  baseCzk: base,
  vatCzk: '0.00',
})
const cust = (name: string, dic: string | null, country = 'CZ', icDph: string | null = null) => ({
  name,
  dic,
  country,
  icDph,
})

const docs: VatReportDocument[] = [
  { id: 'i1', type: 'invoice', number: '2026-0001', taxableDate: '2026-03-05', customer: cust('Alfa', 'CZ12345678'), recap: [std('21', '10000.00', '2100.00')] },
  { id: 'i2', type: 'invoice', number: '2026-0002', taxableDate: '2026-03-10', customer: cust('Novák', null), recap: [std('21', '50000.00', '10500.00')] },
  { id: 'i3', type: 'invoice', number: '2026-0003', taxableDate: '2026-03-12', customer: cust('Gama', 'CZ87654321'), recap: [std('21', '4000.00', '840.00'), std('12', '1000.00', '120.00')] },
  { id: 'i4', type: 'invoice', number: '2026-0004', taxableDate: '2026-03-15', customer: cust('Delta', 'CZ25596641'), recap: [std('12', '15000.00', '1800.00'), other('reverse_charge', '20000.00')] },
  { id: 'i5', type: 'invoice', number: '2026-0005', taxableDate: '2026-03-20', customer: cust('Berlin GmbH', null, 'DE', 'DE123456789'), recap: [other('eu_reverse_charge', '1000.40')] },
  { id: 'c1', type: 'credit_note', number: 'D2026-0001', taxableDate: '2026-03-28', customer: cust('Alfa', 'CZ12345678'), recap: [std('21', '-2000.00', '-420.00')] },
  { id: 'i9', type: 'invoice', number: '2026-0009', taxableDate: '2026-03-31', customer: cust('Athény & syn', null, 'GR', 'EL123456789'), euSupplyKind: 'goods', recap: [other('eu_reverse_charge', '2000.50')] },
  { id: 'i8', type: 'invoice', number: '2026-0008', taxableDate: '2026-03-31', customer: cust('NY', null, 'US'), recap: [other('export', '3000.00')] },
]

const taxpayer: VatTaxpayer = {
  dic: 'CZ7001011234',
  taxOfficeCode: '451',
  type: 'F',
  name: 'Jan Novák',
  street: 'Dlouhá 12/3',
  city: 'Praha',
  zip: '110 00',
  email: 'jan@example.cz',
}
const company: VatTaxpayer = {
  dic: 'CZ25596641',
  taxOfficeCode: '461',
  workplaceCode: '2001',
  type: 'P',
  name: 'Příklad & spol. s.r.o.',
  street: 'Dolní Lhota 15',
  city: 'Dolní Lhota',
  zip: '73991',
}

const march = { kind: 'month', year: 2026, month: 3 } as const
const q1 = { kind: 'quarter', year: 2026, quarter: 1 } as const
const report = buildVatReport(march, docs, { euSupplyKind: 'services' })

describe('helpers', () => {
  it('normalises the taxpayer DIČ', () => {
    expect(taxpayerDicDigits('CZ 7001011234')).toBe('7001011234')
    expect(taxpayerDicDigits('25596641')).toBe('25596641')
    expect(() => taxpayerDicDigits('DE123')).toThrow(VatXmlError)
  })

  it('splits street and numbers', () => {
    expect(parseCzechStreet('Dlouhá 12/3')).toEqual({ street: 'Dlouhá', houseNo: '12', orientNo: '3' })
    expect(parseCzechStreet('Dolní Lhota 15')).toEqual({ street: 'Dolní Lhota', houseNo: '15' })
    expect(parseCzechStreet('15')).toEqual({ houseNo: '15' })
    expect(parseCzechStreet('Na Příkopě')).toEqual({ street: 'Na Příkopě' })
  })

  it('rejects an invalid tax office code', () => {
    expect(() => generateKhXml(report, { ...taxpayer, taxOfficeCode: '45' })).toThrow(VatXmlError)
  })
})

describe('DPHKH1', () => {
  const xml = generateKhXml(report, taxpayer, { filedOn: '2026-04-20' })

  it('has the key elements', () => {
    expect(xml).toContain('<DPHKH1 verzePis="03.01.15">')
    expect(xml).toContain('<VetaD dokument="KH1" k_uladis="DPH" mesic="3" rok="2026" khdph_forma="B" d_poddp="20.04.2026"/>')
    expect(xml).toContain('<VetaP c_ufo="451" dic="7001011234" typ_ds="F" jmeno="Jan" prijmeni="Novák"')
    expect(xml).toContain('ulice="Dlouhá" c_orient="3" c_pop="12" naz_obce="Praha" psc="11000"')
    expect(xml).toContain('<VetaA1 c_evid_dd="2026-0004" dic_odb="25596641" duzp="15.03.2026" zakl_dane1="20000.00" kod_pred_pl="4"/>')
    expect(xml).toContain('<VetaA4 c_evid_dd="2026-0001" dic_odb="12345678" dppd="05.03.2026" zakl_dane1="10000.00" dan1="2100.00" kod_rezim_pl="0" zdph_44="N"/>')
    // reduced rate only → second column
    expect(xml).toContain('<VetaA4 c_evid_dd="2026-0004" dic_odb="25596641" dppd="15.03.2026" zakl_dane2="15000.00" dan2="1800.00" kod_rezim_pl="0" zdph_44="N"/>')
    // A.5: 50 000 + 4 000 − 2 000 at 21 %, 1 000 at 12 %
    expect(xml).toContain('<VetaA5 zakl_dane1="52000.00" dan1="10920.00" zakl_dane2="1000.00" dan2="120.00"/>')
  })

  it('does not contain EU supplies, exports or A.2/B sections', () => {
    expect(xml).not.toContain('Berlin')
    expect(xml).not.toContain('VetaA2')
    expect(xml).not.toContain('VetaB')
  })

  it.skipIf(!XMLLINT)('validates against the official XSD', () => {
    validate(xml, 'dphkh1_epo2.xsd')
    validate(generateKhXml(buildVatReport(q1, docs.map((d) => ({ ...d, taxableDate: '2026-02-10' }))), company), 'dphkh1_epo2.xsd')
    validate(generateKhXml(buildVatReport(march, []), taxpayer), 'dphkh1_epo2.xsd')
  })

  it('escapes special characters', () => {
    const x = generateKhXml(report, { ...company, name: 'A "B" <C> & D' })
    expect(x).toContain('zkrobchjm="A &quot;B&quot; &lt;C&gt; &amp; D"')
  })
})

describe('DPHDP3', () => {
  const xml = generateDp3Xml(
    report,
    company,
    { r40Base: '100000', r40Deduction: '21000' },
    { filedOn: '2026-04-20', software: { name: 'Fakturky', version: '0.1' } },
  )

  it('has the key elements', () => {
    expect(xml).toContain('<Pisemnost nazevSW="Fakturky" verzeSW="0.1">')
    expect(xml).toContain('<DPHDP3 verzePis="03.01.04">')
    expect(xml).toContain('<VetaD dapdph_forma="B" dokument="DP3" k_uladis="DPH" mesic="3" rok="2026" typ_platce="P" d_poddp="20.04.2026"/>')
    expect(xml).toContain('<VetaP c_ufo="461" c_pracufo="2001" dic="25596641" typ_ds="P" zkrobchjm="Příklad &amp; spol. s.r.o."')
    // ř.1: 10000 + 50000 + 4000 − 2000 = 62000; VAT 2100 + 10500 + 840 − 420 = 13020
    expect(xml).toContain('<Veta1 obrat23="62000" dan23="13020" obrat5="16000" dan5="1920"/>')
    expect(xml).toContain('<Veta2 dod_zb="2001" pln_sluzby="1000" pln_vyvoz="3000" pln_rez_pren="20000"/>')
    expect(xml).toContain('<Veta4 pln23="100000" odp_tuz23_nar="21000" odp_sum_nar="21000"/>')
    // output 13020 + 1920 = 14940, deduction 21000 → excess deduction 6060
    expect(xml).toContain('<Veta6 dan_zocelk="14940" odp_zocelk="21000" dano_da="0" dano_no="6060"/>')
  })

  it('omits Veta4 without manual input and reports tax to pay', () => {
    const x = generateDp3Xml(report, company)
    expect(x).not.toContain('Veta4')
    expect(x).toContain('dano_da="14940" dano_no="0"')
  })

  it.skipIf(!XMLLINT)('validates against the official XSD', () => {
    validate(xml, 'dphdp3_epo2.xsd')
    validate(generateDp3Xml(report, taxpayer), 'dphdp3_epo2.xsd')
    validate(generateDp3Xml(buildVatReport(q1, []), taxpayer), 'dphdp3_epo2.xsd')
  })
})

describe('DPHSHV', () => {
  const xml = generateShXml(report, taxpayer, { filedOn: '2026-04-20' })

  it('has the key elements', () => {
    expect(xml).toContain('<DPHSHV verzePis="02.01.05">')
    expect(xml).toContain('<VetaD k_uladis="DPH" dokument="SHV" mesic="3" rok="2026" shvies_forma="R" d_poddp="20.04.2026"/>')
    expect(xml).not.toContain('email')
    // Greece uses EL; goods → code 0; 2000.50 rounded UP to 2001
    expect(xml).toContain('<VetaR c_rad="1" k_stat="DE" c_vat="123456789" k_pln_eu="3" pln_pocet="1" pln_hodnota="1001"/>')
    expect(xml).toContain('<VetaR c_rad="2" k_stat="EL" c_vat="123456789" k_pln_eu="0" pln_pocet="1" pln_hodnota="2001"/>')
  })

  it.skipIf(!XMLLINT)('validates against the official XSD', () => {
    validate(xml, 'dphshv_epo2.xsd')
    validate(generateShXml(buildVatReport(q1, []), company), 'dphshv_epo2.xsd')
  })
})
