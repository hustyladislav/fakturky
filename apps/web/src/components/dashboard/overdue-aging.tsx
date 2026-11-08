import type { RouterOutputs } from '@fakturky/core/router'
import { receivablesAging } from '@fakturky/domain/receivables'
import { Amount } from '@fakturky/ui/components/amount'
import { Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import { cs } from '@/i18n/cs'

type Doc = RouterOutputs['documents']['list'][number]

const t = cs.overview.aging

/** Rows loaded by the unpaid query on Přehled; beyond it the sums would silently be partial. */
export const AGING_ROW_CAP = 200

/**
 * One quiet row: how late the overdue money is. Hidden while loading, on error, when nothing is
 * overdue, and when the loaded rows do not cover every open invoice (sums would be wrong).
 */
export function OverdueAging({
  docs,
  status,
  unpaidCount,
  className,
}: {
  docs: Doc[] | undefined
  status: 'pending' | 'error' | 'success'
  unpaidCount: number
  className?: string
}) {
  const aging = useMemo(
    () => (docs && unpaidCount <= AGING_ROW_CAP ? receivablesAging(docs) : null),
    [docs, unpaidCount],
  )
  if (status !== 'success' || !aging || aging.buckets.every((b) => b.count === 0)) return null
  return (
    <section aria-labelledby="overdue-aging" className={className}>
      <h2 id="overdue-aging" className="text-[13px] text-muted-foreground">
        {t.title}
        {aging.approximate && <> · {t.approximate}</>}
      </h2>
      <ul className="mt-1 grid grid-cols-4 gap-x-2 @md:gap-x-6">
        {aging.buckets.map((b) => {
          const body = (
            <>
              <span className="block text-[13px] text-muted-foreground">{t.buckets[b.key]}</span>
              <Amount
                value={b.sumCzk}
                size="inline"
                hideZeroFraction
                tone={b.count === 0 ? 'muted' : b.key === 'd60plus' ? 'overdue' : 'default'}
              />
              <span className="sr-only"> · {t.count(b.count)}</span>
            </>
          )
          return (
            <li key={b.key} className="min-w-0">
              {b.count === 0 ? (
                <span className="block py-1.5">{body}</span>
              ) : (
                <Link
                  to="/faktury"
                  search={{ filter: 'overdue', sort: 'dueDate', dir: 'asc' }}
                  className="-mx-1 block rounded-sm px-1 py-1.5 outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:py-2.5"
                >
                  {body}
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
