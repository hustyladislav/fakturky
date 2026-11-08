import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cs } from '@/i18n/cs'
import { orpc } from '@/lib/orpc'
import { bankErrorMessage } from './bank-errors'

const t = cs.bank

/** Pairing changes touch invoices and the dashboard too, so everything refetches. */
function useRefresh() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries()
}

/** Header actions: pull new payments from Fio, re-run automatic pairing. */
export function useBankSync(fioAccountIds: string[]) {
  const refresh = useRefresh()
  const sync = useMutation({
    mutationFn: async () => {
      const results = []
      for (const id of fioAccountIds) results.push(await orpc.bank.syncFio.call({ id }))
      return results
    },
    onSuccess: async (rs) => {
      toast.success(
        t.synced(
          rs.reduce((n, r) => n + r.imported, 0),
          rs.reduce((n, r) => n + r.autoMatched, 0),
        ),
      )
      await refresh()
    },
    onError: (e) => toast.error(bankErrorMessage(e)),
  })
  const autoMatch = useMutation(
    orpc.bank.autoMatch.mutationOptions({
      onSuccess: async (r) => {
        toast.success(t.autoMatched(r.matched))
        await refresh()
      },
      onError: (e) => toast.error(bankErrorMessage(e)),
    }),
  )
  return { sync, autoMatch }
}

/** Per-row actions: confirm a suggestion, undo a pairing, ignore or restore a payment. */
export function useBankRowActions() {
  const refresh = useRefresh()
  const confirm = useMutation(
    orpc.bank.match.mutationOptions({
      onSuccess: async () => {
        toast.success(t.matched)
        await refresh()
      },
      onError: (e) => toast.error(bankErrorMessage(e)),
    }),
  )
  const unmatch = useMutation(
    orpc.bank.unmatch.mutationOptions({
      onSuccess: async () => {
        toast.success(t.unmatched)
        await refresh()
      },
      onError: (e) => toast.error(bankErrorMessage(e)),
    }),
  )
  const ignore = useMutation(
    orpc.bank.setIgnored.mutationOptions({
      onSuccess: async (_, v) => {
        toast.success(v.ignored === false ? t.restored : t.ignored)
        await refresh()
      },
      onError: (e) => toast.error(bankErrorMessage(e)),
    }),
  )
  return { confirm, unmatch, ignore }
}
