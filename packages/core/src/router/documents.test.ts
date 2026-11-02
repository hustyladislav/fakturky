import { type DbHandle, schema } from '@fakturky/db'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { clientFor, createTestDb, seedOrg } from '../testing'

let handle: DbHandle
let orgA: string
let orgB: string
const principal = (organizationId: string) => ({
  userId: 'user-1',
  organizationId,
  via: 'session' as const,
})

async function profile(orgId: string, vatStatus: 'payer' | 'non_payer' = 'non_payer') {
  await handle.db.insert(schema.businessProfile).values({
    organizationId: orgId,
    legalName: 'Dodavatel s.r.o.',
    ico: '27082440',
    vatStatus,
  })
}

beforeAll(async () => {
  handle = await createTestDb()
  orgA = await seedOrg(handle, 'doc-a')
  orgB = await seedOrg(handle, 'doc-b')
  await profile(orgA)
  await profile(orgB, 'payer')
})
afterAll(() => handle.close())

const line = { description: 'Práce', quantity: '2', unitPrice: '1000', vatRate: '21' }

async function draft(orgId: string, extra: Record<string, unknown> = {}) {
  const api = clientFor(handle, principal(orgId))
  const c = await api.contacts.create({ name: 'Odběratel a.s.', ico: '12345678' })
  return api.documents.createDraft({ contactId: c.id, lines: [line], ...extra })
}

