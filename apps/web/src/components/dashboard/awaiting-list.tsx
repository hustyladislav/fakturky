import type { RouterOutputs } from '@fakturky/core/router'
import { Amount } from '@fakturky/ui/components/amount'
import { Avatar } from '@fakturky/ui/components/avatar'
import { Button } from '@fakturky/ui/components/button'
import { SectionLabel } from '@fakturky/ui/components/page-header'
import { RelativeDate } from '@fakturky/ui/components/relative-date'
import { cn } from '@fakturky/ui/lib/utils'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { BellRing, Check } from 'lucide-react'
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
    <li className="row-hover relative flex items-start gap-3 px-5 py-3">
      <Avatar name={name} size="md" className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <Link
            to="/faktury/$id"
            params={{ id: doc.id }}
            className="truncate text-sm font-medium outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring/60 focus-visible:after:ring-inset"
          >
            {name}
          </Link>
          <Amount value={doc.remaining} currency={doc.currency} size="inline" hideZeroFraction />
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="min-w-0 truncate">
            <span className="tabular-nums">{doc.number}</span>
            <span aria-hidden> · </span>
            <RelativeDate
              date={doc.dueDate}
              tone="due"
              className={cn(overdue && 'font-medium text-destructive')}
            />
          </span>
          <Button
            variant="ghost"
            size="xs"
            disabled={remind.isPending}
            aria-label={t.remindFor(name)}
            onClick={() => remind.mutate({ id: doc.id, reminder: overdue })}
            className={cn(
              'relative z-10 -my-1 shrink-0 text-primary hover:bg-primary/10 max-sm:[&_svg]:hidden',
              !overdue && 'row-actions focus-visible:opacity-100',
            )}
          >
            {remind.isSuccess ? <Check /> : <BellRing />}
            {t.remind}
          </Button>
        </div>
      </div>
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
  const rows = sortByDue(docs).slice(0, 6)
  return (
    <section className={cn('sheet pt-5 pb-2', className)}>
      <SectionLabel
        className="px-5"
        action={
          total > rows.length ? (
            <Link
              to="/faktury"
              search={{ filter: 'unpaid' }}
              className="text-xs font-medium text-primary underline-offset-4 hover:underline"
            >
              {t.all(total)}
            </Link>
          ) : undefined
        }
      >
        {t.title}
      </SectionLabel>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">{t.empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-border/60">
          {rows.map((d) => (
            <Row key={d.id} doc={d} />
          ))}
        </ul>
      )}
    </section>
  )
}
