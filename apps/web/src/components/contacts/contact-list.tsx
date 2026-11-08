import type { RouterOutputs } from '@fakturky/core/router'
import { Amount } from '@fakturky/ui/components/amount'
import { Button } from '@fakturky/ui/components/button'
import { RelativeDate } from '@fakturky/ui/components/relative-date'
import { cn } from '@fakturky/ui/lib/utils'
import { Link, useNavigate } from '@tanstack/react-router'
import { FilePlus2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { crowns } from '@/components/invoices/summary-strip'
import { cs } from '@/i18n/cs'
import { ContactMenu, useNewInvoiceFor } from './contact-menu'

type Contact = RouterOutputs['contacts']['list'][number]
type Stat = RouterOutputs['contacts']['stats'][number]
type SortKey = 'name' | 'invoiced' | 'outstanding' | 'last'

const t = cs.contacts
const czech = new Intl.Collator('cs')

function sortValue(c: Contact, s: Stat | undefined, key: SortKey) {
  if (key === 'invoiced') return Number(s?.invoiced ?? 0)
  if (key === 'outstanding') return Number(s?.outstanding ?? 0)
  if (key === 'last') return s?.lastInvoiceDate ?? ''
  return c.name
}

function SortHeader({
  column,
  sort,
  dir,
  onSort,
  align = 'left',
  children,
}: {
  column: SortKey
  sort: SortKey
  dir: 'asc' | 'desc'
  onSort: (c: SortKey) => void
  align?: 'left' | 'right'
  children: string
}) {
  const active = sort === column
  return (
    <th
      scope="col"
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}
      className={cn('h-10 px-3 font-normal', align === 'right' ? 'text-right' : 'text-left')}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          'rounded text-[13px] outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50',
          active ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {children}
        {active && (
          <span aria-hidden className="ml-1">
            {dir === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </button>
    </th>
  )
}

function Unpaid({ s }: { s: Stat | undefined }) {
  if (!s || Number(s.outstanding) <= 0) return <span className="text-muted-foreground">—</span>
  return (
    <Amount
      value={s.outstanding}
      size="inline"
      hideZeroFraction
      tone={Number(s.overdue) > 0 ? 'overdue' : 'default'}
    />
  )
}

/** Desktop: hover reveals "Nová faktura" (preselects the customer); touch always shows it. */
function NewInvoiceButton({ contact }: { contact: Contact }) {
  const newInvoice = useNewInvoiceFor()
  return (
    <Button
      variant="ghost"
      aria-describedby={`contact-name-${contact.id}`}
      onClick={(e) => {
        e.stopPropagation()
        newInvoice(contact.id)
      }}
    >
      <FilePlus2 aria-hidden /> {t.newInvoiceFor}
    </Button>
  )
}

/**
 * Flat contact list: table from the `@4xl` container width up (its fixed columns need 46rem plus a name column), two-line rows below.
 * Owns sorting; the caller owns data and the search term.
 */
export function ContactList({
  contacts,
  stats,
}: {
  contacts: Contact[]
  stats: Stat[] | undefined
}) {
  const navigate = useNavigate()
  const newInvoice = useNewInvoiceFor()
  const [sort, setSort] = useState<SortKey>('name')
  const [dir, setDir] = useState<'asc' | 'desc'>('asc')
  const byId = useMemo(() => new Map(stats?.map((s) => [s.contactId, s])), [stats])
  const rows = useMemo(() => {
    return [...contacts].sort((a, b) => {
      const x = sortValue(a, byId.get(a.id), sort)
      const y = sortValue(b, byId.get(b.id), sort)
      const r =
        typeof x === 'string' && typeof y === 'string'
          ? czech.compare(x, y)
          : x < y
            ? -1
            : x > y
              ? 1
              : 0
      const byName = r || czech.compare(a.name, b.name)
      return dir === 'asc' ? byName : -byName
    })
  }, [contacts, byId, sort, dir])

  const onSort = (c: SortKey) => {
    if (c === sort) setDir(dir === 'asc' ? 'desc' : 'asc')
    else {
      setSort(c)
      setDir(c === 'name' ? 'asc' : 'desc')
    }
  }

  return (
    <>
      <ul className="@4xl:hidden">
        {rows.map((c) => {
          const s = byId.get(c.id)
          const overdue = s && Number(s.overdue) > 0
          return (
            <li
              key={c.id}
              className="row-hover relative flex min-h-[3.75rem] items-center gap-2 border-b py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <Link
                    to="/kontakty/$id"
                    params={{ id: c.id }}
                    className="truncate text-[15px] font-medium outline-none after:absolute after:inset-0 focus-visible:underline"
                  >
                    {c.name}
                  </Link>
                  <Amount value={s?.invoiced ?? '0.00'} size="inline" hideZeroFraction />
                </div>
                <div className="mt-0.5 flex items-baseline justify-between gap-3 text-[13px] text-muted-foreground">
                  <span className="truncate">{c.ico ? `${t.ico} ${c.ico}` : ''}</span>
                  {s && Number(s.outstanding) > 0 && (
                    <span className={cn('whitespace-nowrap', overdue && 'text-destructive')}>
                      {t.columns.outstanding.toLowerCase()} {crowns(s.outstanding)}
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="relative z-10 text-muted-foreground"
                aria-label={cs.palette.newInvoiceFor(c.name)}
                onClick={() => newInvoice(c.id)}
              >
                <FilePlus2 aria-hidden />
              </Button>
            </li>
          )
        })}
      </ul>

      <table className="hidden w-full border-separate border-spacing-0 table-fixed text-sm @4xl:table [&_td:first-child]:pl-0 [&_th:first-child]:pl-0 [&_td:last-child]:pr-0 [&_th:last-child]:pr-0">
        <colgroup>
          <col />
          <col className="w-28" />
          <col className="w-40" />
          <col className="w-32" />
          <col className="w-36" />
          <col className="w-48" />
        </colgroup>
        <thead>
          <tr>
            <SortHeader column="name" sort={sort} dir={dir} onSort={onSort}>
              {t.columns.name}
            </SortHeader>
            <th
              scope="col"
              className="h-10 px-3 text-left text-[13px] font-normal text-muted-foreground"
            >
              {t.ico}
            </th>
            <SortHeader column="invoiced" sort={sort} dir={dir} onSort={onSort} align="right">
              {t.columns.invoiced}
            </SortHeader>
            <SortHeader column="outstanding" sort={sort} dir={dir} onSort={onSort} align="right">
              {t.columns.outstanding}
            </SortHeader>
            <SortHeader column="last" sort={sort} dir={dir} onSort={onSort}>
              {t.columns.last}
            </SortHeader>
            <th scope="col">
              <span className="sr-only">{t.menu}</span>
            </th>
          </tr>
        </thead>
        <tbody className="[&>tr>td]:border-t">
          {rows.map((c) => {
            const s = byId.get(c.id)
            return (
              <tr
                key={c.id}
                onClick={(e) => {
                  // Links and buttons inside the row handle their own clicks (incl. ctrl/cmd-click).
                  if ((e.target as Element).closest('a,button')) return
                  navigate({ to: '/kontakty/$id', params: { id: c.id } })
                }}
                className="row-hover cursor-pointer"
              >
                <td className="h-14 max-w-0 px-3">
                  <Link
                    id={`contact-name-${c.id}`}
                    to="/kontakty/$id"
                    params={{ id: c.id }}
                    className="block truncate font-medium outline-none focus-visible:underline"
                  >
                    {c.name}
                  </Link>
                </td>
                <td className="px-3 whitespace-nowrap text-muted-foreground tabular-nums">
                  {c.ico ?? '—'}
                </td>
                <td className="px-3 text-right whitespace-nowrap">
                  {s ? (
                    <Amount value={s.invoiced} size="inline" hideZeroFraction />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 text-right whitespace-nowrap">
                  <Unpaid s={s} />
                </td>
                <td className="px-3 whitespace-nowrap text-muted-foreground">
                  {s?.lastInvoiceDate ? (
                    <RelativeDate date={s.lastInvoiceDate} />
                  ) : (
                    <span>{t.never}</span>
                  )}
                </td>
                <td className="px-3">
                  <div className="row-actions flex items-center justify-end gap-1">
                    <NewInvoiceButton contact={c} />
                    <ContactMenu contact={c} />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </>
  )
}
