import { type DbHandle, schema } from '@fakturky/db'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { firstOccurrence, nextOccurrence, recurringRepo } from '../repositories/templates'
import { clientFor, createTestDb, seedOrg } from '../testing'

let handle: DbHandle
beforeAll(async () => {
  handle = await createTestDb()
})
afterAll(() => handle.close())

const principal = (organizationId: string) => ({
  userId: 'u',
  organizationId,
  via: 'session' as const,
})

test('occurrence math clamps to month length', () => {
  expect(nextOccurrence('2026-01-31', 'monthly', 31)).toBe('2026-02-28')
  expect(nextOccurrence('2026-11-15', 'quarterly', 15)).toBe('2027-02-15')
  expect(nextOccurrence('2026-03-10', 'yearly', 10)).toBe('2027-03-10')
  expect(firstOccurrence('2026-11-02', 1)).toBe('2026-12-01')
  expect(firstOccurrence('2026-11-02', 15)).toBe('2026-11-15')
})

test('template → draft, recurring cron run issues once per due date, tenant scoped', async () => {
  const org = await seedOrg(handle, 'tpl-a')
  const other = await seedOrg(handle, 'tpl-b')
  await handle.db.insert(schema.businessProfile).values({ organizationId: org, legalName: 'X' })
  const api = clientFor(handle, principal(org))
  const c = await api.contacts.create({ name: 'Odběratel' })
  const d = await api.documents.createDraft({
    contactId: c.id,
    lines: [{ description: 'Hosting', quantity: '1', unitPrice: '500' }],
  })
  const tpl = await api.templates.createFromDocument({ documentId: d.id, name: 'Měsíční hosting' })
  const used = await api.templates.use({ id: tpl.id })
  expect(used.status).toBe('draft')
  expect(used.lines[0]?.description).toBe('Hosting')
  expect(used.id).not.toBe(d.id)

  const rule = await api.recurring.create({
    templateId: tpl.id,
    dayOfMonth: 1,
    startOn: '2026-01-01',
    autoIssue: true,
  })
  expect(rule.nextRunOn).toBe('2026-01-01')
  const first = await recurringRepo.runDue(handle.db, '2026-01-01')
  expect(first.filter((r) => r.ruleId === rule.id)).toEqual([
    expect.objectContaining({ issued: true }),
  ])
  expect(await recurringRepo.runDue(handle.db, '2026-01-01')).toEqual([])
  const after = (await api.recurring.list({})).find((r) => r.id === rule.id)
  expect(after?.nextRunOn).toBe('2026-02-01')
  const issued = await api.documents.list({ filter: 'unpaid' })
  expect(issued.some((x) => x.issueDate === '2026-01-01')).toBe(true)

  // Frequency and day can be changed after creation; an explicit next run wins over the recomputed one.
  const moved = await api.recurring.update({
    id: rule.id,
    frequency: 'quarterly',
    dayOfMonth: 15,
    nextRunOn: '2026-04-15',
  })
  expect([moved.frequency, moved.dayOfMonth, moved.nextRunOn]).toEqual([
    'quarterly',
    15,
    '2026-04-15',
  ])
  const paused = await api.recurring.update({ id: rule.id, active: false })
  expect(paused.active).toBe(false)
  expect(await recurringRepo.runDue(handle.db, '2026-03-01')).toEqual([])

  const b = clientFor(handle, principal(other))
  await expect(b.templates.use({ id: tpl.id })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  await expect(b.templates.delete({ id: tpl.id })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  await expect(b.recurring.create({ templateId: tpl.id })).rejects.toMatchObject({
    code: 'NOT_FOUND',
  })
  expect(await b.templates.list({})).toEqual([])
})
