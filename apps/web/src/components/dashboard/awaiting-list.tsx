import type { RouterOutputs } from '@fakturky/core/router'
import { Amount } from '@fakturky/ui/components/amount'
import { Button } from '@fakturky/ui/components/button'
import { RelativeDate } from '@fakturky/ui/components/relative-date'
import { cn } from '@fakturky/ui/lib/utils'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { cs } from '@/i18n/cs'
import { apiErrorMessage } from '@/lib/errors'
import { orpc } from '@/lib/orpc'

type Doc = RouterOutputs['documents']['list'][number]

const t = cs.overview.awaiting

/** Oldest due date first: the most overdue invoice leads. */
export function sortByDue(docs: Doc[]): Doc[] {
  return [...docs].sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))
}

const quietLink =
  'inline-flex h-9 items-center text-sm text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:h-11'

/** One open invoice: who, what, how late, and the reminder one tap away. */
function Row({ doc }: { doc: Doc }) {
  const qc = useQueryClient()
  const overdue = doc.displayStatus === 'overdue'
  const name = doc.customerName ?? '—'
  const remind = useMutation(
    orpc.documents.send.mutationOptions({
      onSuccess: () => {
        toast.success(t.reminded)
        qc.invalidateQueries({ queryKey: orpc.documents.key() })
      },
      onError: (e) => toast.error(apiErrorMessage(e)),
    }),
  )
  return (
    <li className="row-hover relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 border-b py-2 last:border-b-0 @2xl:grid-cols-[minmax(0,1fr)_17rem_7rem_7.5rem]">
      <Link
        to="/faktury/$id"
        params={{ id: doc.id }}
        className="col-start-1 row-start-1 line-clamp-2 min-w-0 text-sm font-medium outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring/60 focus-visible:after:ring-inset"
      >
        {name}
      </Link>
      <span className="col-start-1 row-start-2 min-w-0 truncate text-[13px] text-muted-foreground @2xl:col-start-2 @2xl:row-start-1">
        <span className="tabular-nums">{doc.number}</span>
        <span aria-hidden> · </span>
        {t.due}{' '}
        <RelativeDate
          date={doc.dueDate}
          tone="due"
          className={cn(overdue && 'font-medium text-destructive')}
        />
      </span>
      <Amount
        value={doc.remaining}
        currency={doc.currency}
        size="inline"
        hideZeroFraction
        className="col-start-2 row-start-1 text-right @2xl:col-start-3"
      />
      <Button
        variant="ghost"
        size="xs"
        disabled={remind.isPending}
        aria-label={t.remindFor(name)}
        onClick={() => remind.mutate({ id: doc.id, reminder: overdue })}
        className={cn(
          'relative z-10 col-start-2 row-start-2 -mr-2 justify-self-end text-[13px] pointer-coarse:h-11 pointer-coarse:px-3 @2xl:col-start-4 @2xl:row-start-1',
          !overdue && 'row-actions focus-visible:opacity-100',
        )}
      >
        {t.remind}
      </Button>
    </li>
  )
}

/** Open invoices, most overdue first, with an inline "Připomenout". */
export function AwaitingList({
  docs,
  total,
  className,
}: {
  docs: Doc[]
  total: number
  className?: string
}) {
  const rows = sortByDue(docs).slice(0, 8)
  return (
    <section className={cn('@container', className)}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl leading-7">{t.title}</h2>
        <div className="flex items-center gap-4">
          <Link to="/banka" className={quietLink}>
            {t.uploadStatement}
          </Link>
          {total > rows.length && (
            <Link to="/faktury" search={{ filter: 'unpaid' }} className={quietLink}>
              {t.all(total)}
            </Link>
          )}
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="border-t py-8 text-sm text-muted-foreground">{t.empty}</p>
      ) : (
        <ul className="mt-2 border-t">
          {rows.map((d) => (
            <Row key={d.id} doc={d} />
          ))}
        </ul>
      )}
    </section>
  )
}
