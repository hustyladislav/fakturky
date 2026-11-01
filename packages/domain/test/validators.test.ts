import { describe, expect, it } from 'vitest'
import { findBank, isKnownBankCode, BANK_CODES } from '../src/bank-codes.ts'
import { czechAccountToIban, formatCzechAccount, isValidCzechAccount, parseCzechAccount } from '../src/czech-account.ts'
import { isValidCzDic, isValidEuVatId, isValidSkVatId, normalizeVatId, parseVatId } from '../src/dic.ts'
import { czechAccountFromIban, formatIban, ibanCheckDigits, isValidIban, normalizeIban } from '../src/iban.ts'
import { isValidIco, normalizeIco } from '../src/ico.ts'

describe('IČO', () => {
  it.each(['27082440', '26168685', '00006947', '45274649', '25596641', '00000019'])(
    'valid %s',
    (v) => expect(isValidIco(v)).toBe(true),
  )
  it.each(['27082441', '12345678', '1234567', 'abcdefgh', '', '123456789'])('invalid %s', (v) =>
    expect(isValidIco(v)).toBe(false),
  )
  it('normalizes', () => {
    expect(normalizeIco(' 6947 ')).toBe('00006947')
    expect(isValidIco('6947')).toBe(true)
    expect(normalizeIco('x1')).toBe('x1')
  })
})

describe('DIČ / VAT IDs', () => {
  it('CZ', () => {
    expect(isValidCzDic('CZ27082440')).toBe(true)
    expect(isValidCzDic('cz 27082440')).toBe(true)
    expect(isValidCzDic('CZ27082441')).toBe(false)
    expect(isValidCzDic('CZ7501011234')).toBe(true) // 10 digits (natural person)
    expect(isValidCzDic('CZ750101123')).toBe(true) // 9 digits
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
    expect(isValidEuVatId('DE123456789')).toBe(true)
    expect(isValidEuVatId('ATU12345678')).toBe(true)
    expect(isValidEuVatId('PL1234567890')).toBe(true)
    expect(isValidEuVatId('NL123456789B01')).toBe(true)
    expect(isValidEuVatId('DE12345')).toBe(false)
    expect(isValidEuVatId('US123456789')).toBe(false)
    expect(isValidEuVatId('CZ27082440')).toBe(true)
    expect(isValidEuVatId('SK2020317068')).toBe(true)
  })
  it('parses', () => {
    expect(normalizeVatId(' de 123.456-789 ')).toBe('DE123456789')
    expect(parseVatId('de123456789')).toEqual({ countryCode: 'DE', number: '123456789' })
    expect(parseVatId('US123')).toBeNull()
  })
})

describe('IBAN', () => {
  it.each([
    'CZ6508000000192000145399',
    'GB82 WEST 1234 5698 7654 32',
    'DE89370400440532013000',
    'LT121000011101001000',
    'BE68539007547034',
    'SK3112000000198742637541',
  ])('valid %s', (v) => expect(isValidIban(v)).toBe(true))

  it.each(['CZ6508000000192000145398', 'CZ65080000001920001453', 'XX', '', 'DE89370400440532013001', '1234'])(
    'invalid %s',
    (v) => expect(isValidIban(v)).toBe(false),
  )

  it('formats and normalizes', () => {
    expect(formatIban('cz6508000000192000145399')).toBe('CZ65 0800 0000 1920 0014 5399')
    expect(normalizeIban(' cz65 0800 ')).toBe('CZ650800')
    expect(ibanCheckDigits('DE', '370400440532013000')).toBe('89')
  })

  it('extracts the Czech account', () => {
    expect(czechAccountFromIban('CZ6508000000192000145399')).toEqual({ prefix: '19', number: '2000145399', bankCode: '0800' })
    expect(czechAccountFromIban('CZ5508000000000000000001')).toBeNull() // bad checksum
    expect(czechAccountFromIban('DE89370400440532013000')).toBeNull()
  })
})

describe('Czech account', () => {
  it('parses', () => {
    expect(parseCzechAccount('19-2000145399/0800')).toEqual({ prefix: '19', number: '2000145399', bankCode: '0800' })
    expect(parseCzechAccount(' 123456789 / 0100 ')).toEqual({ prefix: '', number: '123456789', bankCode: '0100' })
    expect(parseCzechAccount('000019-2000145399/0800')?.prefix).toBe('19')
    for (const bad of ['', '123/01', 'abc/0100', '1234567-123/0100', '12345678901/0100', '19-2000145399']) {
      expect(parseCzechAccount(bad)).toBeNull()
    }
  })

  it('mod-11 validation', () => {
    expect(isValidCzechAccount('19-2000145399/0800')).toBe(true)
    expect(isValidCzechAccount('2000145399/0800')).toBe(true) // prefix is optional
    expect(isValidCzechAccount('19-2000145398/0800')).toBe(false)
    expect(isValidCzechAccount('20-2000145399/0800')).toBe(false)
    expect(isValidCzechAccount('0/0800')).toBe(false)
  })

  it('IBAN conversion', () => {
    expect(czechAccountToIban('19-2000145399/0800')).toBe('CZ6508000000192000145399')
    expect(isValidIban(czechAccountToIban('19-2000145399/0800'))).toBe(true)
    expect(() => czechAccountToIban('19-2000145398/0800')).toThrow()
    expect(() => czechAccountToIban('garbage')).toThrow()
  })

  it('round trip and formatting', () => {
    const iban = czechAccountToIban('19-2000145399/0800')
    const acc = czechAccountFromIban(iban)
    expect(acc && formatCzechAccount(acc)).toBe('19-2000145399/0800')
    expect(formatCzechAccount({ prefix: '', number: '123', bankCode: '0100' })).toBe('123/0100')
  })
})

describe('bank codes', () => {
  it('has the big banks', () => {
    expect(BANK_CODES.length).toBeGreaterThan(20)
    expect(findBank('0800')?.bic).toBe('GIBACZPX')
    expect(findBank('0100')?.name).toMatch(/Komerční/)
    expect(isKnownBankCode('2010')).toBe(true) // Fio
    expect(isKnownBankCode('9999')).toBe(false)
  })
})
