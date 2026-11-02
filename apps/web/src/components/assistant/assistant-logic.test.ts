import { expect, test } from 'vitest'
import { contextLabel, pageKey } from './assistant-context'
import { type Conversation, HISTORY_LIMIT, titleOf, upsert } from './assistant-history'
import { recoveredFailures, resultDocumentId, type ToolPart } from './assistant-parts'
import { documentSummary } from './assistant-summary'

const plain = (v: string) => v.replace(/\u00a0/g, ' ')

const call = (over: Partial<ToolPart>): ToolPart => ({
  type: 'tool-call',
  id: 'x',
  name: 'create_invoice_draft',
  arguments: '{}',
  state: 'complete',
  ...over,
})

test('a failed step is hidden once the same tool succeeded later in the turn', () => {
  const failed = call({ id: '1', state: 'error' })
  const ok = call({ id: '2', output: { ok: true } })
  const other = call({ id: '3', name: 'issue_invoice', state: 'error' })
  const msgs = [
    { role: 'user', parts: [] },
    { role: 'assistant', parts: [failed] },
    { role: 'assistant', parts: [ok, other] },
  ]
  expect([...recoveredFailures(msgs)]).toEqual(['1'])
  expect(recoveredFailures(msgs.slice(0, 2)).size).toBe(0)
})

test('the result id of a successful tool links to the document', () => {
  expect(resultDocumentId(call({ output: { ok: true, result: { id: 'abc' } } }))).toBe('abc')
  expect(resultDocumentId(call({ output: { ok: false, result: { id: 'abc' } } }))).toBeNull()
  expect(resultDocumentId(call({}))).toBeNull()
})

test('issue summary names the customer, the line, the total with VAT and the due date', () => {
  const s = documentSummary('issue_invoice', {
    number: null,
    customerName: 'Studio Lípa',
    currency: 'CZK',
    total: '5445.00',
    vatTotal: '945.00',
    dueDate: '2026-11-16',
    lines: [{ description: 'Konzultace', quantity: '3.0000', unitPrice: '1500.00' }],
  })
  expect(s?.title).toBe('Vystavit fakturu pro Studio Lípa')
  expect(s?.facts.map(plain)).toEqual([
    '3 × 1 500 Kč',
    'celkem 5 445 Kč s DPH',
    'splatnost 16. 11. 2026',
  ])
})

test('a non-VAT total says no VAT and several lines are counted', () => {
  const s = documentSummary('mark_document_paid', {
    number: '2026-0028',
    customerName: 'A',
    currency: 'CZK',
    total: '100.00',
    vatTotal: '0.00',
    dueDate: null,
    lines: [
      { description: 'a', quantity: '1', unitPrice: '50' },
      { description: 'b', quantity: '1', unitPrice: '50' },
    ],
  })
  expect(s?.title).toBe('Označit fakturu 2026-0028 jako zaplacenou')
  expect(s?.facts.map(plain)).toEqual(['2 položky', 'celkem 100 Kč'])
})

test('page keys and the context chip', () => {
  expect(pageKey('/faktury/abc')).toBe('invoice')
  expect(pageKey('/faktury/abc/upravit')).toBe('invoice')
  expect(pageKey('/faktury/nova')).toBe('invoices')
  expect(pageKey('/faktury')).toBe('invoices')
  expect(pageKey('/prehled')).toBe('overview')
  expect(contextLabel('invoice', '2026-0028')).toBe('Na stránce: Faktura 2026-0028')
})

test('history keeps the newest ten and one entry per conversation', () => {
  const mk = (i: number): Conversation => ({
    id: String(i),
    title: String(i),
    updatedAt: i,
    messages: [],
  })
  let list: Conversation[] = []
  for (let i = 0; i < 12; i++) list = upsert(list, mk(i))
  expect(list).toHaveLength(HISTORY_LIMIT)
  expect(list[0]?.id).toBe('11')
  list = upsert(list, { ...mk(5), updatedAt: 99 })
  expect(list[0]?.id).toBe('5')
  expect(list.filter((c) => c.id === '5')).toHaveLength(1)
  expect(
    titleOf([
      { id: 'm', role: 'user', parts: [{ type: 'text', content: '  Ahoj\n svět ' }] },
    ] as never),
  ).toBe('Ahoj svět')
})
