import { type APIRequestContext, expect, test } from '@playwright/test'

type Step = { id: string; status: 'done' | 'todo'; required: boolean; tools: string[] }
type Status = { complete: boolean; next: string | null; steps: Step[] }

function mcpClient(request: APIRequestContext, key: string) {
  let id = 0
  const call = async (method: string, params: unknown) => {
    const res = await request.post('/mcp', {
      headers: { authorization: `Bearer ${key}`, accept: 'application/json, text/event-stream' },
      data: { jsonrpc: '2.0', id: ++id, method, params },
    })
    expect(res.ok(), await res.text()).toBe(true)
    const text = await res.text()
    return JSON.parse(text.match(/^data: (.*)$/m)?.[1] ?? text).result
  }
  const tool = async <T>(name: string, args: unknown = {}) => {
    const result = await call('tools/call', { name, arguments: args })
    expect(result.isError ?? false, JSON.stringify(result)).toBe(false)
    return result.structuredContent as T
  }
  return { call, tool }
}

async function newAccountKey(request: APIRequestContext, baseURL: string) {
  const headers = { origin: baseURL }
  const email = `agent-${Date.now()}@example.com`
  const signUp = await request.post('/api/auth/sign-up/email', {
    headers,
    data: { name: 'Agentka', email, password: 'agent-heslo-123' },
  })
  expect(signUp.ok()).toBe(true)
  const orgs = await (await request.get('/api/auth/organization/list', { headers })).json()
  const created = await request.post('/api/auth/api-key/create', {
    headers,
    data: { name: 'agent', organizationId: orgs[0].id },
  })
  expect(created.ok(), await created.text()).toBe(true)
  return (await created.json()).key as string
}

test('the runbook tells an agent how to connect and where the checklist is', async ({
  request,
  baseURL,
}) => {
  const res = await request.get('/start')
  expect(res.headers()['content-type']).toContain('text/markdown')
  const body = await res.text()
  expect(body).toContain(`${baseURL}/mcp`)
  expect(body).toContain('get_onboarding_status')
  expect(await (await request.get('/llms.txt')).text()).toContain(`${baseURL}/start`)
})

test('an agent sets up a new account from the checklist and stops at a draft', async ({
  request,
  baseURL,
}) => {
  const key = await newAccountKey(request, baseURL ?? '')
  const { call, tool } = mcpClient(request, key)

  const init = await call('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'e2e-agent', version: '1' },
  })
  expect(init.instructions).toContain('get_onboarding_status')

  let status = await tool<Status>('get_onboarding_status')
  expect(status).toMatchObject({ complete: false, next: 'business_profile' })

  const company = await tool<{
    name: string
    dic: string | null
    address: { street: string; city: string; zip: string; country: string }
  }>('lookup_company_by_ico', { ico: '12345016' })
  await tool('update_business_profile', {
    legalName: company.name,
    ico: '12345016',
    dic: company.dic,
    address: company.address,
    vatStatus: 'payer',
  })
  status = await tool<Status>('get_onboarding_status')
  expect(status).toMatchObject({ complete: true, next: 'bank_account' })

  await tool('create_bank_account', { label: 'Hlavní', account: '19-2000145399/0800' })
  status = await tool<Status>('get_onboarding_status')
  expect(status.next).toBe('history')

  const defaults = await tool<Record<string, unknown>>('get_invoice_defaults')
  expect(defaults).toBeTruthy()
  const contact = await tool<{ id: string }>('create_contact', {
    name: 'Zákazník s.r.o.',
    emails: [],
  })
  const draft = await tool<{ id: string; status: string; number: string | null }>(
    'create_invoice_draft',
    {
      type: 'invoice',
      contactId: contact.id,
      lines: [
        { description: 'Konzultace', quantity: '1', unit: 'h', unitPrice: '1000', vatRate: '21' },
      ],
    },
  )
  expect(draft).toMatchObject({ status: 'draft', number: null })

  status = await tool<Status>('get_onboarding_status')
  expect(status.steps.find((s) => s.id === 'first_draft')?.status).toBe('done')
  // A draft allocates no number, so the numbering question is still open.
  expect(status.steps.find((s) => s.id === 'history')?.status).toBe('todo')
})
