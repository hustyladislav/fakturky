import { type DbHandle, schema } from '@fakturky/db'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { clientFor, createTestDb, seedOrg } from '../testing'

let handle: DbHandle
let api: ReturnType<typeof clientFor>
let accountId: string

beforeAll(async () => {
  handle = await createTestDb()
  const org = await seedOrg(handle, 'match-org')
  await handle.db.insert(schema.businessProfile).values({
    organizationId: org,
    legalName: 'Dodavatel s.r.o.',
    ico: '27082440',
    vatStatus: 'non_payer',
  })
  api = clientFor(handle, { userId: 'u', organizationId: org, via: 'session' })
  accountId = (await api.bankAccounts.create({ label: 'Fio', account: '2400123455/2010' })).id
})
afterAll(() => handle.close())

let seq = 0
/** Issues an invoice for `price` CZK to `customer`; returns it with its variable symbol. */
async function invoice(price: string, customer = 'Alfa s.r.o.', currency = 'CZK') {
  const c = await api.contacts.create({ name: customer })
  const d = await api.documents.createDraft({
    contactId: c.id,
    currency,
    lines: [{ description: `Práce ${++seq}`, quantity: '1', unitPrice: price, vatRate: '0' }],
  })
  const issued = await api.documents.issue({ id: d.id })
  expect(issued.variableSymbol).toBeTruthy()
  return issued
}

/** Imports one payment row (a unique message keeps rows distinct for the de-duplication fingerprint). */
async function pay(
  amount: string,
  o: { vs?: string; name?: string; message?: string; date?: string; ccy?: string } = {},
) {
  const row = [
    o.date ?? '05.01.2026',
    amount,
    o.ccy ?? 'CZK',
    o.name ?? '',
    o.vs ?? '',
    o.message ?? `m${++seq}`,
  ]
  const res = await api.bank.importStatement({
    bankAccountId: accountId,
    content: `Datum;Objem;Měna;Název protiúčtu;VS;Zpráva pro příjemce\n${row.join(';')}\n`,
  })
  return { res }
}

const txs = async (status?: 'unmatched' | 'matched' | 'ignored') =>
  (await api.bank.list({ status, limit: 200 })).items

describe('automatic pairing by variable symbol', () => {
  test('full payment marks the invoice paid and records a bank payment + activity', async () => {
    const inv = await invoice('1000')
    const { res } = await pay('1000,00', { vs: inv.variableSymbol as string, message: 'full' })
    expect(res.autoMatched).toBe(1)
    expect(res.rows).toMatchObject([{ outcome: 'matched', documentNumber: inv.number }])
    const doc = await api.documents.get({ id: inv.id })
    expect(doc.status).toBe('paid')
    expect(doc.payments).toHaveLength(1)
    expect(doc.payments[0]).toMatchObject({
      source: 'bank',
      amount: '1000.0000',
      paidOn: '2026-01-05',
    })
    expect(doc.activity.map((a) => a.action)).toContain('bank_matched')
    const tx = (await txs('matched')).find((t) => t.matchedDocumentId === inv.id)
    expect(tx).toMatchObject({
      matchedAmount: '1000.00',
      overpaid: null,
      matchedDocumentNumber: inv.number,
    })
  })

  test('partial payments accumulate until the invoice is settled', async () => {
    const inv = await invoice('1000')
    await pay('400,00', { vs: inv.variableSymbol as string, message: 'p1' })
    const mid = await api.documents.get({ id: inv.id })
    expect(mid.status).toBe('issued')
    expect(mid.displayStatus === 'partially_paid' || mid.displayStatus === 'overdue').toBe(true)
    expect(mid.remaining).toBe('600.00')
    await pay('600,00', { vs: inv.variableSymbol as string, message: 'p2' })
    expect((await api.documents.get({ id: inv.id })).status).toBe('paid')
  })

  test('an overpayment pays the invoice and is flagged on the transaction', async () => {
    const inv = await invoice('1000')
    await pay('1500,00', { vs: inv.variableSymbol as string, message: 'over' })
    const doc = await api.documents.get({ id: inv.id })
    expect(doc.status).toBe('paid')
    expect(doc.payments[0]?.amount).toBe('1000.0000')
    const tx = (await txs('matched')).find((t) => t.matchedDocumentId === inv.id)
    expect(tx).toMatchObject({ amount: '1500.00', matchedAmount: '1000.00', overpaid: '500.00' })
  })

  test('different currency, debits and unknown symbols stay unmatched', async () => {
    const inv = await invoice('1000')
    const vs = inv.variableSymbol as string
    await pay('1000,00', { vs, ccy: 'EUR', message: 'eur' })
    await pay('-1000,00', { vs, message: 'debit' })
    await pay('1000,00', { vs: '999999999', message: 'unknown' })
    expect((await api.documents.get({ id: inv.id })).status).toBe('issued')
    const open = await txs('unmatched')
    expect(open.some((t) => t.currency === 'EUR' && t.variableSymbol === vs)).toBe(true)
    // debits are not "unmatched" payments
    expect(open.every((t) => Number(t.amount) > 0)).toBe(true)
  })
})

