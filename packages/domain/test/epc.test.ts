import { describe, expect, it } from 'vitest'
import { buildEpc } from '../src/qr/epc.ts'

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
