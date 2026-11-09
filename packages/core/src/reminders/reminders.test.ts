import { type DbHandle, schema } from '@fakturky/db'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, expect, test } from 'vitest'
import type { SendInvoiceArgs } from '../context'
import { remindersRepo } from './repo'
import { clientFor, createTestDb, seedOrg } from '../testing'

let handle: DbHandle
beforeAll(async () => {
  handle = await createTestDb()
})
afterAll(() => handle.close())

test('reminders: opt-in only, escalating schedule, max three, CSV exports are formula-safe', async () => {
  const org = await seedOrg(handle, 'rem-a')
  const optedOut = await seedOrg(handle, 'rem-b')
  for (const [id, auto] of [
    [org, true],
    [optedOut, false],
  ] as const) {
    await handle.db
      .insert(schema.businessProfile)
      .values({ organizationId: id, legalName: '=EVIL()', autoRemind: auto })
  }
  const sent: SendInvoiceArgs[] = []
  const services = {
    publicBaseUrl: 'https://x.test',
    renderPdf: async () => new Uint8Array([1]),
    sendInvoice: async (a: SendInvoiceArgs) => void sent.push(a),
  }
  const line = [{ description: 'x', quantity: '1', unitPrice: '100' }]
  const make = async (o: string) => {
    const api = clientFor(handle, { userId: 'u', organizationId: o, via: 'session' }, services)
    const c = await api.contacts.create({ name: '=HYPERLINK("x")', emails: ['a@example.com'] })
    const d = await api.documents.createDraft({
      contactId: c.id,
      issueDate: '2026-01-01',
      dueDate: '2026-01-10',
      lines: line,
    })
    return { api, doc: await api.documents.issue({ id: d.id }) }
  }
  const a = await make(org)
  await make(optedOut)

  expect(await remindersRepo.runDue(handle.db, services, '2026-01-12')).toEqual([]) // 2 days late
  expect(
    (await remindersRepo.runDue(handle.db, services, '2026-01-13')).map((r) => r.sent),
  ).toEqual([true])
  // Same-day overlap and the following days must not send again (min gap).
  expect(await remindersRepo.runDue(handle.db, services, '2026-01-13')).toEqual([])
  expect(await remindersRepo.runDue(handle.db, services, '2026-01-14')).toEqual([])
  expect(sent.filter((s) => s.isReminder)).toHaveLength(1)
  expect(sent.every((s) => s.number === a.doc.number)).toBe(true)

  const csv = (await a.api.exports.contacts({})).csv
  expect(csv.startsWith('﻿Název;')).toBe(true)
  expect(csv).toContain(`"'=HYPERLINK(""x"")"`)
  const docs = (await a.api.exports.documents({})).csv
  expect(docs).toContain(a.doc.number as string)
  expect(docs).not.toContain('ORG-B')
  await handle.db
    .update(schema.businessProfile)
    .set({ autoRemind: false })
    .where(eq(schema.businessProfile.organizationId, org))
})

test('organization JSON export contains own data only and no bearer secrets', async () => {
  const org = await seedOrg(handle, 'json-a')
  const other = await seedOrg(handle, 'json-b')
  for (const id of [org, other]) {
    await handle.db
      .insert(schema.businessProfile)
      .values({ organizationId: id, legalName: `Firma ${id}` })
  }
  const api = clientFor(handle, { userId: 'u', organizationId: org, via: 'session' })
  const theirs = clientFor(handle, { userId: 'u', organizationId: other, via: 'session' })
  const c = await api.contacts.create({ name: 'Můj klient' })
  const d = await api.documents.issue({
    id: (
      await api.documents.createDraft({
        contactId: c.id,
        privateNote: 'moje poznámka',
        lines: [{ description: 'x', quantity: '1', unitPrice: '10' }],
      })
    ).id,
  })
  await theirs.contacts.create({ name: 'Cizí klient' })
  const out = JSON.parse((await api.exports.organization({})).json)
  expect(out.format).toBe('fakturky-export/1')
  expect(out.contacts.map((x: { name: string }) => x.name)).toEqual(['Můj klient'])
  expect(out.documents[0].lines).toHaveLength(1)
  expect(out.documents[0].activity.map((a: { action: string }) => a.action)).toContain('issued')
  expect(out.numberSeriesCounters.length).toBeGreaterThan(0)
  expect(out.documents[0].privateNote).toBe('moje poznámka')
  const raw = JSON.stringify(out)
  expect(raw).not.toContain(d.publicToken as string)
  expect(raw).not.toContain('Cizí klient')
  expect(raw).not.toContain('publicToken')
})
