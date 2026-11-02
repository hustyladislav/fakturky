import { formatDateCs } from '@fakturky/domain/dates'
import { Amount } from '@fakturky/ui/components/amount'
import { Avatar } from '@fakturky/ui/components/avatar'
import { Badge } from '@fakturky/ui/components/badge'
import { Button } from '@fakturky/ui/components/button'
import { EmptyState } from '@fakturky/ui/components/empty-state'
import { Input } from '@fakturky/ui/components/input'
import { NativeSelect } from '@fakturky/ui/components/native-select'
import { PageHeader, PageTabs } from '@fakturky/ui/components/page-header'
import { Skeleton } from '@fakturky/ui/components/skeleton'
import { cn } from '@fakturky/ui/lib/utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  FileCheck2,
  RefreshCw,
  Search,
  Sparkles,
  Upload,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { bankErrorMessage } from '@/components/bank/bank-errors'
import { PairDialog } from '@/components/bank/pair-dialog'
import { UploadStatementDialog } from '@/components/bank/upload-statement-dialog'
import { ErrorState } from '@/components/error-state'
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
  const total = counts ? counts.unmatched + counts.matched + counts.ignored : 0
  const subtitle = counts
    ? total === 0
      ? t.subtitleEmpty
      : t.subtitle(counts.unmatched, counts.matched)
    : undefined

  return (
    <div className="mx-auto max-w-[1280px] pb-20 sm:pb-0">
      <PageHeader
        title={t.title}
        subtitle={subtitle}
        actions={
          <>
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
              <Sparkles /> {t.autoMatch}
            </Button>
            <Button disabled={accountList.length === 0} onClick={() => setUploadOpen(true)}>
              <Upload /> {t.upload}
            </Button>
          </>
        }
        tabs={
          <PageTabs
            label={t.title}
            value={filter}
            onValueChange={(id) => navigate({ search: (s) => ({ ...s, filter: id as Filter }) })}
            items={FILTERS.map((f) => ({
              id: f,
              label: t.filters[f],
              ...(counts ? { count: counts[f] } : {}),
            }))}
          />
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-80">
          <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder={t.search}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            aria-label={cs.common.search}
          />
        </div>
        {accountList.length > 1 && (
          <NativeSelect
            className="sm:w-60"
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
      </div>

      {list.isError ? (
        <ErrorState onRetry={() => list.refetch()} />
      ) : list.isPending ? (
        <div className="sheet divide-y overflow-hidden" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <Skeleton className="size-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-72 max-w-full" />
              </div>
              <Skeleton className="h-5 w-24" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        accountList.length === 0 ? (
          <EmptyState illustration="bank" title={t.emptyTitle}>
            {t.emptyNoAccount}
          </EmptyState>
        ) : counts && total === 0 && !q ? (
          <EmptyState
            illustration="bank"
            title={t.emptyTitle}
            action={
              <Button onClick={() => setUploadOpen(true)}>
                <Upload /> {t.upload}
              </Button>
            }
          >
            {t.empty}
          </EmptyState>
        ) : filter === 'unmatched' && !q ? (
          <EmptyState icon={Check} title={t.emptyUnmatchedTitle}>
            {t.emptyUnmatched}
          </EmptyState>
        ) : (
          <EmptyState illustration="search" title={t.emptyFiltered} />
        )
      ) : (
        <ul className="sheet divide-y overflow-hidden" aria-label={t.title}>
          {items.map((tx) => {
            const incoming = Number(tx.amount) > 0
            const name = tx.counterpartyName ?? '—'
            return (
              <li key={tx.id} className="row-hover p-3.5 sm:px-5 sm:py-4" data-testid="bank-row">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="relative shrink-0">
                    <Avatar name={tx.counterpartyName ?? '?'} size="md" />
                    <span
                      className={cn(
                        'absolute -right-1 -bottom-1 flex size-[18px] items-center justify-center rounded-full ring-2 ring-card',
                        incoming
                          ? 'bg-success text-white dark:text-background'
                          : 'bg-muted text-muted-foreground',
                      )}
                      role="img"
                      aria-label={incoming ? t.incoming : t.outgoing}
                    >
                      {incoming ? (
                        <ArrowDownLeft className="size-3" strokeWidth={2.5} />
                      ) : (
                        <ArrowUpRight className="size-3" strokeWidth={2.5} />
                      )}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-medium break-words">{name}</span>
                      {tx.overpaid && (
                        <Badge variant="destructive">
                          {t.overpaid(`${tx.overpaid} ${tx.currency}`)}
                        </Badge>
                      )}
                      {tx.matchStatus === 'matched' && tx.matchedDocumentId && (
                        <Link
                          to="/faktury/$id"
                          params={{ id: tx.matchedDocumentId }}
                          className="inline-flex h-6 items-center gap-1.5 rounded-md bg-success/12 px-2 text-xs font-medium text-success transition-colors hover:bg-success/20"
                        >
                          <FileCheck2 className="size-3.5" />
                          {t.paidInvoice} {tx.matchedDocumentNumber}
                        </Link>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-muted-foreground">
                      <time dateTime={tx.bookedOn} className="tabular-nums">
                        {formatDateCs(tx.bookedOn)}
                      </time>
                      {tx.variableSymbol && (
                        <span className="tabular-nums">
                          {t.vs} {tx.variableSymbol}
                        </span>
                      )}
                      {tx.counterpartyAccount && (
                        <span className="tabular-nums">{tx.counterpartyAccount}</span>
                      )}
                      {tx.message && <span className="min-w-0 break-words">{tx.message}</span>}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <Amount
                      value={tx.amount}
                      currency={tx.currency}
                      size="inline"
                      tone={incoming ? 'default' : 'muted'}
                      className="text-[15px]"
                    />
                    {tx.matchStatus === 'unmatched' && incoming && tx.suggestions.length === 0 && (
                      <div className="mt-2 hidden justify-end gap-1.5 sm:flex">
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() =>
                            setPairing({ id: tx.id, amount: tx.amount, currency: tx.currency })
                          }
                        >
                          {t.pairWith}
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => ignore.mutate({ transactionId: tx.id, ignored: true })}
                        >
                          {t.ignore}
                        </Button>
                      </div>
                    )}
                    {tx.matchStatus === 'matched' && (
                      <Button
                        variant="ghost"
                        size="xs"
                        className="row-actions -mr-1.5 mt-1"
                        disabled={unmatch.isPending}
                        onClick={() => unmatch.mutate({ transactionId: tx.id })}
                      >
                        {t.unmatch}
                      </Button>
                    )}
                    {tx.matchStatus === 'ignored' && (
                      <Button
                        variant="ghost"
                        size="xs"
                        className="row-actions -mr-1.5 mt-1"
                        onClick={() => ignore.mutate({ transactionId: tx.id, ignored: false })}
                      >
                        {t.restore}
                      </Button>
                    )}
                  </div>
                </div>

                {tx.matchStatus === 'unmatched' && incoming && (
                  <div
                    className={cn(
                      'mt-3 space-y-2 sm:ml-[52px]',
                      tx.suggestions.length === 0 && 'sm:hidden',
                    )}
                  >
                    {tx.suggestions.map((s) => (
                      <div
                        key={s.documentId}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/[0.045] px-3.5 py-3"
                      >
                        <div className="min-w-0 space-y-1.5">
                          <p className="label-caps flex items-center gap-1.5 text-primary">
                            <Sparkles className="size-3" /> {t.suggestion}
                          </p>
                          <p className="text-sm">
                            <span className="font-serif text-base font-medium tabular-nums">
                              {s.number}
                            </span>
                            {s.customerName && (
                              <span className="text-muted-foreground"> · {s.customerName}</span>
                            )}
                            <span className="text-muted-foreground"> · {t.remaining} </span>
                            <Amount value={s.remaining} currency={s.currency} size="sm" />
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {s.reasons.map((r) => (
                              <span
                                key={r}
                                className="rounded-md bg-background/70 px-1.5 py-0.5 text-[11px] text-muted-foreground ring-1 ring-border"
                              >
                                {t.reasons[r]}
                              </span>
                            ))}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          disabled={confirm.isPending}
                          onClick={() =>
                            confirm.mutate({ transactionId: tx.id, documentId: s.documentId })
                          }
                        >
                          <Check /> {t.confirm}
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
            )
          })}
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
