import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import {
  decodeBankFile,
  detectCsvFormat,
  parseAbo,
  parseBankAmount,
  parseBankCsv,
  parseBankDate,
  parseCamt053,
  parseStatement,
  StatementParseError,
} from '../src/bank/index.ts'

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/bank/${name}`, import.meta.url), 'utf8')

describe('amount and date parsing', () => {
  test.each([
    ['12 100,00', '12100.00'],
    ['-1.210,50', '-1210.50'],
    ['1,210.50', '1210.50'],
    ['+500', '500.00'],
    ['(120.00)', '-120.00'],
    ['1 000,50 CZK', '1000.50'],
    ['0,00', '0.00'],
  ])('amount %s', (raw, out) => expect(parseBankAmount(raw)).toBe(out))

  test('garbage amounts are rejected', () => {
    expect(parseBankAmount('abc')).toBeNull()
    expect(parseBankAmount('')).toBeNull()
    expect(parseBankAmount('1.2.3')).toBeNull()
  })

  test.each([
    ['05.01.2026', '2026-01-05'],
    ['5. 1. 2026', '2026-01-05'],
    ['2026-01-05 10:22:33', '2026-01-05'],
    ['2026-01-05T10:00:00+0100', '2026-01-05'],
    ['05/01/2026', '2026-01-05'],
    ['Jan 10, 2026', '2026-01-10'],
    ['10 Jan 2026', '2026-01-10'],
    ['31.02.2026', null],
    ['hello', null],
  ])('date %s', (raw, out) => expect(parseBankDate(raw)).toBe(out))

  test('decodes Windows-1250 when the bytes are not UTF-8', () => {
    const cp1250 = Uint8Array.from([0x50, 0xf8, 0xed, 0x6a, 0x65, 0x6d, 0x63, 0x65]) // "Příjemce"
    expect(decodeBankFile(cp1250)).toBe('Příjemce')
    expect(decodeBankFile(new TextEncoder().encode('﻿Příjemce'))).toBe('Příjemce')
  })
})

describe('CSV', () => {
  test('Fio: skips the account preamble, reads symbols, ids and the IBAN', () => {
    const s = parseStatement(fixture('fio.csv'))
    expect(s.format).toBe('fio-csv')
    expect(s.iban).toBe('CZ8720100000002400123455')
    expect(s.warnings).toEqual([])
    expect(s.transactions).toHaveLength(4)
    expect(s.transactions[0]).toEqual({
      bookedOn: '2026-01-05',
      amount: '12100.00',
      currency: 'CZK',
      variableSymbol: '20260001',
      constantSymbol: '308',
      specificSymbol: null,
      counterpartyAccount: '1234567890/0800',
      counterpartyName: 'Novák Jan s.r.o.',
      message: 'Platba faktury',
      externalId: '1001',
    })
    expect(s.transactions[1]).toMatchObject({ amount: '-350.50', counterpartyAccount: null })
    expect(s.transactions[2]).toMatchObject({
      amount: '1000.00',
      counterpartyName: 'Dodavatel "A"',
      counterpartyAccount: '19-2000145399/0800',
      specificSymbol: '123',
    })
    expect(s.transactions[3]).toMatchObject({ currency: 'EUR', amount: '500.00' })
  })

  test('Revolut personal: dot decimals, only completed rows, ISO timestamps', () => {
    const s = parseStatement(fixture('revolut.csv'))
    expect(s.format).toBe('revolut-csv')
    expect(s.transactions.map((t) => [t.bookedOn, t.amount, t.currency])).toEqual([
      ['2026-01-03', '1250.50', 'EUR'],
      ['2026-01-05', '-9.99', 'EUR'],
      ['2026-01-07', '1000.00', 'EUR'],
    ])
    expect(s.transactions[0]?.counterpartyName).toBe('Payment from ACME GmbH')
    expect(s.transactions[2]?.counterpartyName).toBe('Top-up by *1234, "Visa"')
  })

  test('Revolut Business: id, payer, reference, month-name dates', () => {
    const s = parseStatement(fixture('revolut-business.csv'))
    expect(s.format).toBe('revolut-csv')
    expect(s.transactions).toEqual([
      {
        bookedOn: '2026-01-10',
        amount: '121.00',
        currency: 'EUR',
        variableSymbol: null,
        constantSymbol: null,
        specificSymbol: null,
        counterpartyAccount: null,
        counterpartyName: 'Client Ltd',
        message: 'INV 20260005',
        externalId: '6f1c0b1a-0001',
      },
    ])
  })

  test('Raiffeisenbank', () => {
    const s = parseStatement(fixture('raiffeisen.csv'))
    expect(s.format).toBe('raiffeisen-csv')
    expect(s.transactions[0]).toMatchObject({
      bookedOn: '2026-01-06',
      amount: '2420.00',
      variableSymbol: '20260007',
      constantSymbol: '308',
      counterpartyAccount: '987654321/0100',
      counterpartyName: 'Alfa a.s.',
      externalId: 'RB-0001',
    })
    expect(s.transactions[1]?.amount).toBe('-199.90')
  })

  test('ČSOB', () => {
    const s = parseStatement(fixture('csob.csv'))
    expect(s.format).toBe('csob-csv')
    expect(s.transactions[0]).toMatchObject({
      bookedOn: '2026-01-08',
      amount: '3630.00',
      variableSymbol: '20260008',
      counterpartyAccount: '55555555/0800',
      counterpartyName: 'Beta s.r.o.',
      message: 'Faktura 20260008',
    })
    expect(s.transactions[1]?.amount).toBe('-1500.00')
  })

  test('Komerční banka', () => {
    const s = parseStatement(fixture('kb.csv'))
    expect(s.format).toBe('kb-csv')
    expect(s.transactions[0]).toMatchObject({
      bookedOn: '2026-01-10',
      amount: '1815.00',
      variableSymbol: '20260009',
      counterpartyAccount: '4444444444/0600',
      counterpartyName: 'Gama Trade',
    })
  })

  test('generic CSV needs explicit mapping and a currency', () => {
    expect(() => parseBankCsv(fixture('generic.csv'))).toThrow(StatementParseError)
    const s = parseBankCsv(fixture('generic.csv'), {
      currency: 'czk',
      mapping: {
        date: 'Kdy',
        amount: 'Kolik',
        counterpartyName: 'Od koho',
        message: 'Poznámka k platbě',
        variableSymbol: 'Číslo faktury',
      },
    })
    expect(s.format).toBe('generic-csv')
    expect(s.transactions[0]).toMatchObject({
      bookedOn: '2026-02-01',
      amount: '1000.50',
      currency: 'CZK',
      variableSymbol: '12345',
      counterpartyName: 'Delta s.r.o.',
    })
    expect(s.transactions[1]?.amount).toBe('-20.00')
  })

  test('unreadable rows become warnings, not failures', () => {
    const s = parseBankCsv('Datum;Objem;Měna\n05.01.2026;100,00;CZK\nnope;100,00;CZK\n', {})
    expect(s.transactions).toHaveLength(1)
    expect(s.warnings).toHaveLength(1)
  })

  test('detects formats from headers only', () => {
    expect(detectCsvFormat(['ID pohybu', 'Datum', 'Objem'])).toBe('fio-csv')
    expect(detectCsvFormat(['Foo', 'Bar'])).toBe('generic-csv')
  })
})

/** Builds a 128-column 075 record the way the Czech GPC standard lays it out. */
function gpc075(o: {
  account?: string
  counter?: string
  doc?: string
  minor: number
  code: '1' | '2' | '4' | '5'
  vs?: string
  bank?: string
  ks?: string
  ss?: string
  date: string
  name?: string
  ccy?: string
}) {
  return (
    '075' +
    (o.account ?? '2400123455').padStart(16, '0') +
    (o.counter ?? '1234567890').padStart(16, '0') +
    (o.doc ?? '1').padStart(13, '0') +
    String(o.minor).padStart(12, '0') +
    o.code +
    (o.vs ?? '').padStart(10, '0') +
    (o.bank ?? '0800').padStart(6, '0') +
    (o.ks ?? '0308').padStart(4, '0') +
    (o.ss ?? '').padStart(10, '0') +
    o.date +
    (o.name ?? '').padEnd(20, ' ') +
    (o.ccy ?? '203').padStart(5, '0') +
    '000000'
  )
}

describe('ABO / GPC', () => {
  const header =
    `074${'2400123455'.padStart(16, '0')}${'FIRMA'.padEnd(20)}010126${'0'.padStart(14, '0')}+` +
    `${'0'.padStart(14, '0')}+${'0'.padStart(14, '0')}0${'0'.padStart(14, '0')}+001310126`.padEnd(
      60,
      ' ',
    )
  const text = [
    header,
    gpc075({ minor: 1210000, code: '2', vs: '20260001', date: '050126', name: 'Novak Jan' }),
    `078${'Poznamka k platbe cislo jedna'.padEnd(35)}${'druha cast'.padEnd(35)}`,
    gpc075({ minor: 35050, code: '1', date: '070126', name: 'Karta', ccy: '203' }),
    gpc075({ minor: 50000, code: '2', vs: '77', date: '120126', ccy: '978', counter: '0000192000145399', bank: '0800' }),
    gpc075({ minor: 100, code: '4', date: '130126' }),
    '',
  ].join('\r\n')

  test('parses account, amounts, sign by posting code, symbols and free text', () => {
    const s = parseStatement(text)
    expect(s.format).toBe('abo')
    expect(s.accountNumber).toBe('2400123455')
    expect(s.warnings).toEqual([])
    expect(s.transactions).toHaveLength(4)
    expect(s.transactions[0]).toEqual({
      bookedOn: '2026-01-05',
      amount: '12100.00',
      currency: 'CZK',
      variableSymbol: '20260001',
      constantSymbol: '308',
      specificSymbol: null,
      counterpartyAccount: '1234567890/0800',
      counterpartyName: 'Novak Jan',
      message: 'Poznamka k platbe cislo jedna druha cast',
      externalId: null,
    })
    expect(s.transactions[1]?.amount).toBe('-350.50')
    expect(s.transactions[2]).toMatchObject({ currency: 'EUR', counterpartyAccount: '19-2000145399/0800' })
    expect(s.transactions[3]?.amount).toBe('1.00') // storno of a debit
  })

  test('rejects non-ABO content', () => {
    expect(() => parseAbo('hello world')).toThrow(StatementParseError)
  })
})

describe('CAMT.053', () => {
  const s = parseCamt053(fixture('camt053.xml'))

  test('skips a negative <Amt> instead of emitting a malformed amount', () => {
    const xml = fixture('camt053.xml').replace('<Amt Ccy="EUR">49.90</Amt>', '<Amt Ccy="EUR">-49.90</Amt>')
    const parsed = parseCamt053(xml)
    expect(parsed.transactions).toHaveLength(s.transactions.length - 1)
    expect(parsed.transactions.every((t) => /^-?\d+\.\d{2}$/.test(t.amount))).toBe(true)
    expect(parsed.warnings.some((w) => w.includes('skipped'))).toBe(true)
  })

  test('statement account and booked entries only', () => {
    expect(s.format).toBe('camt053')
    expect(s.iban).toBe('CZ8720100000002400123455')
    expect(s.warnings).toEqual([])
    expect(s.transactions).toHaveLength(4) // pending entry skipped, batch split in two
  })

  test('credit with Czech symbols in EndToEndId, counterparty and entity decoding', () => {
    expect(s.transactions[0]).toEqual({
      bookedOn: '2026-01-05',
      amount: '12100.00',
      currency: 'CZK',
      variableSymbol: '20260001',
      constantSymbol: '308',
      specificSymbol: null,
      counterpartyAccount: '1234567890/0800',
      counterpartyName: 'Novák Jan s.r.o.',
      message: 'Platba faktury & poplatek',
      externalId: 'NTRY-1',
    })
  })

  test('debit is negative, structured reference becomes the VS, counterparty is the creditor', () => {
    expect(s.transactions[1]).toMatchObject({
      amount: '-49.90',
      currency: 'EUR',
      variableSymbol: '5551234',
      counterpartyName: 'Hosting GmbH',
      counterpartyAccount: 'DE89370400440532013000',
    })
  })

  test('batch entries split into one transaction per detail with distinct ids', () => {
    expect(s.transactions.slice(2).map((t) => [t.amount, t.variableSymbol, t.externalId])).toEqual([
      ['1000.00', '111', 'NTRY-4#0'],
      ['2000.00', '222', 'NTRY-4#1'],
    ])
  })

  test('rejects non-CAMT XML and broken input', () => {
    expect(() => parseCamt053('<Foo/>')).toThrow(StatementParseError)
    expect(() => parseCamt053('not xml')).toThrow(StatementParseError)
  })
})
