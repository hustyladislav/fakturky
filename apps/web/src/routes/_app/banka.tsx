import { formatDateCs } from '@fakturky/domain/dates'
import { Badge } from '@fakturky/ui/components/badge'
import { Button } from '@fakturky/ui/components/button'
import { EmptyState } from '@fakturky/ui/components/empty-state'
import { Input } from '@fakturky/ui/components/input'
import { Money } from '@fakturky/ui/components/money'
import { NativeSelect } from '@fakturky/ui/components/native-select'
import { Skeleton } from '@fakturky/ui/components/skeleton'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Landmark, RefreshCw, Search, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { bankErrorMessage } from '@/components/bank/bank-errors'
import { PairDialog } from '@/components/bank/pair-dialog'
import { UploadStatementDialog } from '@/components/bank/upload-statement-dialog'
import { cs } from '@/i18n/cs'
import { pageHead } from '@/lib/head'
import { orpc } from '@/lib/orpc'

const FILTERS = ['unmatched', 'matched', 'ignored'] as const
type Filter = (typeof FILTERS)[number]

export const Route = createFileRoute('/_app/banka')({
  head: pageHead(cs.bank.title),
  // Plain validation (no zod): keeps the schema library out of the client bundle.
  validateSearch: (
    search: Record<string, unknown>,
  ): { filter?: Filter; q?: string; ucet?: string } => ({
    filter: FILTERS.find((f) => f === search.filter),
    q: typeof search.q === 'string' && search.q ? search.q : undefined,
    ucet: typeof search.ucet === 'string' && search.ucet ? search.ucet : undefined,
  }),
  component: BankPage,
})

const t = cs.bank

