import { mkdtemp, readFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { saveFile } from './commands'
import { configDir } from './config'
import { render } from './format'
import { coerce, groupOperations, kindOf, parseSpec } from './spec'

const spec = {
  paths: {
    '/contacts': {
      get: {
        operationId: 'contacts.list',
        summary: 'List contacts',
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' } },
          {
            name: 'includeArchived',
            in: 'query',
            schema: { anyOf: [{ type: 'boolean' }, { type: 'string' }] },
          },
          { name: 'limit', in: 'query', schema: { type: 'number' } },
        ],
      },
      post: {
        operationId: 'contacts.create',
        summary: 'Create a contact',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                required: ['name'],
                properties: { name: { type: 'string' }, emails: { type: 'array' } },
              },
            },
          },
        },
      },
    },
    '/documents/{id}/mark-paid': {
      post: {
        operationId: 'documents.markPaid',
        summary: 'Pay',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      },
    },
    '/public/invoice': { post: { operationId: 'public.invoice' } },
  },
}

test('operations are derived from operationIds; public endpoints are skipped', () => {
  const ops = parseSpec(spec)
  expect(ops.map((o) => `${o.group} ${o.action}`)).toEqual([
    'contacts list',
    'contacts create',
    'documents mark-paid',
  ])
  const list = ops[0]
  expect(list?.queryParams.map((p) => [p.name, p.kind])).toEqual([
    ['search', 'string'],
    ['includeArchived', 'boolean'],
    ['limit', 'number'],
  ])
  expect(ops[1]?.bodyProps).toMatchObject([
    { name: 'name', required: true, kind: 'string' },
    { name: 'emails', required: false, kind: 'json' },
  ])
  expect(ops[2]?.pathParams).toMatchObject([{ name: 'id', required: true }])
  expect([...groupOperations(ops).keys()]).toEqual(['contacts', 'documents'])
})

test('value coercion', () => {
  expect(coerce('number', '5', 'limit')).toBe(5)
  expect(() => coerce('number', 'x', 'limit')).toThrow('--limit must be a number')
  expect(coerce('boolean', '', 'showQr')).toBe(true)
  expect(coerce('boolean', 'false', 'showQr')).toBe(false)
  expect(coerce('json', '["a"]', 'emails')).toEqual(['a'])
  expect(() => coerce('json', '{', 'emails')).toThrow('valid JSON')
  expect(kindOf({ type: ['string', 'null'] })).toBe('string')
})

test('rendering: table skips empty columns, objects become key/value lines', () => {
  const table = render([{ id: '1', name: 'ACME', phone: null }], 80)
  expect(table).toContain('name')
  expect(table).not.toContain('phone')
  expect(render({ a: 1, bb: 'x' })).toBe('a   1\nbb  x')
  expect(render([])).toContain('žádné')
})

test('config dir honours XDG_CONFIG_HOME', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fk-'))
  expect(configDir({ XDG_CONFIG_HOME: dir }, 'linux')).toBe(join(dir, 'fakturky'))
  expect(configDir({ APPDATA: 'C:\\x' }, 'win32')).toContain('fakturky')
  expect((await stat(dir)).isDirectory()).toBe(true)
})

test('file results (PDF base64, ISDOC xml) are written to --out', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fk-cli-'))
  const pdf = join(dir, 'a.pdf')
  expect(
    await saveFile(
      { filename: 'a.pdf', contentBase64: Buffer.from('%PDF-1').toString('base64') },
      pdf,
    ),
  ).toBe(true)
  expect((await readFile(pdf)).toString()).toBe('%PDF-1')
  const xml = join(dir, 'a.isdoc')
  expect(await saveFile({ filename: 'a.isdoc', xml: '<Invoice/>' }, xml)).toBe(true)
  expect(await readFile(xml, 'utf8')).toBe('<Invoice/>')
  expect(await saveFile({ id: '1' }, join(dir, 'x'))).toBe(false)
})
