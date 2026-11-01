import { createTestDb, seedOrg } from '@fakturky/core/testing'
import type { DbHandle } from '@fakturky/db'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { buildServerTools } from './tools'

let handle: DbHandle
let orgId: string
beforeAll(async () => {
  handle = await createTestDb()
  orgId = await seedOrg(handle, 'agent-tools')
})
afterAll(() => handle.close())

const principal = () => ({ userId: 'u', organizationId: orgId, via: 'assistant' as const })

type Tool = {
  name: string
  needsApproval?: boolean
  execute?: (args: unknown) => Promise<unknown>
}
const tools = () => buildServerTools({ db: handle.db, principal: principal() }) as unknown as Tool[]
const byName = (name: string) => {
  const tool = tools().find((t) => t.name === name)
  if (!tool) throw new Error(`missing tool ${name}`)
  return tool
}

test('destructive and financially significant tools need approval; reads and drafts do not', () => {
  for (const name of [
    'archive_contact',
    'delete_document_draft',
    'cancel_document',
    'issue_invoice',
    'mark_document_paid',
    'delete_bank_account',
  ]) {
    expect(byName(name).needsApproval, name).toBe(true)
  }
  for (const name of [
    'list_contacts',
    'list_documents',
    'create_invoice_draft',
    'create_contact',
  ]) {
    expect(byName(name).needsApproval ?? false, name).toBe(false)
  }
})

test('heavy tools are not offered to the model', () => {
  expect(tools().some((t) => t.name === 'export_document_isdoc')).toBe(false)
})

test('executes procedures as the signed-in organization; results are wrapped', async () => {
  const created = (await byName('create_contact').execute?.({ name: 'Acme s.r.o.' })) as {
    ok: boolean
    result: { id: string; name: string }
  }
  expect(created.ok).toBe(true)
  expect(created.result.name).toBe('Acme s.r.o.')

  const listed = (await byName('list_contacts').execute?.({})) as {
    ok: boolean
    result: { name: string }[] | { result: { name: string }[] }
  }
  const rows = Array.isArray(listed.result) ? listed.result : listed.result.result
  expect(rows.map((r) => r.name)).toContain('Acme s.r.o.')
})

test('drafts created by the assistant are marked in the activity log', async () => {
  const draft = (await byName('create_invoice_draft').execute?.({
    lines: [{ description: 'Práce', quantity: '1', unitPrice: '1000' }],
  })) as { ok: boolean; result: { id: string; activity: { action: string; data: unknown }[] } }
  expect(draft.ok).toBe(true)
  expect(draft.result.activity[0]).toMatchObject({ action: 'created', data: { via: 'assistant' } })
})

test('procedure errors come back as data, not exceptions', async () => {
  const res = (await byName('get_contact').execute?.({ id: 'nope' })) as {
    ok: boolean
    error: string
  }
  expect(res.ok).toBe(false)
  expect(res.error).toMatch(/NOT_FOUND|not found/i)
})
