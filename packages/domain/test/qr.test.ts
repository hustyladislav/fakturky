import { describe, expect, it } from 'vitest'
import { buildEpc } from '../src/qr/epc.ts'
import { renderQrSvg } from '../src/qr/render.ts'
import { buildSid, buildSpayd, spaydText } from '../src/qr/spayd.ts'

const IBAN = 'CZ6508000000192000145399'

describe('SPAYD', () => {
  it('builds a full string', () => {
    expect(
      buildSpayd({
        iban: 'CZ65 0800 0000 1920 0014 5399',
        bic: 'giba czpx'.replace(' ', ''),
        amount: '1234.5',
        variableSymbol: '2026-0001',
        dueDate: '2026-11-15',
        message: 'Faktura 2026-0001',
        recipientName: 'Jan Novák',
      }),
    ).toBe(
      `SPD*1.0*ACC:${IBAN}+GIBACZPX*AM:1234.50*CC:CZK*RN:JAN NOVAK*X-VS:20260001*DT:20261115*MSG:FAKTURA 2026-0001`,
    )
  })

  it('minimal', () => {
    expect(buildSpayd({ iban: IBAN })).toBe(`SPD*1.0*ACC:${IBAN}*CC:CZK`)
  })

  it('escapes asterisks and strips diacritics, truncates', () => {
    expect(spaydText('Příliš *žluťoučký* kůň', 100)).toBe('PRILIS %2AZLUTOUCKY%2A KUN')
    expect(spaydText('a'.repeat(80), 60)).toHaveLength(60)
    expect(spaydText('100%', 10)).toBe('100%25')
    expect(spaydText('€ ok', 10)).toBe(' OK')
  })

  it('symbols: digits only, max 10', () => {
    const s = buildSpayd({ iban: IBAN, variableSymbol: '12-345678901234', constantSymbol: '0308', specificSymbol: 'x9' })
    expect(s).toContain('X-VS:1234567890')
    expect(s).toContain('X-SS:9')
    expect(s).toContain('X-KS:0308')
  })

  it('embeds QR Faktura', () => {
    const s = buildSpayd({
      iban: IBAN,
      amount: '121',
      invoice: { id: '2026/0001', issueDate: '2026-11-01', duzp: '2026-11-01', supplierIco: '27082440', supplierDic: 'CZ27082440', customerIco: '26168685', customerDic: 'CZ26168685', total: '121', currency: 'czk' },
    })
    expect(s).toContain(
      'X-INV:SID%2A1.0%2AID:2026%2F0001%2ADD:20261101%2AAM:121.00%2ACC:CZK%2ADUZP:20261101%2AINR:27082440%2AVII:CZ27082440%2AINP:26168685%2AVIR:CZ26168685',
    )
    expect(s.split('*')).toHaveLength(6)
    expect(buildSid({ id: 'A', issueDate: '2026-01-02' })).toBe('SID%2A1.0%2AID:A%2ADD:20260102')
  })

  it('rejects bad dates', () => {
    expect(() => buildSpayd({ iban: IBAN, dueDate: '15.11.2026' })).toThrow()
  })
})

describe('EPC', () => {
  it('builds the payload', () => {
    expect(buildEpc({ name: 'Jan Novák', iban: 'lt12 1000 0111 0100 1000', bic: 'revolt21', amount: '12.5', remittance: 'Invoice 1' })).toBe(
      'BCD\n002\n1\nSCT\nREVOLT21\nJan Novák\nLT121000011101001000\nEUR12.50\n\n\nInvoice 1',
    )
  })
  it('allows structured reference and no amount', () => {
    expect(buildEpc({ name: 'X', iban: 'LT121000011101001000', reference: 'RF18539007547034' }).split('\n')).toEqual([
      'BCD', '002', '1', 'SCT', '', 'X', 'LT121000011101001000', '', '', 'RF18539007547034', '',
    ])
  })
  it('validates', () => {
    expect(() => buildEpc({ name: 'X', iban: 'LT121000011101001000', reference: 'a', remittance: 'b' })).toThrow()
    expect(() => buildEpc({ name: 'X', iban: 'LT121000011101001000', amount: '0' })).toThrow()
    expect(() => buildEpc({ name: 'X', iban: 'LT121000011101001000', amount: '1000000000' })).toThrow()
    expect(buildEpc({ name: 'N'.repeat(100), iban: 'LT121000011101001000' }).split('\n')[5]).toHaveLength(70)
  })
})

describe('QR render', () => {
  it('returns an SVG', async () => {
    const svg = await renderQrSvg(buildSpayd({ iban: IBAN, amount: '10' }))
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('viewBox')
    const sized = await renderQrSvg('x', { width: 200, margin: 0, dark: '#112233', light: '#ffffff' })
    expect(sized).toContain('#112233')
  })
})
