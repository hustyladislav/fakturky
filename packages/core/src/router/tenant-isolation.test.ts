/**
 * Tenant isolation, exhaustively: two organizations, org A's ids used by org B against EVERY procedure.
 *
 * The suite walks the router, so a new procedure fails `every procedure is covered` until a case is added
 * below. Pick the kind that fits:
 *  - `foreign`  takes an id (or an id inside the body) of another org's entity: must be NOT_FOUND/FORBIDDEN.
 *  - `scoped`   acts on the caller's own tenant (list/create/get-profile): must never reveal or alter org A's data.
 *  - `external` calls a third party / the public token flow and touches no tenant row.
 */
import { type DbHandle, schema } from '@fakturky/db'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { clientFor, createTestDb, seedOrg } from '../testing'

type Api = ReturnType<typeof clientFor>
type Fx = {
  contactId: string
  bankAccountId: string
  draftId: string
  issuedId: string
  templateId: string
  ruleId: string
  token: string
  secret: string
}

type Case =
  | { kind: 'foreign'; run: (b: Api, a: Fx, bOwn: { draftId: string }) => Promise<unknown> }
  | { kind: 'scoped'; run: (b: Api, a: Fx) => Promise<unknown> }
  | { kind: 'external' }

const SECRET = 'ORG-A-ONLY-SECRET'
// 1×1 PNG
const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=='
// PDF procedures check for the renderer before the lookup; give them one so the lookup is what is tested.
const services = { renderPdf: async () => new Uint8Array([1]) }

const line = { description: SECRET, quantity: '1', unitPrice: '100', vatRate: '21' }

