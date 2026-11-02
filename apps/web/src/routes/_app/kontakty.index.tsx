import { Amount } from '@fakturky/ui/components/amount'
import { Avatar } from '@fakturky/ui/components/avatar'
import { EmptyState } from '@fakturky/ui/components/empty-state'
import { Input } from '@fakturky/ui/components/input'
import { PageHeader } from '@fakturky/ui/components/page-header'
import { RelativeDate } from '@fakturky/ui/components/relative-date'
import { Skeleton } from '@fakturky/ui/components/skeleton'
import { cn } from '@fakturky/ui/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, ChevronsUpDown, Search } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { NewContact } from '@/components/contacts/contact-dialogs'
import { ContactMenu } from '@/components/contacts/contact-menu'
import { CsvDownload } from '@/components/csv-download'
import { crowns } from '@/components/invoices/summary-strip'
import { cs } from '@/i18n/cs'
import { pageHead } from '@/lib/head'
import { orpc } from '@/lib/orpc'

export const Route = createFileRoute('/_app/kontakty/')({
  head: pageHead(cs.contacts.title),
  validateSearch: (search: Record<string, unknown>): { novy?: boolean } =>
    search.novy === true || search.novy === 'true' ? { novy: true } : {},
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(orpc.contacts.list.queryOptions({ input: {} })),
  component: Contacts,
})

type SortKey = 'name' | 'invoiced' | 'outstanding' | 'last'
const t = cs.contacts

