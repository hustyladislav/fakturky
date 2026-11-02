import { afterAll, expect, test } from 'vitest'
import { createDb } from './client'
import { migrate } from './migrate'
import { bankAccount, bankTransaction, organization } from './schema'

const handle = await createDb()
afterAll(() => handle.close())

test('bank transactions are unique per account and external id', async () => {
  await migrate(handle)
  const [org] = await handle.db
    .insert(organization)
    .values({ name: 'A', slug: 'bank-a' })
    .returning()
  if (!org) throw new Error('seed failed')
  const [acc] = await handle.db
    .insert(bankAccount)
    .values({ organizationId: org.id, label: 'Fio' })
    .returning()
  if (!acc) throw new Error('seed failed')
  const row = {
    organizationId: org.id,
    bankAccountId: acc.id,
    bookedOn: '2026-01-05',
    amount: '1210.0000',
    currency: 'CZK',
    externalId: 'tx-1',
    source: 'csv',
  }
  const [saved] = await handle.db.insert(bankTransaction).values(row).returning()
  expect(saved).toMatchObject({ matchStatus: 'unmatched', matchedDocumentId: null })
  await expect(handle.db.insert(bankTransaction).values(row)).rejects.toThrow()
  await handle.db.insert(bankTransaction).values({ ...row, externalId: 'tx-2' })
})