function BankPage() {
  const { filter = 'unmatched', q, ucet } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const queryClient = useQueryClient()
  const [term, setTerm] = useState(q ?? '')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [pairing, setPairing] = useState<{ id: string; amount: string; currency: string } | null>(
    null,
  )

  useEffect(() => {
    const h = setTimeout(() => {
      if ((q ?? '') !== term)
        navigate({ search: (s) => ({ ...s, q: term || undefined }), replace: true })
    }, 250)
    return () => clearTimeout(h)
  }, [term, q, navigate])

  const accounts = useQuery(orpc.bankAccounts.list.queryOptions({ input: {} }))
  const list = useQuery(
    orpc.bank.list.queryOptions({
      input: { status: filter, search: q || undefined, bankAccountId: ucet, limit: 100 },
    }),
  )
  const accountList = accounts.data ?? []
  const selected = accountList.find((a) => a.id === ucet)
  const fioAccounts = selected ? [selected] : accountList.filter((a) => a.fioConnected)
  const refresh = () => queryClient.invalidateQueries()

  const sync = useMutation({
    mutationFn: async () => {
      const results = []
      for (const a of fioAccounts) results.push(await orpc.bank.syncFio.call({ id: a.id }))
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

  const counts = list.data?.counts
  const items = list.data?.items ?? []

  return (
    <div className="mx-auto max-w-[1200px] space-y-4 pb-20 sm:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <div className="flex flex-wrap gap-2">
          {fioAccounts.length > 0 && (
            <Button variant="outline" disabled={sync.isPending} onClick={() => sync.mutate()}>
              <RefreshCw className={sync.isPending ? 'animate-spin' : undefined} />
              {sync.isPending ? t.syncing : t.sync}
            </Button>
          )}
          <Button
            variant="outline"
            disabled={autoMatch.isPending}
            onClick={() => autoMatch.mutate({})}
          >
            {t.autoMatch}
          </Button>
          <Button disabled={accountList.length === 0} onClick={() => setUploadOpen(true)}>
            <Upload /> {t.upload}
          </Button>
        </div>
      </div>
      <p className="text-muted-foreground text-sm">{t.intro}</p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5" role="tablist">
          {FILTERS.map((f) => (
            <Button
              key={f}
              role="tab"
              aria-selected={filter === f}
              variant={filter === f ? 'secondary' : 'ghost'}
              size="sm"
              nativeButton={false}
              render={<Link to="/banka" search={{ filter: f, q, ucet }} />}
            >
              {t.filters[f]}
              {counts ? ` (${counts[f]})` : ''}
            </Button>
          ))}
        </div>
        {accountList.length > 1 && (
          <NativeSelect
            className="sm:w-56"
            aria-label={t.account}
            value={ucet ?? ''}
            onChange={(e) =>
              navigate({ search: (s) => ({ ...s, ucet: e.target.value || undefined }) })
            }
          >
            <option value="">{t.allAccounts}</option>
            {accountList.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </NativeSelect>
        )}
        <div className="relative sm:w-80">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
          <Input
            className="pl-8"
            placeholder={t.search}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            aria-label={cs.common.search}
          />
        </div>
      </div>

      {list.isPending ? (
        <div className="space-y-px overflow-hidden rounded-xl border" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-none" />
          ))}
        </div>
      ) : items.length === 0 ? (
        accountList.length === 0 ? (
          <EmptyState icon={Landmark} title={t.emptyTitle}>
            {t.emptyNoAccount}
          </EmptyState>
        ) : counts && counts.unmatched + counts.matched + counts.ignored === 0 && !q ? (
          <EmptyState
            icon={Landmark}
            title={t.emptyTitle}
            action={
              <Button onClick={() => setUploadOpen(true)}>
                <Upload /> {t.upload}
              </Button>
            }
          >
            {t.empty}
          </EmptyState>
        ) : (
          <div className="text-muted-foreground rounded-xl border p-6">
            {filter === 'unmatched' && !q ? t.emptyUnmatched : t.emptyFiltered}
          </div>
        )
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border" aria-label={t.title}>
          {items.map((tx) => (
            <li key={tx.id} className="space-y-2 p-3 sm:p-4" data-testid="bank-row">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground text-sm tabular-nums">
                      {formatDateCs(tx.bookedOn)}
                    </span>
                    <span className="truncate font-medium">{tx.counterpartyName ?? '—'}</span>
                    {tx.overpaid && (
                      <Badge variant="destructive">
                        {t.overpaid(`${tx.overpaid} ${tx.currency}`)}
                      </Badge>
                    )}
                  </div>
                  <div className="text-muted-foreground truncate text-sm">
                    {[
                      tx.counterpartyAccount,
                      tx.variableSymbol && `${t.vs} ${tx.variableSymbol}`,
                      tx.message,
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </div>
                </div>
                <Money
                  amount={tx.amount}
                  currency={tx.currency}
                  className={`font-medium ${Number(tx.amount) < 0 ? 'text-muted-foreground' : ''}`}
                />
              </div>

              {tx.matchStatus === 'matched' && tx.matchedDocumentId && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    {t.paidInvoice}{' '}
                    <Link
                      to="/faktury/$id"
                      params={{ id: tx.matchedDocumentId }}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {tx.matchedDocumentNumber}
                    </Link>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={unmatch.isPending}
                    onClick={() => unmatch.mutate({ transactionId: tx.id })}
                  >
                    {t.unmatch}
                  </Button>
                </div>
              )}

              {tx.matchStatus === 'ignored' && (
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => ignore.mutate({ transactionId: tx.id, ignored: false })}
                  >
                    {t.restore}
                  </Button>
                </div>
              )}

              {tx.matchStatus === 'unmatched' && Number(tx.amount) > 0 && (
                <div className="space-y-2">
                  {tx.suggestions.map((s) => (
                    <div
                      key={s.documentId}
                      className="bg-muted/40 flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="text-muted-foreground">{t.suggestion}:</span>{' '}
                        <span className="font-medium tabular-nums">{s.number}</span>
                        {s.customerName ? ` · ${s.customerName}` : ''} · {t.remaining}{' '}
                        <Money amount={s.remaining} currency={s.currency} />
                        <span className="text-muted-foreground block text-xs">
                          {s.reasons.map((r) => t.reasons[r]).join(', ')}
                        </span>
                      </span>
                      <Button
                        size="sm"
                        disabled={confirm.isPending}
                        onClick={() =>
                          confirm.mutate({ transactionId: tx.id, documentId: s.documentId })
                        }
                      >
                        {t.confirm}
                      </Button>
                    </div>
                  ))}
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPairing({ id: tx.id, amount: tx.amount, currency: tx.currency })
                      }
                    >
                      {t.pairWith}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => ignore.mutate({ transactionId: tx.id, ignored: true })}
                    >
                      {t.ignore}
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {uploadOpen && (
        <UploadStatementDialog
          open
          onOpenChange={setUploadOpen}
          accounts={accountList}
          defaultAccountId={ucet}
        />
      )}
      <PairDialog transaction={pairing} onClose={() => setPairing(null)} />
    </div>
  )
}
