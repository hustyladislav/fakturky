import type { RouterOutputs } from '@fakturky/core/router'
import { SectionLabel } from '@fakturky/ui/components/page-header'
import { RelativeDate } from '@fakturky/ui/components/relative-date'
import { cn } from '@fakturky/ui/lib/utils'
import { Link } from '@tanstack/react-router'
import { BellRing, Check, Landmark, type LucideIcon, Mail, Receipt, Wallet } from 'lucide-react'
import { cs } from '@/i18n/cs'

type Event = RouterOutputs['dashboard']['activity'][number]

const t = cs.overview.activity
type Action = Exclude<keyof typeof t, 'title' | 'empty'>

const icons: Record<Action, LucideIcon> = {
  issued: Receipt,
  paid: Check,
  partially_paid: Wallet,
  sent: Mail,
  reminded: BellRing,
  bank_matched: Landmark,
}

/** Compact feed of the last document events (issued, paid, sent, matched from the bank). */
export function ActivityFeed({ events, className }: { events: Event[]; className?: string }) {
  return (
    <section className={cn('sheet pt-5 pb-2', className)}>
      <SectionLabel className="px-5">{t.title}</SectionLabel>
      {events.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">{t.empty}</p>
      ) : (
        <ul className="mt-2">
          {events.map((e) => {
            const Icon = icons[e.action as Action] ?? Receipt
            const label = t[e.action as Action] ?? e.action
            return (
              <li key={e.id} className="row-hover relative flex items-start gap-3 px-5 py-2.5">
                <span
                  aria-hidden
                  className={cn(
                    'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-3.5',
                    (e.action === 'paid' || e.action === 'bank_matched') &&
                      'bg-success/12 text-success',
                  )}
                >
                  <Icon />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <Link
                      to="/faktury/$id"
                      params={{ id: e.documentId }}
                      className="truncate text-sm font-medium outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring/60 focus-visible:after:ring-inset"
                    >
                      {label}
                    </Link>
                    <RelativeDate
                      date={e.createdAt}
                      className="shrink-0 text-xs text-muted-foreground"
                    />
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    <span className="tabular-nums">{e.number ?? cs.invoices.noNumber}</span>
                    {e.customerName && <span aria-hidden> · </span>}
                    {e.customerName}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
