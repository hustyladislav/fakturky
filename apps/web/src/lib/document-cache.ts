import type { QueryClient } from '@tanstack/react-query'
import { orpc } from '@/lib/orpc'

/** Everything computed from documents; a change to one document makes all of it stale. */
export function refreshDocumentData(queryClient: QueryClient) {
  return Promise.all(
    [orpc.documents.key(), orpc.dashboard.key(), orpc.contacts.stats.key(), orpc.vat.key()].map(
      (queryKey) => queryClient.invalidateQueries({ queryKey }),
    ),
  )
}
