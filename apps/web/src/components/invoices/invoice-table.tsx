import { cn } from '@fakturky/ui/lib/utils'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { Fragment } from 'react'
import { cs } from '@/i18n/cs'
import type { MonthGroup } from '@/lib/invoice-groups'
import { type Doc, InvoiceCompactRow, InvoiceRow } from './invoice-rows'
import type { Dir, Sort } from './list-search'
import { crowns } from './money'

const t = cs.invoices

export interface TableSelection {
  selected: Set<string>
  activeId: string | undefined
  allSelected: boolean
  toggle: (id: string) => void
  toggleAll: () => void
}

const monthLabel = (key: string) => {
  if (key === 'none') return t.noMonth
  const [y, m] = key.split('-').map(Number)
  return new Intl.DateTimeFormat('cs-CZ', { month: 'long', year: 'numeric' }).format(
    new Date(y ?? 1970, (m ?? 1) - 1, 1),
  )
}

function SortHeader({
  column,
  sort,
  dir,
  onSort,
  className,
}: {
  column: Sort
  sort: Sort
  dir: Dir
  onSort: (c: Sort) => void
  className?: string
}) {
  const label = {
    customer: t.columns.customer,
    number: t.columns.number,
    issueDate: t.columns.issued,
    dueDate: t.columns.due,
    total: t.columns.total,
  }[column]
  const active = sort === column
  const Icon = !active ? ChevronsUpDown : dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      aria-label={t.sortBy(label)}
      className={cn(
        'inline-flex items-center gap-1 rounded text-[13px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50',
        active && 'text-foreground',
        className,
      )}
    >
      {label}
      <Icon className={cn('size-3', !active && 'opacity-40')} aria-hidden />
    </button>
  )
}

function MonthLabel({ group, partial }: { group: MonthGroup<Doc>; partial: boolean }) {
  const sum = partial || Number(group.sum) === 0 ? null : crowns(group.sum)
  return (
    <span className="flex items-baseline justify-between gap-4">
      <span className="text-[13px] font-medium capitalize">{monthLabel(group.key)}</span>
      <span className="text-xs font-normal text-muted-foreground tabular-nums">
        {t.monthTotal(group.rows.length, sum)}
      </span>
    </span>
  )
}

/**
 * The invoice list as one flat surface: a table from the `@3xl` container up, compact two-line
 * rows on phones. Month headers (when sorted by issue date) are quiet labels with the subtotal.
 */
export function InvoiceTable({
  groups,
  grouped,
  hasNextPage,
  sort,
  dir,
  onSort,
  selection,
}: {
  groups: MonthGroup<Doc>[]
  grouped: boolean
  /** More pages exist, so the last month's subtotal would be incomplete. */
  hasNextPage: boolean
  sort: Sort
  dir: Dir
  onSort: (c: Sort) => void
  selection: TableSelection
}) {
  const last = groups.at(-1)
  return (
    <>
      <div className="@3xl:hidden">
        {groups.map((g) => (
          <Fragment key={g.key}>
            {grouped && (
              <div className="sticky top-14 z-10 border-b border-border/70 bg-background pt-3 pb-1">
                <MonthLabel group={g} partial={hasNextPage && g === last} />
              </div>
            )}
            <ul>
              {g.rows.map((d) => (
                <InvoiceCompactRow key={d.id} d={d} />
              ))}
            </ul>
          </Fragment>
        ))}
      </div>

      <table className="hidden w-full border-separate border-spacing-0 text-sm @3xl:table">
        <thead>
          <tr className="[&>th]:sticky [&>th]:top-14 [&>th]:z-20 [&>th]:border-b [&>th]:border-border [&>th]:bg-background [&>th]:py-2 [&>th]:pr-4 [&>th]:text-left [&>th]:font-normal">
            <th className="w-9 pl-1">
              <input
                type="checkbox"
                aria-label={t.bulk.selectAll}
                checked={selection.allSelected}
                onChange={selection.toggleAll}
                className="size-4 cursor-pointer align-middle"
              />
            </th>
            <th className="w-[30%]">
              <SortHeader column="customer" sort={sort} dir={dir} onSort={onSort} />
            </th>
            <th>
              <SortHeader column="number" sort={sort} dir={dir} onSort={onSort} />
            </th>
            <th>
              <SortHeader column="issueDate" sort={sort} dir={dir} onSort={onSort} />
            </th>
            <th>
              <SortHeader column="dueDate" sort={sort} dir={dir} onSort={onSort} />
            </th>
            <th className="!text-right">
              <SortHeader column="total" sort={sort} dir={dir} onSort={onSort} />
            </th>
            <th className="!pr-2">
              <span className="text-[13px] text-muted-foreground">{t.columns.status}</span>
            </th>
            <th className="w-28" />
          </tr>
        </thead>
        {groups.map((g) => (
          <tbody key={g.key}>
            {grouped && (
              <tr>
                <th
                  colSpan={8}
                  scope="colgroup"
                  className="border-b border-border/70 pt-6 pr-1 pb-2 pl-1 text-left font-normal"
                >
                  <MonthLabel group={g} partial={hasNextPage && g === last} />
                </th>
              </tr>
            )}
            {g.rows.map((d) => (
              <InvoiceRow
                key={d.id}
                d={d}
                selected={selection.selected.has(d.id)}
                active={selection.activeId === d.id}
                onToggle={() => selection.toggle(d.id)}
              />
            ))}
          </tbody>
        ))}
      </table>
    </>
  )
}
