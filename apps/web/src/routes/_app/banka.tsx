import { Button } from '@fakturky/ui/components/button'
import { NativeSelect } from '@fakturky/ui/components/native-select'
import { PageHeader, PageTabs } from '@fakturky/ui/components/page-header'
import { Skeleton } from '@fakturky/ui/components/skeleton'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { RefreshCw, Sparkles, Upload } from 'lucide-react'
import { useCallback, useState } from 'react'
import { BankEmpty, type BankFilter } from '@/components/bank/bank-empty'
import { useBankSync } from '@/components/bank/bank-mutations'
import { PairDialog } from '@/components/bank/pair-dialog'
import { type PairTarget, TransactionList } from '@/components/bank/transaction-list'
import { UploadStatementDialog } from '@/components/bank/upload-statement-dialog'
import { ErrorState } from '@/components/error-state'
import { SearchField } from '@/components/search-field'
import { cs } from '@/i18n/cs'
import { pageHead } from '@/lib/head'
import { orpc } from '@/lib/orpc'
import { useUrlSearchTerm } from '@/lib/use-url-search-term'

const FILTERS = ['unmatched', 'matched', 'ignored', 'outgoing'] as const satisfies BankFilter[]

export const Route = createFileRoute('/_app/banka')({
  head: pageHead(cs.bank.title),
  // Plain validation (no zod): keeps the schema library out of the client bundle.
  validateSearch: (
    search: Record<string, unknown>,
  ): { filter?: BankFilter; q?: string; ucet?: string } => ({
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
  const commitSearch = useCallback(
    (next: string | undefined) => navigate({ search: (s) => ({ ...s, q: next }), replace: true }),
    [navigate],
  )
  const [term, setTerm] = useUrlSearchTerm(q, commitSearch)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [pairing, setPairing] = useState<PairTarget | null>(null)

  const accounts = useQuery(orpc.bankAccounts.list.queryOptions({ input: {} }))
  const list = useQuery(
    orpc.bank.list.queryOptions({
      input: {
        // Outgoing payments are stored but never paired; they get their own tab so no row goes missing.
        ...(filter === 'outgoing'
          ? { status: 'unmatched' as const, direction: 'debit' as const }
          : { status: filter }),
        search: q || undefined,
        bankAccountId: ucet,
        limit: 100,
      },
    }),
  )
  const accountList = accounts.data ?? []
  const selected = accountList.find((a) => a.id === ucet)
  const fioAccounts = selected ? [selected] : accountList.filter((a) => a.fioConnected)
  const { sync, autoMatch } = useBankSync(fioAccounts.map((a) => a.id))

  const counts = list.data?.counts
  const items = list.data?.items ?? []
  const total = counts ? counts.unmatched + counts.matched + counts.ignored : 0
  const subtitle = counts
    ? total === 0
      ? t.subtitleEmpty
      : t.subtitle(counts.unmatched, counts.matched)
    : undefined

  return (
    <div className="mx-auto max-w-[1200px] pb-20 sm:pb-0">
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
            onValueChange={(id) =>
              navigate({ search: (s) => ({ ...s, filter: id as BankFilter }) })
            }
            items={FILTERS.map((f) => ({
              id: f,
              label: t.filters[f],
              ...(counts ? { count: counts[f] } : {}),
            }))}
          />
        }
      />

      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SearchField
          className="sm:w-80"
          placeholder={t.search}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
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
        <div aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex h-[3.75rem] items-center justify-between border-b">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <BankEmpty
          hasAccounts={accountList.length > 0}
          hasPayments={total > 0}
          filter={filter}
          searching={!!q}
          onUpload={() => setUploadOpen(true)}
        />
      ) : (
        <TransactionList items={items} onPair={setPairing} />
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
