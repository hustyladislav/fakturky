import { QueryClient } from '@tanstack/react-query'
import { expect, test } from 'vitest'
import { refreshDocumentData } from '@/lib/document-cache'
import { orpc } from '@/lib/orpc'

test('a document change marks every figure derived from documents as stale', async () => {
  const queryClient = new QueryClient()
  const derived = [
    orpc.documents.list.queryKey({ input: {} }),
    orpc.dashboard.summary.queryKey({ input: {} }),
    orpc.contacts.stats.queryKey({ input: {} }),
    orpc.vat.key(),
  ]
  const unrelated = orpc.contacts.list.queryKey({ input: {} })
  for (const key of [...derived, unrelated]) queryClient.setQueryData(key, 'cached')

  await refreshDocumentData(queryClient)

  for (const key of derived) expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true)
  expect(queryClient.getQueryState(unrelated)?.isInvalidated).toBe(false)
})
