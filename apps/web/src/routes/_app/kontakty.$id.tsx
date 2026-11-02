import { Amount } from '@fakturky/ui/components/amount'
import { Avatar } from '@fakturky/ui/components/avatar'
import { Button } from '@fakturky/ui/components/button'
import { EmptyState } from '@fakturky/ui/components/empty-state'
import { PageHeader, SectionLabel } from '@fakturky/ui/components/page-header'
import { RelativeDate } from '@fakturky/ui/components/relative-date'
import { Skeleton } from '@fakturky/ui/components/skeleton'
import { formatDate, parseIsoDate } from '@fakturky/ui/lib/dates'
import { cn } from '@fakturky/ui/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, FilePlus2 } from 'lucide-react'
import { ContactMenu, useNewInvoiceFor } from '@/components/contacts/contact-menu'
import { InvoiceStatus } from '@/components/invoice-status'
import { overdueDays } from '@/components/invoices/invoice-rows'
import { crowns } from '@/components/invoices/summary-strip'
import { cs } from '@/i18n/cs'
import { pageHead } from '@/lib/head'
import { orpc } from '@/lib/orpc'

export const Route = createFileRoute('/_app/kontakty/$id')({
  head: pageHead(cs.contacts.title),
  component: ContactDetail,
})

const t = cs.contacts

function Stat({
  label,
  children,
  hint,
}: {
  label: string
  children: React.ReactNode
  hint?: React.ReactNode
}) {
  return (
    <div className="sheet flex flex-col gap-3 p-5">
      <div className="label-caps">{label}</div>
      <div>{children}</div>
      <div className="text-xs text-muted-foreground">{hint ?? ' '}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div>
      <dt className="label-caps !text-[10px]">{label}</dt>
      <dd className="mt-1 text-sm whitespace-pre-line">
        {children || <span className="text-muted-foreground">{t.notFilled}</span>}
      </dd>
    </div>
  )
}

/** Twelve tiny bars: net invoiced per month, the current month last. */
function MonthBars({ values }: { values: string[] }) {
  const nums = values.map((v) => Math.max(0, Number(v)))
  const max = Math.max(...nums, 1)
  return (
    <div
      role="img"
      aria-label={t.stats.invoicedMonths}
      className="mt-3 flex h-8 items-end gap-[3px]"
    >
      {nums.map((n, i) => (
        <span
          key={i}
          className={cn(
            'min-h-[2px] flex-1 rounded-[2px]',
            n === 0 ? 'bg-border' : i === nums.length - 1 ? 'bg-primary' : 'bg-primary/45',
          )}
          style={{ height: `${Math.max(6, (n / max) * 100)}%` }}
        />
      ))}
    </div>
  )
}

