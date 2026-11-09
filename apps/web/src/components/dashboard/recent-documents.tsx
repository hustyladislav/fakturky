import type { RouterOutputs } from '@fakturky/core/router'
import { Amount } from '@fakturky/ui/components/amount'
import { Link } from '@tanstack/react-router'
import { InvoiceStatus } from '@/components/invoices/invoice-status'
import { cs } from '@/i18n/cs'

type Doc = RouterOutputs['documents']['list'][number]

const t = cs.overview

/** The latest documents, drafts included so an unfinished one is a tap away. */
export function RecentDocuments({ docs, className }: { docs: Doc[]; className?: string }) {
  return (
    <section className={className}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl leading-7">{t.recent}</h2>
        <Link
          to="/faktury"
          search={{ filter: 'all' }}
          className="inline-flex h-9 items-center text-sm text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:h-11"
        >
          {t.allInvoices}
        </Link>
      </div>
      <ul className="mt-2 border-t">
        {docs.map((d) => (
          <li key={d.id} className="row-hover border-b last:border-b-0">
            <Link
              to={d.status === 'draft' ? '/faktury/$id/upravit' : '/faktury/$id'}
              params={{ id: d.id }}
              className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset"
            >
              <span className="truncate text-sm">{d.customerName ?? '—'}</span>
              <Amount
                value={d.total}
                currency={d.currency}
                size="sm"
                hideZeroFraction
                tone={d.status === 'draft' ? 'muted' : 'default'}
                className="text-right"
              />
              <span className="truncate text-[13px] text-muted-foreground tabular-nums">
                {d.number ??
                  (d.type === 'credit_note' ? t.draftCreditNote : cs.invoices.draftNumber)}
              </span>
              <span className="justify-self-end">
                <InvoiceStatus status={d.displayStatus} viaAssistant={d.viaAssistant} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
