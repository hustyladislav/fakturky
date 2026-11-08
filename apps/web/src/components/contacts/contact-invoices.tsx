import { Amount } from '@fakturky/ui/components/amount'
import { formatDate, parseIsoDate } from '@fakturky/ui/lib/dates'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { InvoiceStatus } from '@/components/invoice-status'
import { docPath, overdueDays } from '@/components/invoices/invoice-rows'
import { cs } from '@/i18n/cs'
import { orpc } from '@/lib/orpc'

const t = cs.contacts.detail

/** One contact's documents as flat hairline rows: number and date, amount, status. */
export function ContactInvoices({ contactId }: { contactId: string }) {
  const docs = useQuery(orpc.documents.list.queryOptions({ input: { contactId, limit: 50 } }))
  if (docs.data?.length === 0) {
    return <p className="border-t py-10 text-sm text-muted-foreground">{t.noInvoices}</p>
  }
  return (
    <ul>
      {(docs.data ?? []).map((d) => {
        const type =
          d.type !== 'invoice'
            ? cs.invoices.typeShort[d.type as keyof typeof cs.invoices.typeShort]
            : null
        return (
          <li key={d.id} className="row-hover border-t">
            <Link
              to={docPath(d)}
              params={{ id: d.id }}
              className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-0.5 py-2 sm:px-3 outline-none focus-visible:bg-muted/60 sm:grid-cols-[9rem_minmax(0,1fr)_10rem_11rem] sm:-mx-3"
            >
              <span className="text-sm font-medium tabular-nums">
                {d.number ?? cs.invoices.noNumber}
              </span>
              <Amount
                value={d.total}
                currency={d.currency}
                size="inline"
                className="text-right sm:order-3"
              />
              <span className="text-[13px] text-muted-foreground tabular-nums sm:order-2">
                {d.issueDate ? formatDate(parseIsoDate(d.issueDate) ?? new Date()) : '—'}
                {type && ` · ${type}`}
              </span>
              <span className="flex justify-end sm:order-4">
                <InvoiceStatus
                  status={d.displayStatus}
                  viaAssistant={d.viaAssistant}
                  overdueDays={overdueDays(d)}
                />
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