function ContactDetail() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const newInvoice = useNewInvoiceFor()
  const contact = useQuery(orpc.contacts.get.queryOptions({ input: { id } }))
  const stats = useQuery(orpc.contacts.stats.queryOptions({ input: { contactId: id } }))
  const docs = useQuery(orpc.documents.list.queryOptions({ input: { contactId: id, limit: 50 } }))
  const c = contact.data
  const s = stats.data?.[0]

  if (contact.isError) {
    return (
      <div className="mx-auto max-w-[1200px]">
        <EmptyState illustration="contacts" title={t.notFound} className="bg-card">
          <Link to="/kontakty" className="text-primary underline-offset-4 hover:underline">
            {t.back}
          </Link>
        </EmptyState>
      </div>
    )
  }
  if (!c) {
    return (
      <div className="mx-auto max-w-[1200px] space-y-5" aria-busy="true">
        <Skeleton className="h-16 w-1/2" />
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  const address = [c.address.street, [c.address.zip, c.address.city].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join('\n')
  const identity = [c.ico && `${t.ico} ${c.ico}`, c.dic && `${t.dic} ${c.dic}`]
    .filter(Boolean)
    .join(' · ')
  const lastDate = parseIsoDate(s?.lastInvoiceDate)

  return (
    <div className="mx-auto max-w-[1200px]">
      <Link
        to="/kontakty"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:underline"
      >
        <ArrowLeft className="size-3.5" aria-hidden /> {t.back}
      </Link>
      <PageHeader
        leading={<Avatar name={c.name} size="xl" shape="square" />}
        title={c.name}
        subtitle={identity || undefined}
        actions={
          <>
            <Button onClick={() => newInvoice(c.id)}>
              <FilePlus2 /> {t.newInvoiceFor}
            </Button>
            <ContactMenu contact={c} onArchived={() => navigate({ to: '/kontakty', search: {} })} />
          </>
        }
      />

      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <Stat label={t.stats.invoiced} hint={s ? t.stats.invoicedHint(s.documentCount) : undefined}>
          <Amount value={s?.invoiced ?? '0.00'} size="lg" hideZeroFraction animate />
          {s && <MonthBars values={s.monthly} />}
        </Stat>
        <Stat
          label={t.stats.outstanding}
          hint={
            s && Number(s.outstanding) > 0 ? (
              Number(s.overdue) > 0 ? (
                <span className="text-destructive">{t.stats.overdue(crowns(s.overdue))}</span>
              ) : undefined
            ) : (
              t.stats.noneOwed
            )
          }
        >
          <Amount
            value={s?.outstanding ?? '0.00'}
            size="lg"
            hideZeroFraction
            animate
            tone={s && Number(s.overdue) > 0 ? 'overdue' : 'default'}
          />
        </Stat>
        <Stat label={t.stats.last} hint={lastDate ? formatDate(lastDate) : t.stats.lastNone}>
          {lastDate ? (
            <span className="font-serif text-[28px] leading-8 tracking-[-0.01em]">
              <RelativeDate date={s?.lastInvoiceDate} />
            </span>
          ) : (
            <span className="font-serif text-[28px] leading-8 text-muted-foreground">—</span>
          )}
        </Stat>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <section className="sheet pt-5 pb-2">
          <SectionLabel className="px-5">{t.detail.invoices}</SectionLabel>
          {docs.data?.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              {t.detail.noInvoices}
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-border/60">
              {(docs.data ?? []).map((d) => (
                <li key={d.id} className="row-hover">
                  <Link
                    to={d.status === 'draft' ? '/faktury/$id/upravit' : '/faktury/$id'}
                    params={{ id: d.id }}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 outline-none sm:flex-nowrap focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset"
                  >
                    <div className="min-w-0 flex-1 whitespace-nowrap">
                      <div className="font-mono text-[12.5px] tabular-nums">
                        {d.number ?? cs.invoices.noNumber}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {d.issueDate ? formatDate(parseIsoDate(d.issueDate) ?? new Date()) : '—'}
                        {d.type !== 'invoice' &&
                          ` · ${cs.invoices.typeShort[d.type as keyof typeof cs.invoices.typeShort]}`}
                      </div>
                    </div>
                    <Amount
                      value={d.total}
                      currency={d.currency}
                      size="inline"
                      className="text-right sm:w-32"
                    />
                    <span className="flex justify-end max-sm:basis-full sm:w-44">
                      <InvoiceStatus
                        status={d.displayStatus}
                        viaAssistant={d.viaAssistant}
                        overdueDays={overdueDays(d)}
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="space-y-5">
          <section className="sheet p-5">
            <SectionLabel>{t.detail.info}</SectionLabel>
            <dl className="mt-4 space-y-4">
              <Field label={t.detail.address}>{address}</Field>
              <Field label={t.email}>
                {c.emails.length ? <span className="break-all">{c.emails.join('\n')}</span> : null}
              </Field>
              <Field label={t.phone}>{c.phone}</Field>
              {c.defaultDueDays != null && (
                <Field label={t.detail.defaults}>{t.detail.dueDays(c.defaultDueDays)}</Field>
              )}
            </dl>
            {c.aresSyncedAt && (
              <p className="mt-5 text-xs text-muted-foreground">
                {t.detail.aresSynced(formatDate(new Date(c.aresSyncedAt)))}
              </p>
            )}
          </section>
          <section className="sheet p-5">
            <SectionLabel>{t.detail.notes}</SectionLabel>
            <p className="mt-4 text-sm whitespace-pre-line text-muted-foreground">
              {c.note || t.detail.noNotes}
            </p>
          </section>
        </aside>
      </div>
    </div>
  )
}
