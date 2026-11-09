import { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cs } from '@/i18n/cs'
import { createMutationCache } from '@/lib/mutation-errors'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

const serverError = new Error('Some English server text')
const failing = (client: QueryClient, onError?: () => void) =>
  client
    .getMutationCache()
    .build(client, {
      mutationFn: () => Promise.reject(serverError),
      ...(onError && { onError }),
    })
    .execute(undefined)
    .catch(() => undefined)
const clientWith = (onFailure = vi.fn()) =>
  new QueryClient({ mutationCache: createMutationCache(onFailure) })

describe('createMutationCache', () => {
  beforeEach(() => vi.mocked(toast.error).mockClear())

  it('shows a Czech toast, never the server text, when a mutation has no handler', async () => {
    await failing(clientWith())
    expect(toast.error).toHaveBeenCalledExactlyOnceWith(cs.common.error)
  })

  it('stays quiet when the mutation reports the error itself', async () => {
    const own = vi.fn()
    await failing(clientWith(), own)
    expect(own).toHaveBeenCalledOnce()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('reports every failure, including one the mutation handles itself', async () => {
    const onFailure = vi.fn()
    await failing(clientWith(onFailure), vi.fn())
    expect(onFailure).toHaveBeenCalledExactlyOnceWith(serverError)
  })
})