const cases: Record<string, Case> = {
  'account.whoami': { kind: 'scoped', run: (b) => b.account.whoami({}) },
  'bankAccounts.list': { kind: 'scoped', run: (b) => b.bankAccounts.list({}) },
  'bankAccounts.create': {
    kind: 'scoped',
    run: (b) => b.bankAccounts.create({ label: 'B acct', account: '19-2000145399/0800' }),
  },
  'bankAccounts.update': {
    kind: 'foreign',
    run: (b, a) => b.bankAccounts.update({ id: a.bankAccountId, patch: { label: 'pwned' } }),
  },
  'bankAccounts.setDefault': {
    kind: 'foreign',
    run: (b, a) => b.bankAccounts.setDefault({ id: a.bankAccountId }),
  },
  'bankAccounts.delete': {
    kind: 'foreign',
    run: (b, a) => b.bankAccounts.delete({ id: a.bankAccountId }),
  },

  'bankAccounts.setFioToken': {
    kind: 'foreign',
    run: (b, a) => b.bankAccounts.setFioToken({ id: a.bankAccountId, token: null }),
  },
  'bank.list': { kind: 'scoped', run: (b) => b.bank.list({}) },
  'bank.importStatement': {
    kind: 'foreign',
    run: (b, a) =>
      b.bank.importStatement({
        bankAccountId: a.bankAccountId,
        content: 'Datum;Objem;Měna\n05.01.2026;100,00;CZK\n',
      }),
  },
  'bank.autoMatch': { kind: 'scoped', run: (b) => b.bank.autoMatch({}) },
  'bank.match': {
    // Org B cannot pay org A's invoice with B's own transaction, nor book A's transaction on B's invoice.
    kind: 'foreign',
    run: async (b, a) => {
      const mine = await b.bank.list({})
      const theirs = await clientFor(handle, principal(orgA)).bank.list({})
      const ownTx = mine.items[0]
      expect(ownTx).toBeDefined()
      await expect(
        b.bank.match({ transactionId: ownTx?.id ?? '', documentId: a.issuedId }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
      return b.bank.match({ transactionId: theirs.items[0]?.id ?? 'x', documentId: a.issuedId })
    },
  },
  'bank.unmatch': {
    kind: 'foreign',
    run: async (b) => {
      const theirs = await clientFor(handle, principal(orgA)).bank.list({})
      return b.bank.unmatch({ transactionId: theirs.items[0]?.id ?? 'x' })
    },
  },
  'bank.setIgnored': {
    kind: 'foreign',
    run: async (b) => {
      const theirs = await clientFor(handle, principal(orgA)).bank.list({})
      return b.bank.setIgnored({ transactionId: theirs.items[0]?.id ?? 'x', ignored: true })
    },
  },
  'bank.syncFio': { kind: 'foreign', run: (b, a) => b.bank.syncFio({ id: a.bankAccountId }) },

  'businessProfile.get': { kind: 'scoped', run: (b) => b.businessProfile.get() },
  'businessProfile.update': {
    kind: 'scoped',
    run: (b) => b.businessProfile.update({ legalName: 'B s.r.o.' }),
  },
  'businessProfile.lookupIco': { kind: 'external' },

  'contacts.list': { kind: 'scoped', run: (b) => b.contacts.list({ includeArchived: true }) },
  'contacts.stats': { kind: 'scoped', run: (b) => b.contacts.stats({}) },
  'contacts.get': { kind: 'foreign', run: (b, a) => b.contacts.get({ id: a.contactId }) },
  'contacts.create': { kind: 'scoped', run: (b) => b.contacts.create({ name: 'B client' }) },
  'contacts.update': {
    kind: 'foreign',
    run: (b, a) => b.contacts.update({ id: a.contactId, patch: { name: 'pwned' } }),
  },
  'contacts.archive': { kind: 'foreign', run: (b, a) => b.contacts.archive({ id: a.contactId }) },

  'dashboard.summary': { kind: 'scoped', run: (b) => b.dashboard.summary({}) },

  'exports.documents': { kind: 'scoped', run: (b) => b.exports.documents({}) },
  'numberSeries.list': { kind: 'scoped', run: (b) => b.numberSeries.list({}) },
  'numberSeries.update': {
    kind: 'foreign',
    run: async (b, a) => {
      const mine = await b.numberSeries.list({})
      const theirs = await clientFor(handle, principal(orgA)).numberSeries.list({})
      void mine
      return b.numberSeries.update({ id: theirs[0]?.id ?? a.token, name: 'pwned' })
    },
  },
  'numberSeries.setNext': {
    kind: 'foreign',
    run: async (b) => {
      const theirs = await clientFor(handle, principal(orgA)).numberSeries.list({})
      return b.numberSeries.setNext({ id: theirs[0]?.id ?? 'x', value: 5000 })
    },
  },
  'appearance.get': { kind: 'scoped', run: (b) => b.appearance.get({}) },
  'appearance.update': {
    kind: 'scoped',
    run: (b) => b.appearance.update({ accentColor: '#112233' }),
  },
  'appearance.setAsset': {
    kind: 'scoped',
    run: (b) => b.appearance.setAsset({ kind: 'logo', dataBase64: PNG }),
  },
  'appearance.deleteAsset': {
    kind: 'scoped',
    run: (b) => b.appearance.deleteAsset({ kind: 'logo' }),
  },
  'exports.organization': { kind: 'scoped', run: (b) => b.exports.organization({}) },
  'exports.contacts': { kind: 'scoped', run: (b) => b.exports.contacts({}) },
  'documents.createCreditNote': {
    kind: 'foreign',
    run: (b, a) => b.documents.createCreditNote({ id: a.issuedId }),
  },
  'documents.createPaymentReceipt': {
    kind: 'foreign',
    run: (b, a) => b.documents.createPaymentReceipt({ id: a.issuedId }),
  },
  'documents.createFinalInvoice': {
    kind: 'foreign',
    run: (b, a) => b.documents.createFinalInvoice({ id: a.issuedId }),
  },
  'documents.send': {
    kind: 'foreign',
    run: (b, a) => b.documents.send({ id: a.issuedId, to: 'attacker@example.com' }),
  },
  'documents.pdf': { kind: 'foreign', run: (b, a) => b.documents.pdf({ id: a.issuedId }) },
  'documents.isdoc': { kind: 'foreign', run: (b, a) => b.documents.isdoc({ id: a.issuedId }) },
  'documents.defaults': { kind: 'scoped', run: (b) => b.documents.defaults({}) },
  'documents.list': { kind: 'scoped', run: (b) => b.documents.list({ search: SECRET }) },
  'documents.stats': { kind: 'scoped', run: (b) => b.documents.stats({ search: SECRET }) },
  'documents.get': { kind: 'foreign', run: (b, a) => b.documents.get({ id: a.issuedId }) },
  'documents.createDraft': {
    // Referencing org A's contact / bank account from org B's new document must fail.
    kind: 'foreign',
    run: async (b, a) => {
      await expect(
        b.documents.createDraft({ contactId: a.contactId, lines: [line] }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
      return b.documents.createDraft({ bankAccountId: a.bankAccountId, lines: [line] })
    },
  },
  'documents.updateDraft': {
    kind: 'foreign',
    run: async (b, a, own) => {
      // foreign document id…
      await expect(
        b.documents.updateDraft({ id: a.draftId, patch: { introText: 'pwned' } }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
      // …and own document pointed at foreign contact / bank account
      await expect(
        b.documents.updateDraft({ id: own.draftId, patch: { contactId: a.contactId } }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
      return b.documents.updateDraft({ id: own.draftId, patch: { bankAccountId: a.bankAccountId } })
    },
  },
  'documents.issue': { kind: 'foreign', run: (b, a) => b.documents.issue({ id: a.draftId }) },
  'documents.duplicate': {
    kind: 'foreign',
    run: (b, a) => b.documents.duplicate({ id: a.issuedId }),
  },
  'documents.markPaid': {
    kind: 'foreign',
    run: (b, a) => b.documents.markPaid({ id: a.issuedId }),
  },
  'documents.markUnpaid': {
    kind: 'foreign',
    run: (b, a) => b.documents.markUnpaid({ id: a.issuedId }),
  },
  'documents.cancel': { kind: 'foreign', run: (b, a) => b.documents.cancel({ id: a.issuedId }) },
  'documents.rotateLink': {
    kind: 'foreign',
    run: (b, a) => b.documents.rotateLink({ id: a.issuedId }),
  },
  'documents.delete': { kind: 'foreign', run: (b, a) => b.documents.delete({ id: a.draftId }) },

  // Fakturoid import calls a third party; its tenant isolation is covered in import/import.test.ts.
  'import.fakturoid': { kind: 'external' },
  'import.file': {
    kind: 'scoped',
    run: (b) => b.import.file({ format: 'csv', kind: 'contacts', content: 'name\nB contact' }),
  },
  'lookup.ares': { kind: 'external' },
  'lookup.exchangeRate': { kind: 'external' },
  'lookup.vies': { kind: 'external' },

  'templates.list': { kind: 'scoped', run: (b) => b.templates.list({}) },
  'templates.createFromDocument': {
    kind: 'foreign',
    run: (b, a) => b.templates.createFromDocument({ documentId: a.issuedId, name: 'steal' }),
  },
  'templates.use': { kind: 'foreign', run: (b, a) => b.templates.use({ id: a.templateId }) },
  'templates.delete': { kind: 'foreign', run: (b, a) => b.templates.delete({ id: a.templateId }) },

  'recurring.list': { kind: 'scoped', run: (b) => b.recurring.list({}) },
  'recurring.create': {
    kind: 'foreign',
    run: (b, a) => b.recurring.create({ templateId: a.templateId }),
  },
  'recurring.update': {
    kind: 'foreign',
    run: (b, a) => b.recurring.update({ id: a.ruleId, active: false }),
  },
  'recurring.delete': { kind: 'foreign', run: (b, a) => b.recurring.delete({ id: a.ruleId }) },

  // VAT reports are for payers: make org B one first (ordered last, nothing after depends on it).
  'vat.report': {
    kind: 'scoped',
    run: async (b) => {
      await makePayer(orgB)
      return b.vat.report({ year: 2026, month: 3 })
    },
  },
  'vat.exportXml': {
    kind: 'scoped',
    run: async (b) => {
      await makePayer(orgB)
      return b.vat.exportXml({ year: 2026, month: 3, kind: 'kh' })
    },
  },

  'public.invoice': { kind: 'external' },
  'public.isdoc': { kind: 'external' },
  'public.pdf': { kind: 'external' },
  'public.qrPng': { kind: 'external' },
}

async function makePayer(org: string) {
  await handle.db
    .update(schema.businessProfile)
    .set({
      vatStatus: 'payer',
      dic: 'CZ27082440',
      vatFiling: { taxOfficeCode: '451', period: 'monthly', subjectType: 'P' },
    })
    .where(eq(schema.businessProfile.organizationId, org))
}

function procedurePaths(node: object, prefix: string[] = []): string[] {
  return Object.entries(node).flatMap(([key, value]) =>
    value && typeof value === 'object' && '~orpc' in value
      ? [[...prefix, key].join('.')]
      : procedurePaths(value as object, [...prefix, key]),
  )
}

function call(api: Api, path: string, input: unknown): Promise<unknown> {
  let node: unknown = api
  for (const key of path.split('.')) node = (node as Record<string, unknown>)[key]
  return (node as (i: unknown) => Promise<unknown>)(input)
}

let handle: DbHandle
let orgA: string
let orgB: string
let a: Fx
let aApi: Api
let bApi: Api
let bOwn: { draftId: string }

const principal = (organizationId: string) => ({
  userId: `user-${organizationId}`,
  organizationId,
  via: 'session' as const,
})

beforeAll(async () => {
  handle = await createTestDb()
  orgA = await seedOrg(handle, 'iso-a')
  orgB = await seedOrg(handle, 'iso-b')
  for (const [org, name] of [
    [orgA, SECRET],
    [orgB, 'B s.r.o.'],
  ] as const) {
    await handle.db
      .insert(schema.businessProfile)
      .values({ organizationId: org, legalName: name, ico: '27082440' })
  }
  aApi = clientFor(handle, principal(orgA), services)
  bApi = clientFor(handle, principal(orgB), services)

  const contact = await aApi.contacts.create({ name: SECRET, emails: ['a-secret@example.com'] })
  const bank = await aApi.bankAccounts.create({ label: SECRET, account: '19-2000145399/0800' })
  await aApi.bank.importStatement({
    bankAccountId: bank.id,
    content: `Datum;Objem;Měna;Název protiúčtu;VS\n05.01.2026;100,00;CZK;${SECRET};424242\n`,
  })
  const draft = await aApi.documents.createDraft({
    contactId: contact.id,
    privateNote: SECRET,
    lines: [line],
  })
  const toIssue = await aApi.documents.createDraft({ contactId: contact.id, lines: [line] })
  const issued = await aApi.documents.issue({ id: toIssue.id })
  const template = await aApi.templates.createFromDocument({ documentId: issued.id, name: SECRET })
  const rule = await aApi.recurring.create({ templateId: template.id })
  a = {
    templateId: template.id,
    ruleId: rule.id,
    contactId: contact.id,
    bankAccountId: bank.id,
    draftId: draft.id,
    issuedId: issued.id,
    token: issued.publicToken as string,
    secret: SECRET,
  }
  const bContact = await bApi.contacts.create({ name: 'B client' })
  const bBank = await bApi.bankAccounts.create({ label: 'B bank', account: '19-2000145399/0800' })
  await bApi.bank.importStatement({
    bankAccountId: bBank.id,
    content: 'Datum;Objem;Měna;Název protiúčtu\n06.01.2026;77,00;CZK;B payer\n',
  })
  bOwn = {
    draftId: (
      await bApi.documents.createDraft({
        contactId: bContact.id,
        // Org B's own data must not reuse org A's marker, or whole-payload scans cannot tell them apart.
        lines: [{ ...line, description: 'B line' }],
      })
    ).id,
  }
})
afterAll(() => handle.close())

describe('tenant isolation', () => {
  test('every procedure is covered by a case', async () => {
    const { router } = await import('./index')
    expect(procedurePaths(router).sort()).toEqual(Object.keys(cases).sort())
  })

  test('every authenticated procedure rejects anonymous callers', async () => {
    const anon = clientFor(handle, null)
    for (const path of Object.keys(cases).filter((p) => !p.startsWith('public.'))) {
      await expect(call(anon, path, {}), path).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    }
  })

  test('foreign ids are NOT_FOUND / FORBIDDEN for org B', async () => {
    for (const [path, c] of Object.entries(cases)) {
      if (c.kind !== 'foreign') continue
      await expect(c.run(bApi, a, bOwn), path).rejects.toMatchObject({
        code: expect.stringMatching(/^(NOT_FOUND|FORBIDDEN)$/),
      })
    }
  })

  test('scoped procedures never return org A data to org B', async () => {
    for (const [path, c] of Object.entries(cases)) {
      if (c.kind !== 'scoped') continue
      const out = JSON.stringify(await c.run(bApi, a))
      for (const needle of [
        SECRET,
        a.templateId,
        a.ruleId,
        a.contactId,
        a.bankAccountId,
        a.draftId,
        a.issuedId,
        a.token,
      ]) {
        expect(out, `${path} leaked ${needle}`).not.toContain(needle)
      }
      expect(out, `${path} leaked org A id`).not.toContain(orgA)
    }
  })

  test('public endpoints accept only the unguessable token, never internal ids', async () => {
    const anon = clientFor(handle, null, services)
    const b = bApi
    for (const bogus of [
      a.issuedId,
      a.draftId,
      orgA,
      'x'.repeat(24),
      `${a.token}x`,
      a.token.slice(1),
    ]) {
      await expect(anon.public.invoice({ token: bogus.padEnd(24, '0') })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      })
      await expect(anon.public.isdoc({ token: bogus.padEnd(24, '0') })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      })
      await expect(anon.public.pdf({ token: bogus.padEnd(24, '0') })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      })
      await expect(anon.public.qrPng({ token: bogus.padEnd(24, '0') })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      })
    }
    // an authenticated caller from another tenant gets nothing extra either
    await expect(b.public.invoice({ token: a.draftId.padEnd(24, '0') })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    // the real token still works (control)
    expect((await anon.public.invoice({ token: a.token })).number).toBeTruthy()
  })

  test('after all hostile calls org A data is untouched', async () => {
    const contact = await aApi.contacts.get({ id: a.contactId })
    expect(contact).toMatchObject({ name: SECRET, archivedAt: null })
    const banks = await aApi.bankAccounts.list({})
    expect(banks).toHaveLength(1)
    expect(banks[0]).toMatchObject({ label: SECRET })
    const profile = await aApi.businessProfile.get()
    expect(profile.legalName).toBe(SECRET)
    const draft = await aApi.documents.get({ id: a.draftId })
    expect(draft).toMatchObject({ status: 'draft', introText: null })
    expect(await aApi.templates.list({})).toHaveLength(1)
    const rules = await aApi.recurring.list({})
    expect(rules).toHaveLength(1)
    expect(rules[0]).toMatchObject({ id: a.ruleId, active: true })
    const issued = await aApi.documents.get({ id: a.issuedId })
    expect(issued.status).toBe('issued')
    expect(issued.payments).toHaveLength(0)
    // org A's statement is intact and was not duplicated or altered by B's hostile import
    const txs = await aApi.bank.list({})
    expect(txs.total).toBe(1)
    expect(txs.items[0]).toMatchObject({ matchStatus: 'unmatched', counterpartyName: SECRET })
    // org A's own list is unchanged: no document appeared from B's hostile createDraft/duplicate calls
    expect((await aApi.documents.list({})).length).toBe(2)
    // …and B did not gain documents referencing A's contact or bank account
    const bDocs = await bApi.documents.list({})
    expect(
      bDocs.every((d) => d.contactId !== a.contactId && d.bankAccountId !== a.bankAccountId),
    ).toBe(true)
  })
})
