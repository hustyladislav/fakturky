import { describe, expect, test } from 'vitest'
import {
  findByVariableSymbol,
  type MatchDocument,
  type MatchTransaction,
  nameSimilarity,
  suggestMatches,
} from '../src/bank/index.ts'

const doc = (o: Partial<MatchDocument> & { id: string }): MatchDocument => ({
  number: null,
  variableSymbol: null,
  currency: 'CZK',
  remaining: '1210.00',
  customerName: null,
  ...o,
})
const tx = (o: Partial<MatchTransaction> = {}): MatchTransaction => ({
  amount: '1210.00',
  currency: 'CZK',
  variableSymbol: null,
  counterpartyName: null,
  message: null,
  ...o,
})

describe('variable symbol rule', () => {
  const docs = [doc({ id: 'a', variableSymbol: '20260001' }), doc({ id: 'b', variableSymbol: '20260002' })]

  test('exact VS, ignoring leading zeros', () => {
    expect(findByVariableSymbol(tx({ variableSymbol: '20260002' }), docs)?.id).toBe('b')
    expect(findByVariableSymbol(tx({ variableSymbol: '0020260001' }), docs)?.id).toBe('a')
  })

  test('works for partial payments and overpayments', () => {
    expect(findByVariableSymbol(tx({ variableSymbol: '20260001', amount: '100.00' }), docs)?.id).toBe('a')
    expect(findByVariableSymbol(tx({ variableSymbol: '20260001', amount: '9999.00' }), docs)?.id).toBe('a')
  })

  test('never for debits, other currencies, unknown or ambiguous symbols', () => {
    expect(findByVariableSymbol(tx({ variableSymbol: '20260001', amount: '-10' }), docs)).toBeNull()
    expect(findByVariableSymbol(tx({ variableSymbol: '20260001', currency: 'EUR' }), docs)).toBeNull()
    expect(findByVariableSymbol(tx({ variableSymbol: '999' }), docs)).toBeNull()
    expect(findByVariableSymbol(tx(), docs)).toBeNull()
    const dup = [...docs, doc({ id: 'c', variableSymbol: '20260001' })]
    expect(findByVariableSymbol(tx({ variableSymbol: '20260001' }), dup)).toBeNull()
  })

  test('skips fully paid documents', () => {
    expect(
      findByVariableSymbol(tx({ variableSymbol: '20260001' }), [
        doc({ id: 'a', variableSymbol: '20260001', remaining: '0.00' }),
      ]),
    ).toBeNull()
  })
})

describe('name similarity', () => {
  test.each([
    ['Novák Jan', 'Jan Novák', 1],
    ['NOVAK JAN', 'Jan Novák', 1],
    ['Alfa s.r.o.', 'ALFA, spol. s r.o.', 1],
    ['Alfa a.s.', 'Beta a.s.', 0],
    [null, 'x', 0],
  ])('%s ~ %s', (a, b, min) => {
    const s = nameSimilarity(a, b)
    if (min === 0) expect(s).toBe(0)
    else expect(s).toBeGreaterThanOrEqual(0.9)
  })
})

describe('suggestions', () => {
  const docs = [
    doc({ id: 'inv1', number: '2026-0001', variableSymbol: '20260001', remaining: '1210.00', customerName: 'Alfa s.r.o.' }),
    doc({ id: 'inv2', number: '2026-0002', variableSymbol: '20260002', remaining: '500.00', customerName: 'Beta a.s.' }),
    doc({ id: 'eur', number: '2026-0003', variableSymbol: '20260003', remaining: '1210.00', currency: 'EUR', customerName: 'Alfa s.r.o.' }),
  ]

  test('amount + similar name is a suggestion, amount alone is not', () => {
    const s = suggestMatches(tx({ counterpartyName: 'ALFA SRO' }), docs)
    expect(s.map((x) => x.document.id)).toEqual(['inv1'])
    expect(s[0]?.reasons).toEqual(['amount', 'name'])
    expect(suggestMatches(tx({ counterpartyName: 'Someone else' }), docs)).toEqual([])
  })

  test('invoice number or VS written into the message', () => {
    const byNumber = suggestMatches(tx({ amount: '700.00', message: 'Uhrada faktury 2026-0002' }), docs)
    expect(byNumber[0]?.document.id).toBe('inv2')
    expect(byNumber[0]?.reasons).toEqual(['reference_in_message'])
    const byVs = suggestMatches(tx({ amount: '1.00', message: 'INV 20260001' }), docs)
    expect(byVs[0]?.document.id).toBe('inv1')
  })

  test('never crosses currencies and ignores debits', () => {
    expect(suggestMatches(tx({ currency: 'EUR', counterpartyName: 'Alfa' }), docs)[0]?.document.id).toBe('eur')
    expect(suggestMatches(tx({ amount: '-1210.00', counterpartyName: 'Alfa' }), docs)).toEqual([])
  })

  test('strongest signal first', () => {
    const s = suggestMatches(
      tx({ counterpartyName: 'Alfa', message: 'faktura 2026-0001', variableSymbol: '20260001' }),
      docs,
    )
    expect(s[0]?.document.id).toBe('inv1')
    expect(s[0]?.score).toBeGreaterThan(100)
  })
})
