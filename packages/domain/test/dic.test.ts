import { describe, expect, it } from 'vitest'
import { isValidCzDic, isValidEuVatId, isValidSkVatId, normalizeVatId, parseVatId } from '../src/dic.ts'

describe('DIČ / VAT IDs', () => {
  it('CZ', () => {
    expect(isValidCzDic('CZ27082440')).toBe(true)
    expect(isValidCzDic('cz 27082440')).toBe(true)
    expect(isValidCzDic('CZ27082441')).toBe(false)
    expect(isValidCzDic('CZ7501011234')).toBe(true)
    expect(isValidCzDic('CZ750101123')).toBe(true)
    expect(isValidCzDic('CZ75010112345')).toBe(false)
    expect(isValidCzDic('CZ1234567')).toBe(false)
    expect(isValidCzDic('27082440')).toBe(false)
  })
  it('SK', () => {
    expect(isValidSkVatId('SK2020317068')).toBe(true)
    expect(isValidSkVatId('SK2020317069')).toBe(false)
    expect(isValidSkVatId('SK0020317068')).toBe(false)
    expect(isValidSkVatId('SK202031706')).toBe(false)
    expect(isValidSkVatId('SK2050317068')).toBe(false)
  })
  it('EU formats', () => {
    for (const ok of ['DE123456789', 'ATU12345678', 'PL1234567890', 'NL123456789B01', 'CZ27082440', 'SK2020317068']) {
      expect(isValidEuVatId(ok)).toBe(true)
    }
    for (const bad of ['DE12345', 'US123456789']) expect(isValidEuVatId(bad)).toBe(false)
  })
  it('parses', () => {
    expect(normalizeVatId(' de 123.456-789 ')).toBe('DE123456789')
    expect(parseVatId('de123456789')).toEqual({ countryCode: 'DE', number: '123456789' })
    expect(parseVatId('US123')).toBeNull()
  })
})