function SortHeader({
  column,
  sort,
  dir,
  onSort,
  children,
  className,
}: {
  column: SortKey
  sort: SortKey
  dir: 'asc' | 'desc'
  onSort: (c: SortKey) => void
  children: string
  className?: string
}) {
  const active = sort === column
  const Icon = !active ? ChevronsUpDown : dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
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

function Contacts() {
  const { novy } = Route.useSearch()
  const navigate = useNavigate()
  const list = useQuery(orpc.contacts.list.queryOptions({ input: {} }))
  const stats = useQuery(orpc.contacts.stats.queryOptions({ input: {} }))
  const [term, setTerm] = useState('')
  const [sort, setSort] = useState<SortKey>('name')
  const [dir, setDir] = useState<'asc' | 'desc'>('asc')
  const clearNovy = useCallback(() => {
    void navigate({ to: '/kontakty', search: {}, replace: true })
  }, [navigate])

  const byId = useMemo(() => new Map(stats.data?.map((s) => [s.contactId, s])), [stats.data])
  const rows = useMemo(() => {
    const q = term.trim().toLowerCase()
    const filtered = (list.data ?? []).filter(
      (c) => !q || c.name.toLowerCase().includes(q) || (c.ico ?? '').includes(q),
    )
    const val = (c: (typeof filtered)[number]) => {
      const s = byId.get(c.id)
      if (sort === 'invoiced') return Number(s?.invoiced ?? 0)
      if (sort === 'outstanding') return Number(s?.outstanding ?? 0)
      if (sort === 'last') return s?.lastInvoiceDate ?? ''
      return c.name.toLowerCase()
    }
    return filtered.sort((a, b) => {
      const x = val(a)
      const y = val(b)
      const r = x < y ? -1 : x > y ? 1 : a.name.localeCompare(b.name, 'cs')
      return dir === 'asc' ? r : -r
    })
  }, [list.data, byId, term, sort, dir])

  const onSort = (c: SortKey) => {
    if (c === sort) setDir(dir === 'asc' ? 'desc' : 'asc')
    else {
      setSort(c)
      setDir(c === 'name' ? 'asc' : 'desc')
    }
  }
  const totalOutstanding = (stats.data ?? []).reduce((n, s) => n + Number(s.outstanding), 0)
  const count = list.data?.length ?? 0
  const subtitle = list.data
    ? t.subtitle(count, totalOutstanding > 0 ? crowns(totalOutstanding.toFixed(2)) : null)
    : undefined

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        title={t.title}
        subtitle={subtitle}
        actions={
          <>
            <CsvDownload kind="contacts" />
            <NewContact openOnMount={novy} onOpened={clearNovy} />
          </>
        }
      />

      {list.data?.length === 0 ? (
        <EmptyState illustration="contacts" title={t.emptyTitle} className="bg-card">
          {t.empty}
        </EmptyState>
      ) : (
        <>
          <div className="relative mb-3 sm:w-96">
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

          {list.isPending ? (
            <div className="sheet divide-y divide-border/60" aria-busy="true">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="size-9 rounded-full" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState illustration="search" title={t.noMatch} className="bg-card" />
          ) : (
            <>
              <ul className="sheet overflow-hidden md:hidden">
                {rows.map((c) => {
                  const s = byId.get(c.id)
                  return (
                    <li
                      key={c.id}
                      className="row-hover relative flex items-center gap-3 border-b border-border/60 px-4 py-3 last:border-b-0"
                    >
                      <Avatar name={c.name} size="md" />
                      <div className="min-w-0 flex-1">
                        <Link
                          to="/kontakty/$id"
                          params={{ id: c.id }}
                          className="block truncate text-sm font-medium outline-none after:absolute after:inset-0"
                        >
                          {c.name}
                        </Link>
                        <div className="truncate text-xs text-muted-foreground">
                          {[c.ico && `${t.ico} ${c.ico}`, c.emails[0]]
                            .filter(Boolean)
                            .join(' · ') || '—'}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 text-right">
                        <Amount value={s?.invoiced ?? '0.00'} size="inline" hideZeroFraction />
                        {s && Number(s.outstanding) > 0 && (
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {t.columns.outstanding.toLowerCase()} {crowns(s.outstanding)}
                          </span>
                        )}
                      </div>
                      <div className="relative z-10">
                        <ContactMenu contact={c} />
                      </div>
                    </li>
                  )
                })}
              </ul>

              <div className="sheet hidden md:block">
                <table className="w-full border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr className="[&>th]:sticky [&>th]:top-14 [&>th]:z-20 [&>th]:border-b [&>th]:bg-card [&>th]:py-3 [&>th]:text-left [&>th]:font-normal">
                      <th className="rounded-tl-xl pl-4">
                        <SortHeader column="name" sort={sort} dir={dir} onSort={onSort}>
                          {t.columns.name}
                        </SortHeader>
                      </th>
                      <th className="hidden px-3 xl:table-cell">
                        <span className="label-caps">{t.columns.email}</span>
                      </th>
                      <th className="px-3 !text-right">
                        <SortHeader column="invoiced" sort={sort} dir={dir} onSort={onSort}>
                          {t.columns.invoiced}
                        </SortHeader>
                      </th>
                      <th className="px-3 !text-right">
                        <SortHeader column="outstanding" sort={sort} dir={dir} onSort={onSort}>
                          {t.columns.outstanding}
                        </SortHeader>
                      </th>
                      <th className="px-3">
                        <SortHeader column="last" sort={sort} dir={dir} onSort={onSort}>
                          {t.columns.last}
                        </SortHeader>
                      </th>
                      <th className="w-12 rounded-tr-xl pr-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((c) => {
                      const s = byId.get(c.id)
                      return (
                        <tr
                          key={c.id}
                          onClick={() => navigate({ to: '/kontakty/$id', params: { id: c.id } })}
                          className="row-hover cursor-pointer"
                        >
                          <td className="w-[38%] max-w-0 border-b border-border/60 py-2.5 pl-4">
                            <div className="flex items-center gap-3">
                              <Avatar name={c.name} size="md" />
                              <div className="min-w-0">
                                <Link
                                  to="/kontakty/$id"
                                  params={{ id: c.id }}
                                  className="block truncate font-medium outline-none focus-visible:underline"
                                >
                                  {c.name}
                                </Link>
                                <span className="text-xs whitespace-nowrap text-muted-foreground">
                                  {c.ico ? `${t.ico} ${c.ico}` : '—'}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="hidden max-w-[14rem] truncate border-b border-border/60 px-3 text-muted-foreground xl:table-cell">
                            {c.emails[0] ?? '—'}
                          </td>
                          <td className="border-b border-border/60 px-3 text-right whitespace-nowrap">
                            {s ? (
                              <Amount value={s.invoiced} size="inline" hideZeroFraction />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="border-b border-border/60 px-3 text-right whitespace-nowrap">
                            {s && Number(s.outstanding) > 0 ? (
                              <Amount
                                value={s.outstanding}
                                size="inline"
                                hideZeroFraction
                                tone={Number(s.overdue) > 0 ? 'overdue' : 'default'}
                              />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="border-b border-border/60 px-3 whitespace-nowrap text-muted-foreground">
                            {s?.lastInvoiceDate ? (
                              <RelativeDate date={s.lastInvoiceDate} />
                            ) : (
                              <span>{t.never}</span>
                            )}
                          </td>
                          <td className="border-b border-border/60 pr-3 text-right">
                            <ContactMenu contact={c} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
