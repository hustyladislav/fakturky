import { Button } from '@fakturky/ui/components/button'
import { EmptyState } from '@fakturky/ui/components/empty-state'
import { PageHeader } from '@fakturky/ui/components/page-header'
import { Skeleton } from '@fakturky/ui/components/skeleton'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import { CsvDownload } from '@/components/csv-download'
import { ErrorState } from '@/components/error-state'
import { BulkBar } from '@/components/invoices/bulk-bar'
import { FilterBar } from '@/components/invoices/filter-bar'
import { InvoiceTable } from '@/components/invoices/invoice-table'
import {
  type DocType,
  type Filter,
  nextSort,
  validateListSearch,
} from '@/components/invoices/list-search'
import { crowns } from '@/components/invoices/money'
import { type Stats, StatusTabs } from '@/components/invoices/status-tabs'
import { useInvoiceList } from '@/components/invoices/use-invoice-list'
import { useInvoiceSelection } from '@/components/invoices/use-invoice-selection'
import { cs } from '@/i18n/cs'
import { pageHead } from '@/lib/head'

const t = cs.invoices

export const Route = createFileRoute('/_app/faktury/')({
  head: pageHead(t.title),
  validateSearch: validateListSearch,
  component: InvoiceList,
})

/** The sum belongs to the active tab: "7 dokladů · 68 970 Kč po splatnosti". */
function subtitleFor(stats: Stats | undefined, filter: Filter) {
  if (!stats) return undefined
  if (filter === 'all')
    return t.subtitle(stats.all.count, stats.unpaid.count > 0 ? crowns(stats.unpaid.sum) : null)
  const b = stats[filter]
  return `${t.subtitle(b.count, null)} · ${crowns(b.sum)} ${t.subtitleSum[filter]}`
}

function ListSkeleton() {
  return (
    <div className="divide-y divide-border/70" aria-busy="true">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex items-center justify-between gap-6 py-4">
          <Skeleton className="h-3.5 w-1/3" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  )
}

function InvoiceList() {
  const search = Route.useSearch()
  const { filter = 'all', q, type, sort = 'issueDate', dir = 'desc' } = search
  const navigate = useNavigate({ from: Route.fullPath })
  const [resetKey, setResetKey] = useState(0)

  const list = useInvoiceList(search)
  const selection = useInvoiceSelection(list.rows, `${filter}|${q}|${type}|${sort}|${dir}`)

  const onSearch = useCallback(
    (next: string | undefined) => navigate({ search: (s) => ({ ...s, q: next }), replace: true }),
    [navigate],
  )
  const onType = (next: DocType | undefined) => navigate({ search: (s) => ({ ...s, type: next }) })
  const onFilter = (f: Filter) =>
    navigate({ search: (s) => ({ ...s, filter: f === 'all' ? undefined : f }) })
  const onSort = (column: Parameters<typeof nextSort>[1]) =>
    navigate({ search: (s) => ({ ...s, ...nextSort({ sort, dir }, column) }) })

  const noDocsAtAll = list.stats?.all.count === 0 && !q && !type
  const filteredEmpty = list.isLoaded && list.rows.length === 0 && !noDocsAtAll

  return (
    <>
      <div className="@container mx-auto max-w-[1200px] pb-24 sm:pb-0">
        <PageHeader
          title={t.title}
          subtitle={subtitleFor(list.stats, filter)}
          actions={
            <div className="hidden sm:block">
              <CsvDownload kind="documents" />
            </div>
          }
        />

        {list.isLoadingError ? (
          <ErrorState onRetry={list.refetch} />
        ) : noDocsAtAll ? (
          <EmptyState
            illustration="invoices"
            title={t.empty}
            action={
              <Button nativeButton={false} render={<Link to="/faktury/nova" />}>
                {t.emptyCta}
              </Button>
            }
          />
        ) : (
          <>
            <StatusTabs stats={list.stats} value={filter} onChange={onFilter} />
            <FilterBar key={resetKey} q={q} type={type} onSearch={onSearch} onType={onType} />

            {list.isPending ? (
              <ListSkeleton />
            ) : filteredEmpty ? (
              <EmptyState
                illustration="search"
                title={t.emptyFilteredBy(q ?? null, [
                  ...(filter !== 'all' ? [String(t.filters[filter])] : []),
                  ...(type ? [String(t.type[type])] : []),
                ])}
                action={
                  <Button
                    variant="outline"
                    onClick={() => {
                      setResetKey((k) => k + 1)
                      navigate({ search: {} })
                    }}
                  >
                    {t.resetFilter}
                  </Button>
                }
              />
            ) : (
              <>
                <InvoiceTable
                  groups={list.groups}
                  grouped={list.grouped}
                  hasNextPage={!!list.hasNextPage}
                  sort={sort}
                  dir={dir}
                  onSort={onSort}
                  selection={selection}
                />
                <div className="mt-4 flex items-center justify-between gap-4 text-xs text-muted-foreground">
                  <span className="hidden md:inline">{t.keyboardHint}</span>
                  {list.hasNextPage && list.stats && (
                    <span className="tabular-nums">
                      {t.shown(list.rows.length, list.stats[filter].count)}
                    </span>
                  )}
                  {list.hasNextPage && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mx-auto md:mx-0"
                      disabled={list.isFetchingNextPage}
                      onClick={list.fetchNextPage}
                    >
                      {t.loadMore}
                    </Button>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
      {selection.selectedDocs.length > 0 && (
        <BulkBar
          selected={selection.selectedDocs}
          sum={selection.selectedSum}
          onClear={selection.clear}
        />
      )}
    </>
  )
}
