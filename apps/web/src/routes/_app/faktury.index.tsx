import { Button } from '@fakturky/ui/components/button'
import { EmptyState } from '@fakturky/ui/components/empty-state'
import { Input } from '@fakturky/ui/components/input'
import { NativeSelect } from '@fakturky/ui/components/native-select'
import { PageHeader } from '@fakturky/ui/components/page-header'
import { Skeleton } from '@fakturky/ui/components/skeleton'
import { cn } from '@fakturky/ui/lib/utils'
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, ChevronsUpDown, Plus, Search } from 'lucide-react'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { CsvDownload } from '@/components/csv-download'
import { BulkBar } from '@/components/invoices/bulk-bar'
import { type Doc, docPath, InvoiceCard, InvoiceRow } from '@/components/invoices/invoice-rows'
import { crowns, type StripFilter, SummaryStrip } from '@/components/invoices/summary-strip'
import { cs } from '@/i18n/cs'
import { pageHead } from '@/lib/head'
import { czkTotal, groupByMonth } from '@/lib/invoice-groups'
import { orpc } from '@/lib/orpc'

const TYPES = ['invoice', 'proforma', 'credit_note', 'payment_receipt'] as const
const FILTERS = ['all', 'unpaid', 'overdue', 'paid', 'draft'] as const
const SORTS = ['issueDate', 'dueDate', 'number', 'customer', 'total'] as const
type Sort = (typeof SORTS)[number]
const PAGE = 100

export const Route = createFileRoute('/_app/faktury/')({
  head: pageHead(cs.invoices.title),
  // Plain validation (no zod): keeps the schema library out of the client bundle.
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    filter?: (typeof FILTERS)[number]
    q?: string
    type?: (typeof TYPES)[number]
    sort?: Sort
    dir?: 'asc' | 'desc'
  } => ({
    filter: FILTERS.find((f) => f === search.filter),
    type: TYPES.find((x) => x === search.type),
    q: typeof search.q === 'string' && search.q ? search.q : undefined,
    sort: SORTS.find((x) => x === search.sort),
    dir: search.dir === 'asc' || search.dir === 'desc' ? search.dir : undefined,
  }),
  component: InvoiceList,
})

const monthLabel = (key: string) => {
  if (key === 'none') return cs.invoices.noMonth
  const [y, m] = key.split('-').map(Number)
  return new Intl.DateTimeFormat('cs-CZ', { month: 'long', year: 'numeric' }).format(
    new Date(y ?? 1970, (m ?? 1) - 1, 1),
  )
}

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) &&
    !(target instanceof HTMLInputElement && target.type === 'checkbox')
  )
}

function SortHeader({
  column,
  sort,
  dir,
  onSort,
  children,
  className,
}: {
  column: Sort
  sort: Sort
  dir: 'asc' | 'desc'
  onSort: (c: Sort) => void
  children: string
  className?: string
}) {
  const active = sort === column
  const Icon = !active ? ChevronsUpDown : dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      aria-label={cs.invoices.sortBy(children)}
      className={cn(
        'label-caps inline-flex items-center gap-1 rounded outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50',
        active && 'text-foreground',
        className,
      )}
    >
      {children}
      <Icon className={cn('size-3', !active && 'opacity-40')} aria-hidden />
    </button>
  )
}