describe('documents', () => {
  test('non-payer drafts ignore VAT; payer computes recap', async () => {
    const a = await draft(orgA)
    expect(a.total).toBe('2000.0000')
    expect(a.vatTotal).toBe('0.0000')
    expect(a.status).toBe('draft')
    expect(a.number).toBeNull()
    const b = await draft(orgB)
    expect(b.subtotal).toBe('2000.0000')
    expect(b.vatTotal).toBe('420.0000')
    expect(b.total).toBe('2420.0000')
    expect(b.vatRecap).toHaveLength(1)
  })

  test('proformas carry no VAT even for payers; VAT status is recomputed at issue', async () => {
    const api = clientFor(handle, principal(orgB))
    const c = await api.contacts.create({ name: 'Z' })
    const pf = await api.documents.createDraft({ type: 'proforma', contactId: c.id, lines: [line] })
    expect(pf.vatTotal).toBe('0.0000')
    expect(pf.vatMode).toBe('none')
    const inv = await api.documents.createDraft({ contactId: c.id, lines: [line] })
    expect(inv.total).toBe('2420.0000')
    await handle.db
      .update(schema.businessProfile)
      .set({ vatStatus: 'non_payer' })
      .where(eq(schema.businessProfile.organizationId, orgB))
    const issued = await api.documents.issue({ id: inv.id })
    expect(issued.total).toBe('2000.0000')
    expect(issued.vatMode).toBe('none')
    await handle.db
      .update(schema.businessProfile)
      .set({ vatStatus: 'payer' })
      .where(eq(schema.businessProfile.organizationId, orgB))
  })

  test('concurrent first issues get distinct numbers from one series', async () => {
    const org = await seedOrg(handle, 'doc-race')
    await profile(org)
    const api = clientFor(handle, principal(org))
    const c = await api.contacts.create({ name: 'R' })
    const ds = await Promise.all(
      [1, 2, 3].map(() => api.documents.createDraft({ contactId: c.id, lines: [line] })),
    )
    const issued = await Promise.all(ds.map((d) => api.documents.issue({ id: d.id })))
    expect(new Set(issued.map((i) => i.number)).size).toBe(3)
  })

  test('issue allocates sequential numbers, VS, snapshots and a public token', async () => {
    const api = clientFor(handle, principal(orgA))
    await api.bankAccounts.create({ label: 'Hlavní', account: '19-2000145399/0800' })
    const d1 = await draft(orgA)
    const d2 = await draft(orgA)
    const i1 = await api.documents.issue({ id: d1.id })
    const i2 = await api.documents.issue({ id: d2.id })
    const year = new Date().getFullYear()
    expect(i1.number).toMatch(new RegExp(`^${year}-\\d{4}$`))
    expect(Number(i2.number?.slice(-4))).toBe(Number(i1.number?.slice(-4)) + 1)
    expect(i1.variableSymbol).toBe(i1.number?.replace(/\D/g, ''))
    expect(i1.supplierSnapshot).toMatchObject({ name: 'Dodavatel s.r.o.' })
    expect(i1.customerSnapshot).toMatchObject({ name: 'Odběratel a.s.' })
    expect(i1.bankSnapshot).toMatchObject({ iban: 'CZ6508000000192000145399' })
    expect(i1.publicToken).toBeTruthy()
    expect(i1.activity.map((x) => x.action)).toEqual(['created', 'issued'])
  })

  test('issued documents are immutable; snapshots survive contact edits', async () => {
    const api = clientFor(handle, principal(orgA))
    const d = await draft(orgA)
    const issued = await api.documents.issue({ id: d.id })
    await expect(api.documents.issue({ id: d.id })).rejects.toMatchObject({ code: 'CONFLICT' })
    await expect(
      api.documents.updateDraft({ id: d.id, patch: { introText: 'x' } }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
    await expect(api.documents.delete({ id: d.id })).rejects.toMatchObject({ code: 'CONFLICT' })
    await api.contacts.update({ id: issued.contactId as string, patch: { name: 'Přejmenováno' } })
    const again = await api.documents.get({ id: d.id })
    expect(again.customerSnapshot).toMatchObject({ name: 'Odběratel a.s.' })
  })

  test('issue requires customer, lines, profile', async () => {
    const api = clientFor(handle, principal(orgA))
    const empty = await api.documents.createDraft({ lines: [] })
    await expect(api.documents.issue({ id: empty.id })).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
    })
    const noProfileOrg = await seedOrg(handle, 'doc-np')
    const np = clientFor(handle, principal(noProfileOrg))
    const c = await np.contacts.create({ name: 'X' })
    const d = await np.documents.createDraft({ contactId: c.id, lines: [line] })
    await expect(np.documents.issue({ id: d.id })).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
    })
  })

  test('partial payment, full payment, unpaid, cancel', async () => {
    const api = clientFor(handle, principal(orgA))
    const issued = await api.documents.issue({ id: (await draft(orgA)).id })
    const part = await api.documents.markPaid({ id: issued.id, amount: '500' })
    expect(part.displayStatus).toBe('partially_paid')
    expect(part.remaining).toBe('1500.00')
    const full = await api.documents.markPaid({ id: issued.id, paidOn: '2026-01-05' })
    expect(full.status).toBe('paid')
    expect(full.payments).toHaveLength(2)
    const reopened = await api.documents.markUnpaid({ id: issued.id })
    expect(reopened.status).toBe('issued')
    expect(reopened.payments).toHaveLength(0)
    const cancelled = await api.documents.cancel({ id: issued.id })
    expect(cancelled.displayStatus).toBe('cancelled')
  })

  test('markUnpaid with a paymentId removes only that payment', async () => {
    const api = clientFor(handle, principal(orgA))
    const issued = await api.documents.issue({ id: (await draft(orgA)).id })
    await api.documents.markPaid({ id: issued.id, amount: '500' })
    const full = await api.documents.markPaid({ id: issued.id })
    const last = full.payments.find((p) => Number(p.amount) === 1500)
    const undone = await api.documents.markUnpaid({ id: issued.id, paymentId: last?.id })
    expect(undone.status).toBe('issued')
    expect(undone.payments.map((p) => Number(p.amount))).toEqual([500])
    expect(undone.remaining).toBe('1500.00')
  })

  test('a partial credit note credits a VAT-inclusive amount, spread over the rates', async () => {
    const org = await seedOrg(handle, 'doc-partial-cn')
    await profile(org, 'payer')
    const api = clientFor(handle, principal(org))
    const c = await api.contacts.create({
      name: 'Odběratel a.s.',
      ico: '12345678',
      address: { street: 'Hlavní 1', city: 'Praha', zip: '11000' },
    })
    const inv = await api.documents.issue({
      id: (
        await api.documents.createDraft({
          contactId: c.id,
          lines: [
            { description: 'A', quantity: '1', unitPrice: '1000', vatRate: '21' },
            { description: 'B', quantity: '1', unitPrice: '1000', vatRate: '12' },
          ],
        })
      ).id,
    })
    expect(inv.total).toBe('2330.0000')
    const cn = await api.documents.createCreditNote({ id: inv.id, amount: '1000', reason: 'Sleva' })
    expect(cn.total).toBe('-1000.0000')
    expect(cn.roundTotal).toBe(false)
    expect(cn.vatRecap.map((r) => [r.vatRate, Number(r.total)])).toEqual([
      ['21', -519.31],
      ['12', -480.69],
    ])
    expect(Number(cn.vatTotal)).toBeCloseTo(-141.63, 2)
    // Drafts count against what is still creditable.
    await expect(
      api.documents.createCreditNote({ id: inv.id, amount: '1500' }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    })
    await expect(api.documents.createCreditNote({ id: inv.id, amount: '0' })).rejects.toMatchObject(
      {
        code: 'BAD_REQUEST',
      },
    )
  })

  test('overdue is derived from the due date', async () => {
    const api = clientFor(handle, principal(orgA))
    const d = await draft(orgA, { issueDate: '2020-01-01', dueDate: '2020-01-15' })
    const issued = await api.documents.issue({ id: d.id })
    expect(issued.displayStatus).toBe('overdue')
    const overdue = await api.documents.list({ filter: 'overdue' })
    expect(overdue.some((x) => x.id === d.id)).toBe(true)
    expect(issued.number).toMatch(/^2020-/)
  })

  test('foreign currency needs a rate; duplicate resets to draft; delete draft', async () => {
    const api = clientFor(handle, principal(orgA))
    const eur = await draft(orgA, { currency: 'eur' })
    await expect(api.documents.issue({ id: eur.id })).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
    })
    const withRate = await api.documents.updateDraft({
      id: eur.id,
      patch: { exchangeRate: '25.1' },
    })
    expect(withRate.totalCzk).toBe('50200.0000')
    const dup = await api.documents.duplicate({ id: eur.id })
    expect(dup.status).toBe('draft')
    expect(dup.id).not.toBe(eur.id)
    expect(dup.lines).toHaveLength(1)
    await api.documents.delete({ id: dup.id })
    await expect(api.documents.get({ id: dup.id })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  test('tenant isolation', async () => {
    const a = clientFor(handle, principal(orgA))
    const b = clientFor(handle, principal(orgB))
    const mine = await draft(orgA)
    await expect(b.documents.get({ id: mine.id })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(b.documents.issue({ id: mine.id })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(b.documents.delete({ id: mine.id })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(b.documents.duplicate({ id: mine.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    expect((await b.documents.list({})).some((x) => x.id === mine.id)).toBe(false)
    // cross-tenant references are rejected too
    const theirContact = await b.contacts.create({ name: 'Cizí' })
    await expect(
      a.documents.updateDraft({ id: mine.id, patch: { contactId: theirContact.id } }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('assistant drafts', () => {
  test('drafts created via the assistant are flagged in list and get', async () => {
    const human = clientFor(handle, principal(orgA))
    const bot = clientFor(handle, { ...principal(orgA), via: 'assistant' })
    const c = await human.contacts.create({ name: 'Asistent s.r.o.' })
    const byBot = await bot.documents.createDraft({ contactId: c.id, lines: [line] })
    const byHuman = await human.documents.createDraft({ contactId: c.id, lines: [line] })
    const list = await human.documents.list({ filter: 'draft', limit: 200, offset: 0 })
    expect(list.find((d) => d.id === byBot.id)?.viaAssistant).toBe(true)
    expect(list.find((d) => d.id === byHuman.id)?.viaAssistant).toBe(false)
    expect((await human.documents.get({ id: byBot.id })).viaAssistant).toBe(true)
  })

  test('duplicates made by the assistant keep the provenance', async () => {
    const human = clientFor(handle, principal(orgA))
    const bot = clientFor(handle, { ...principal(orgA), via: 'assistant' })
    const c = await human.contacts.create({ name: 'Kopie s.r.o.' })
    const src = await human.documents.createDraft({ contactId: c.id, lines: [line] })
    const copy = await bot.documents.duplicate({ id: src.id })
    expect((await human.documents.get({ id: copy.id })).viaAssistant).toBe(true)
    expect((await human.documents.get({ id: src.id })).viaAssistant).toBe(false)
  })
})
