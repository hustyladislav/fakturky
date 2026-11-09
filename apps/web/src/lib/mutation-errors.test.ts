import { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cs } from '@/i18n/cs'
import { createMutationCache } from '@/lib/mutation-errors'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

const failing = (client: QueryClient, onError?: () => void) =>
  client
    .getMutationCache()
    .build(client, {
      mutationFn: () => Promise.reject(new Error('Some English server text')),
      ...(onError && { onError }),
    })
    .execute(undefined)
    .catch(() => undefined)

describe('createMutationCache', () => {
  beforeEach(() => vi.mocked(toast.error).mockClear())

  it('shows a Czech toast, never the server text, when a mutation has no handler', async () => {
    await failing(new QueryClient({ mutationCache: createMutationCache() }))
    expect(toast.error).toHaveBeenCalledExactlyOnceWith(cs.common.error)
  })

  it('stays quiet when the mutation reports the error itself', async () => {
    const own = vi.fn()
    await failing(new QueryClient({ mutationCache: createMutationCache() }), own)
    expect(own).toHaveBeenCalledOnce()
    expect(toast.error).not.toHaveBeenCalled()
  })
})
