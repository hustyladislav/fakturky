import type { DbHandle } from '@fakturky/db'
import { traverseContractProcedures } from '@orpc/server'
import { afterAll, beforeAll, expect, test } from 'vitest'
import type { ProcedureMeta } from '../meta'
import { router } from '../router'
import { createTestDb, seedOrg } from '../testing'
import { buildAgentTools } from './index'

let handle: DbHandle
let orgId: string
beforeAll(async () => {
  handle = await createTestDb()
  orgId = await seedOrg(handle, 'tools-org')
})
afterAll(() => handle.close())

const tools = buildAgentTools()
const ctx = () => ({
  db: handle.db,
  principal: { userId: 'u', organizationId: orgId, via: 'apiKey' as const },
})

test('every procedure with meta.mcp becomes exactly one tool', () => {
  const expected: string[] = []
  traverseContractProcedures({ path: [], router }, ({ contract }) => {
    const meta = (contract as unknown as { '~orpc': { meta?: ProcedureMeta } })['~orpc'].meta
    if (meta?.mcp) expected.push(meta.mcp.name)
  })
  expect(expected.length).toBeGreaterThan(0)
  expect(tools.map((t) => t.name).sort()).toEqual(expected.sort())
})

test('annotations come from metadata; destructive tools are flagged', () => {
  const byName = Object.fromEntries(tools.map((t) => [t.name, t]))
  expect(byName.list_contacts?.annotations).toMatchObject({
    readOnlyHint: true,
    destructiveHint: false,
  })
  expect(byName.archive_contact?.annotations).toMatchObject({
    destructiveHint: true,
    idempotentHint: true,
    readOnlyHint: false,
  })
  expect(byName.create_contact?.annotations.readOnlyHint).toBe(false)
})

test('input schemas are JSON-schema objects; non-object outputs are wrapped', () => {
  for (const tool of tools) {
    expect(tool.inputSchema.type).toBe('object')
    if (tool.outputSchema) expect(tool.outputSchema.type).toBe('object')
  }
  const list = tools.find((t) => t.name === 'list_contacts')
  expect(list?.outputSchema?.properties).toHaveProperty('result')
})

test('executor runs the procedure with the given context and reports errors', async () => {
  const create = tools.find((t) => t.name === 'create_contact')
  const list = tools.find((t) => t.name === 'list_contacts')
  const get = tools.find((t) => t.name === 'get_contact')
  const created = await create?.execute({ name: 'ACME s.r.o.', emails: [] }, ctx())
  expect(created?.isError).toBe(false)
  expect(created?.structuredContent).toMatchObject({ name: 'ACME s.r.o.' })

  const listed = await list?.execute({}, ctx())
  expect(listed?.structuredContent?.result).toHaveLength(1)

  const missing = await get?.execute({ id: 'nope' }, ctx())
  expect(missing).toMatchObject({ isError: true })
  expect(missing?.text).toContain('NOT_FOUND')

  const anon = await list?.execute({}, { db: handle.db, principal: null })
  expect(anon?.text).toContain('UNAUTHORIZED')

  const invalid = await create?.execute({ name: 5 }, ctx())
  expect(invalid?.isError).toBe(true)
})
