import { formatDateCs } from '@fakturky/domain/dates'
import { Button } from '@fakturky/ui/components/button'
import { Input } from '@fakturky/ui/components/input'
import { Money } from '@fakturky/ui/components/money'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Plus, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import { CsvDownload } from '@/components/csv-download'
import { InvoiceStatus } from '@/components/invoice-status'
import { cs } from '@/i18n/cs'
import { pageHead } from '@/lib/head'
import { orpc } from '@/lib/orpc'

const FILTERS = ['all', 'unpaid', 'overdue', 'paid', 'draft'] as const

export const Route = createFileRoute('/_app/faktury/')({
  head: pageHead(cs.invoices.title),
  validateSearch: z.object({
    filter: z.enum(FILTERS).catch('all').default('all'),
    q: z.string().optional(),
  }),
  component: InvoiceList,
})

function InvoiceList() {
  const { filter, q } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const [term, setTerm] = useState(q ?? '')
  useEffect(() => {
    const h = setTimeout(() => {
      if ((q ?? '') !== term)
        navigate({ search: (s) => ({ ...s, q: term || undefined }), replace: true })
    }, 250)
    return () => clearTimeout(h)
  }, [term, q, navigate])

  const list = useQuery(
    orpc.documents.list.queryOptions({ input: { filter, search: q || undefined } }),
  )
  const t = cs.invoices

  return (
    <div className="mx-auto max-w-[1200px] space-y-4 pb-20 sm:pb-0">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <div className="hidden gap-2 sm:flex">
          <CsvDownload kind="documents" />
          <Button nativeButton={false} render={<Link to="/faktury/nova" />}>
            <Plus /> {t.new}
          </Button>
        </div>
      </div>

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
              render={<Link to="/faktury" search={{ filter: f, q }} />}
            >
              {t.filters[f]}
            </Button>
          ))}
        </div>
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

      {list.data?.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-start gap-3 rounded-xl border p-6">
          <p>{filter === 'all' && !q ? t.empty : t.emptyFiltered}</p>
          {filter === 'all' && !q && (
            <Button nativeButton={false} render={<Link to="/faktury/nova" />}>
              {t.emptyCta}
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Phone: one card-like row per invoice; the table below is for sm+ */}
          <ul className="divide-y overflow-hidden rounded-xl border sm:hidden">
            {list.data?.map((d) => (
              <li key={d.id}>
                <Link
                  to={d.status === 'draft' ? '/faktury/$id/upravit' : '/faktury/$id'}
                  params={{ id: d.id }}
                  className="hover:bg-muted/30 flex items-center justify-between gap-3 p-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium whitespace-nowrap tabular-nums">
                      {d.number ?? t.draftNumber}
                    </div>
                    <div className="text-muted-foreground truncate text-sm">
                      {d.customerName ?? '—'}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Money amount={d.total} currency={d.currency} />
                    <InvoiceStatus status={d.displayStatus} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-hidden rounded-xl border sm:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground hidden text-left text-xs sm:table-header-group">
                <tr>
                  <th className="px-4 py-2 font-medium">{t.columns.number}</th>
                  <th className="px-4 py-2 font-medium">{t.columns.customer}</th>
                  <th className="px-4 py-2 font-medium">{t.columns.issued}</th>
                  <th className="px-4 py-2 font-medium">{t.columns.due}</th>
                  <th className="px-4 py-2 text-right font-medium">{t.columns.total}</th>
                  <th className="px-4 py-2 font-medium">{t.columns.status}</th>
                </tr>
              </thead>
              <tbody>
                {list.data?.map((d) => (
                  <tr key={d.id} className="hover:bg-muted/30 border-t [&>td]:p-0">
                    <Cell id={d.id} draft={d.status === 'draft'} strong>
                      {d.number ?? t.draftNumber}
                    </Cell>
                    <Cell id={d.id} draft={d.status === 'draft'}>
                      {d.customerName ?? '—'}
                    </Cell>
                    <Cell id={d.id} draft={d.status === 'draft'} hide>
                      {d.issueDate ? formatDateCs(d.issueDate) : '—'}
                    </Cell>
                    <Cell id={d.id} draft={d.status === 'draft'} hide>
                      {d.dueDate ? formatDateCs(d.dueDate) : '—'}
                    </Cell>
                    <Cell id={d.id} draft={d.status === 'draft'} right>
                      <Money amount={d.total} currency={d.currency} />
                    </Cell>
                    <Cell id={d.id} draft={d.status === 'draft'}>
                      <InvoiceStatus status={d.displayStatus} />
                    </Cell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function Cell({
  id,
  draft,
  children,
  hide,
  right,
  strong,
}: {
  id: string
  draft: boolean
  children: React.ReactNode
  hide?: boolean
  right?: boolean
  strong?: boolean
}) {
  const cls = `block px-4 py-3 whitespace-nowrap ${strong ? 'font-medium tabular-nums' : ''}`
  return (
    <td className={`${hide ? 'hidden sm:table-cell' : ''} ${right ? 'text-right' : ''}`}>
      {draft ? (
        <Link to="/faktury/$id/upravit" params={{ id }} className={cls} tabIndex={strong ? 0 : -1}>
          {children}
        </Link>
      ) : (
        <Link to="/faktury/$id" params={{ id }} className={cls} tabIndex={strong ? 0 : -1}>
          {children}
        </Link>
      )}
    </td>
  )
}