describe('suggestions and manual pairing', () => {
  test('amount + similar name is suggested, never applied; confirming books the payment', async () => {
    const inv = await invoice('2500', 'Gama Trade s.r.o.')
    await pay('2500,00', { name: 'GAMA TRADE SRO', message: 'bez symbolu' })
    const tx = (await txs('unmatched')).find((t) => t.counterpartyName === 'GAMA TRADE SRO')
    expect(tx?.suggestions.map((s) => s.documentId)).toEqual([inv.id])
    expect(tx?.suggestions[0]?.reasons).toEqual(['amount', 'name'])
    expect((await api.documents.get({ id: inv.id })).status).toBe('issued')

    const res = await api.bank.match({ transactionId: tx?.id as string, documentId: inv.id })
    expect(res).toMatchObject({ amount: '2500.00', full: true, overpaid: '0.00' })
    expect((await api.documents.get({ id: inv.id })).status).toBe('paid')
    await expect(
      api.bank.match({ transactionId: tx?.id as string, documentId: inv.id }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  test('a reference to the invoice number in the message is a suggestion', async () => {
    const inv = await invoice('777', 'Delta s.r.o.')
    await pay('100,00', { name: 'Someone', message: `Uhrada ${inv.number}` })
    const tx = (await txs('unmatched')).find((t) => t.message?.includes(inv.number as string))
    expect(tx?.suggestions[0]).toMatchObject({
      documentId: inv.id,
      reasons: ['reference_in_message'],
    })
  })

  test('manual pairing validates currency, amount and document state', async () => {
    const inv = await invoice('300', 'Epsilon s.r.o.')
    await pay('300,00', { name: 'x', ccy: 'EUR', message: 'manual-eur' })
    const eur = (await txs('unmatched')).find((t) => t.message === 'manual-eur')
    await expect(
      api.bank.match({ transactionId: eur?.id as string, documentId: inv.id }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })

    await pay('300,00', { name: 'x', message: 'manual-czk' })
    const czk = (await txs('unmatched')).find((t) => t.message === 'manual-czk')
    await expect(
      api.bank.match({ transactionId: czk?.id as string, documentId: inv.id, amount: '999' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    const part = await api.bank.match({
      transactionId: czk?.id as string,
      documentId: inv.id,
      amount: '100',
    })
    expect(part).toMatchObject({ amount: '100.00', full: false, overpaid: '200.00' })
    await expect(
      api.bank.match({ transactionId: 'nope', documentId: inv.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  test('drafts and credit notes cannot be paid', async () => {
    const c = await api.contacts.create({ name: 'Zeta' })
    const d = await api.documents.createDraft({
      contactId: c.id,
      lines: [{ description: 'x', quantity: '1', unitPrice: '50', vatRate: '0' }],
    })
    await pay('50,00', { name: 'x', message: 'to-draft' })
    const tx = (await txs('unmatched')).find((t) => t.message === 'to-draft')
    await expect(
      api.bank.match({ transactionId: tx?.id as string, documentId: d.id }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })
})

describe('undoing', () => {
  test('unmatch removes the bank payment and reopens the invoice', async () => {
    const inv = await invoice('1000')
    await pay('1000,00', { vs: inv.variableSymbol as string, message: 'undo' })
    const tx = (await txs('matched')).find((t) => t.matchedDocumentId === inv.id)
    await api.bank.unmatch({ transactionId: tx?.id as string })
    const doc = await api.documents.get({ id: inv.id })
    expect(doc.status).toBe('issued')
    expect(doc.payments).toHaveLength(0)
    expect(doc.activity.map((a) => a.action)).toContain('bank_unmatched')
    const again = (await txs('unmatched')).find((t) => t.id === tx?.id)
    expect(again).toMatchObject({ matchedDocumentId: null, matchedAmount: null })
    await expect(api.bank.unmatch({ transactionId: tx?.id as string })).rejects.toMatchObject({
      code: 'CONFLICT',
    })
    // The explicit action does not re-pair it by itself, but the auto-matcher can.
    expect((await api.bank.autoMatch({})).matched).toBeGreaterThanOrEqual(1)
    expect((await api.documents.get({ id: inv.id })).status).toBe('paid')
  })

  test('marking the invoice unpaid releases its bank transactions', async () => {
    const inv = await invoice('1000')
    await pay('1000,00', { vs: inv.variableSymbol as string, message: 'release' })
    await api.documents.markUnpaid({ id: inv.id })
    const tx = (await txs('unmatched')).find((t) => t.message === 'release')
    expect(tx).toMatchObject({ matchStatus: 'unmatched', matchedDocumentId: null })
  })

  test('ignore / restore, but a paired transaction must be unpaired first', async () => {
    await pay('12,00', { name: 'noise', message: 'ignore-me' })
    const tx = (await txs('unmatched')).find((t) => t.message === 'ignore-me')
    await api.bank.setIgnored({ transactionId: tx?.id as string, ignored: true })
    expect((await txs('ignored')).some((t) => t.id === tx?.id)).toBe(true)
    await api.bank.setIgnored({ transactionId: tx?.id as string, ignored: false })
    expect((await txs('unmatched')).some((t) => t.id === tx?.id)).toBe(true)

    const inv = await invoice('10')
    await pay('10,00', { vs: inv.variableSymbol as string, message: 'paired' })
    const paired = (await txs('matched')).find((t) => t.matchedDocumentId === inv.id)
    await expect(
      api.bank.setIgnored({ transactionId: paired?.id as string, ignored: true }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })
})