function InvoiceList() {
  const { filter = 'all', q, type, sort = 'issueDate', dir = 'desc' } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const [term, setTerm] = useState(q ?? '')
  useEffect(() => {
    const h = setTimeout(() => {
      if ((q ?? '') !== term)
        navigate({ search: (s) => ({ ...s, q: term || undefined }), replace: true })
    }, 250)
    return () => clearTimeout(h)
  }, [term, q, navigate])

  const t = cs.invoices
  const stats = useQuery({
    ...orpc.documents.stats.queryOptions({ input: { search: q || undefined, type } }),
    placeholderData: keepPreviousData,
  })
  const list = useInfiniteQuery({
    ...orpc.documents.list.infiniteOptions({
      input: (offset: number) => ({
        filter,
        search: q || undefined,
        type,
        sort,
        dir,
        limit: PAGE,
        offset,
      }),
      initialPageParam: 0,
      getNextPageParam: (last, all) =>
        last.length === PAGE ? all.reduce((n, p) => n + p.length, 0) : undefined,
    }),
    placeholderData: keepPreviousData,
  })

  const rows = useMemo<Doc[]>(() => list.data?.pages.flat() ?? [], [list.data])
  const grouped = sort === 'issueDate'
  const groups = useMemo(
    () => (grouped ? groupByMonth(rows) : [{ key: 'all', rows, sum: '0.00' }]),
    [grouped, rows],
  )

  // Selection + keyboard cursor
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [cursor, setCursor] = useState(-1)
  useEffect(() => {
    setSelected(new Set())
    setCursor(-1)
  }, [filter, q, type, sort, dir])

  const selectedDocs = rows.filter((d) => selected.has(d.id))
  const selectedSum = selectedDocs
    .filter((d) => d.status === 'issued' || d.status === 'paid')
    .reduce((n, d) => n + Number(czkTotal(d).toFixed(2)), 0)
    .toFixed(2)
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (!n.delete(id)) n.add(id)
      return n
    })
  const allSelected = rows.length > 0 && selected.size === rows.length

  const rowsRef = useRef(rows)
  rowsRef.current = rows
  const cursorRef = useRef(cursor)
  cursorRef.current = cursor
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return
      if (document.querySelector('[role=dialog]')) return
      const all = rowsRef.current
      const key = e.key.toLowerCase()
      if (key === 'j' || key === 'k') {
        e.preventDefault()
        const next = Math.max(
          0,
          Math.min(all.length - 1, cursorRef.current + (key === 'j' ? 1 : -1)),
        )
        setCursor(next)
        const id = all[next]?.id
        if (id)
          document
            .querySelector(`[data-doc-id="${id}"]`)
            ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      } else if (key === 'enter' && cursorRef.current >= 0) {
        const d = all[cursorRef.current]
        if (
          d &&
          !(e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement)
        ) {
          e.preventDefault()
          navigate({ to: docPath(d), params: { id: d.id } })
        }
      } else if (key === 'x' && cursorRef.current >= 0) {
        const d = all[cursorRef.current]
        if (d) toggle(d.id)
      } else if (e.key === 'Escape') {
        setSelected(new Set())
        setCursor(-1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  const onSort = (c: Sort) =>
    navigate({
      search: (s) => ({
        ...s,
        sort: c === 'issueDate' && dir === 'desc' && sort !== c ? undefined : c,
        dir:
          sort === c
            ? dir === 'desc'
              ? 'asc'
              : 'desc'
            : c === 'customer' || c === 'number'
              ? 'asc'
              : 'desc',
      }),
    })

  const total = stats.data?.all.count
  const subtitle = stats.data
    ? t.subtitle(
        stats.data.all.count,
        stats.data.unpaid.count > 0 ? crowns(stats.data.unpaid.sum) : null,
      )
    : undefined
  const noDocsAtAll = stats.isSuccess && total === 0 && !q && !type
  const filteredEmpty = list.isSuccess && rows.length === 0 && !noDocsAtAll

  return (
    <div className="mx-auto max-w-[1200px] pb-24 sm:pb-0">
      <PageHeader
        title={t.title}
        subtitle={subtitle}
        actions={
          <>
            <div className="hidden sm:block">
              <CsvDownload kind="documents" />
            </div>
            <Button nativeButton={false} render={<Link to="/faktury/nova" />}>
              <Plus /> {t.new}
            </Button>
          </>
        }
      />

      {noDocsAtAll ? (
        <EmptyState
          illustration="invoices"
          title={t.empty}
          className="bg-card"
          action={
            <Button nativeButton={false} render={<Link to="/faktury/nova" />}>
              {t.emptyCta}
            </Button>
          }
        />
      ) : (
        <>
          <SummaryStrip
            stats={stats.data}
            value={filter as StripFilter}
            onChange={(f) =>
              navigate({ search: (s) => ({ ...s, filter: f === 'all' ? undefined : f }) })
            }
          />

          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative sm:w-96">
              <Search
                className="absolute top-2.5 left-2.5 size-4 text-muted-foreground"
                aria-hidden
              />
              <Input
                className="bg-card pl-8"
                placeholder={t.search}
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                aria-label={cs.common.search}
              />
            </div>
            <NativeSelect
              className="bg-card sm:w-56"
              aria-label={t.columns.type}
              value={type ?? ''}
              onChange={(e) =>
                navigate({
                  search: (s) => ({ ...s, type: TYPES.find((x) => x === e.target.value) }),
                })
              }
            >
              <option value="">{t.allTypes}</option>
              {TYPES.map((x) => (
                <option key={x} value={x}>
                  {t.type[x]}
                </option>
              ))}
            </NativeSelect>
          </div>

          {list.isPending ? (
            <div className="sheet divide-y divide-border/60" aria-busy="true">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="size-9 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-1/3" />
                    <Skeleton className="h-3 w-1/5" />
                  </div>
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          ) : filteredEmpty ? (
            <EmptyState
              illustration="search"
              title={t.emptyFilteredBy(q ?? null, [
                ...(filter !== 'all' ? [String(t.filters[filter])] : []),
                ...(type ? [String(t.type[type])] : []),
              ])}
              className="bg-card"
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setTerm('')
                    navigate({ search: {} })
                  }}
                >
                  {t.resetFilter}
                </Button>
              }
            />
          ) : (
            <>
              {/* Phone: grouped cards; the table below is for md+ */}
              <div className="sheet overflow-hidden md:hidden">
                {groups.map((g) => (
                  <Fragment key={g.key}>
                    {grouped && (
                      <div className="sticky top-14 z-10 flex items-baseline justify-between border-b bg-[color-mix(in_srgb,var(--card)_60%,var(--muted))] px-4 py-2">
                        <span className="label-caps text-foreground">{monthLabel(g.key)}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {Number(g.sum) === 0 ? '' : `${cs.invoices.issuedLabel} ${crowns(g.sum)}`}
                        </span>
                      </div>
                    )}
                    <ul>
                      {g.rows.map((d) => (
                        <InvoiceCard key={d.id} d={d} />
                      ))}
                    </ul>
                  </Fragment>
                ))}
              </div>

              <div className="sheet hidden md:block">
                <table className="w-full border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr className="[&>th]:sticky [&>th]:top-14 [&>th]:z-20 [&>th]:border-b [&>th]:bg-card [&>th]:py-3 [&>th]:text-left [&>th]:font-normal">
                      <th className="w-10 rounded-tl-xl pl-4">
                        <input
                          type="checkbox"
                          aria-label={t.bulk.selectAll}
                          checked={allSelected}
                          onChange={() =>
                            setSelected(allSelected ? new Set() : new Set(rows.map((d) => d.id)))
                          }
                          className="size-4 cursor-pointer align-middle"
                        />
                      </th>
                      <th className="pr-3 pl-2">
                        <SortHeader column="customer" sort={sort} dir={dir} onSort={onSort}>
                          {t.columns.customer}
                        </SortHeader>
                        <span className="label-caps mx-1.5" aria-hidden>
                          ·
                        </span>
                        <SortHeader column="number" sort={sort} dir={dir} onSort={onSort}>
                          {t.columns.number}
                        </SortHeader>
                      </th>
                      <th className="hidden px-3 lg:table-cell">
                        <SortHeader column="issueDate" sort={sort} dir={dir} onSort={onSort}>
                          {t.columns.issued}
                        </SortHeader>
                      </th>
                      <th className="px-3">
                        <SortHeader column="dueDate" sort={sort} dir={dir} onSort={onSort}>
                          {t.columns.due}
                        </SortHeader>
                      </th>
                      <th className="px-3 !text-right">
                        <SortHeader column="total" sort={sort} dir={dir} onSort={onSort}>
                          {t.columns.total}
                        </SortHeader>
                      </th>
                      <th className="px-3">
                        <span className="label-caps">{t.columns.status}</span>
                      </th>
                      <th className="w-[7.5rem] rounded-tr-xl" />
                    </tr>
                  </thead>
                  {groups.map((g) => (
                    <tbody key={g.key}>
                      {grouped && (
                        <tr>
                          <th
                            colSpan={7}
                            scope="colgroup"
                            className="sticky top-[6.25rem] z-10 border-b bg-[color-mix(in_srgb,var(--card)_55%,var(--muted))] px-4 py-2 text-left font-normal"
                          >
                            <span className="flex items-baseline justify-between gap-4">
                              <span className="label-caps text-foreground">
                                {monthLabel(g.key)}
                              </span>
                              <span className="text-xs text-muted-foreground tabular-nums">
                                {list.hasNextPage && g === groups.at(-1)
                                  ? t.monthTotal(g.rows.length, null)
                                  : t.monthTotal(
                                      g.rows.length,
                                      Number(g.sum) === 0 ? null : crowns(g.sum),
                                    )}
                              </span>
                            </span>
                          </th>
                        </tr>
                      )}
                      {g.rows.map((d) => (
                        <InvoiceRow
                          key={d.id}
                          d={d}
                          selected={selected.has(d.id)}
                          active={rows[cursor]?.id === d.id}
                          onToggle={() => toggle(d.id)}
                        />
                      ))}
                    </tbody>
                  ))}
                </table>
              </div>

              <div className="mt-4 flex items-center justify-between gap-4 text-xs text-muted-foreground">
                <span className="hidden md:inline">{t.keyboardHint}</span>
                {list.hasNextPage && stats.data && (
                  <span className="tabular-nums">
                    {t.shown(rows.length, stats.data[filter as StripFilter].count)}
                  </span>
                )}
                {list.hasNextPage && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mx-auto md:mx-0"
                    disabled={list.isFetchingNextPage}
                    onClick={() => list.fetchNextPage()}
                  >
                    {t.loadMore}
                  </Button>
                )}
              </div>
            </>
          )}
        </>
      )}

      {selectedDocs.length > 0 && (
        <BulkBar selected={selectedDocs} sum={selectedSum} onClear={() => setSelected(new Set())} />
      )}
    </div>
  )
}
