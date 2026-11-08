import { Amount } from '@fakturky/ui/components/amount'
import { Button } from '@fakturky/ui/components/button'
import { EmptyState } from '@fakturky/ui/components/empty-state'
import { PageHeader } from '@fakturky/ui/components/page-header'
import { RelativeDate } from '@fakturky/ui/components/relative-date'
import { Skeleton } from '@fakturky/ui/components/skeleton'
import { formatDate, parseIsoDate } from '@fakturky/ui/lib/dates'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, FilePlus2 } from 'lucide-react'
import { ContactInvoices } from '@/components/contacts/contact-invoices'
import { ContactMenu, useNewInvoiceFor } from '@/components/contacts/contact-menu'
import { cs } from '@/i18n/cs'
import { crowns } from '@/lib/crowns'
import { pageHead } from '@/lib/head'
import { orpc } from '@/lib/orpc'

export const Route = createFileRoute('/_app/kontakty/$id')({
  head: pageHead(cs.contacts.title),
  component: ContactDetail,
})

const t = cs.contacts

function Figure({
  label,
  children,
  hint,
}: {
  label: string
  children: React.ReactNode
  hint?: React.ReactNode
}) {
  return (
    <div className="min-w-0">
      <div className="text-[13px] text-muted-foreground">{label}</div>
      <div className="mt-1">{children}</div>
      <div className="mt-1 min-h-5 text-[13px] text-muted-foreground">{hint}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm whitespace-pre-line">
        {children || <span className="text-muted-foreground">{t.notFilled}</span>}
      </dd>
    </div>
  )
}

function ContactDetail() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const newInvoice = useNewInvoiceFor()
  const contact = useQuery(orpc.contacts.get.queryOptions({ input: { id } }))
  const stats = useQuery(orpc.contacts.stats.queryOptions({ input: { contactId: id } }))
  const c = contact.data
  const s = stats.data?.[0]

  if (contact.isError) {
    return (
      <div className="mx-auto max-w-[1200px]">
        <EmptyState illustration="contacts" title={t.notFound}>
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
        <Skeleton className="h-24 w-full" />
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
  const overdue = s && Number(s.overdue) > 0

  return (
    <div className="mx-auto max-w-[1200px]">
      <Link
        to="/kontakty"
        className="-ml-1 mb-3 inline-flex min-h-8 items-center gap-1.5 px-1 text-[13px] text-muted-foreground outline-none hover:text-foreground focus-visible:underline pointer-coarse:min-h-11"
      >
        <ArrowLeft className="size-3.5" aria-hidden /> {t.back}
      </Link>
      <PageHeader
        title={c.name}
        subtitle={identity || undefined}
        actions={
          <>
            <Button aria-label={cs.palette.newInvoiceFor(c.name)} onClick={() => newInvoice(c.id)}>
              <FilePlus2 aria-hidden /> {t.newInvoiceFor}
            </Button>
            <ContactMenu contact={c} onArchived={() => navigate({ to: '/kontakty', search: {} })} />
          </>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-x-8 gap-y-5 border-y py-5 sm:grid-cols-3">
        <Figure
          label={t.stats.invoiced}
          hint={s ? t.stats.invoicedHint(s.documentCount) : undefined}
        >
          <Amount value={s?.invoiced ?? '0.00'} size="lg" hideZeroFraction animate />
        </Figure>
        <Figure
          label={t.stats.outstanding}
          hint={
            s && Number(s.outstanding) > 0 ? (
              overdue ? (
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
            tone={overdue ? 'overdue' : 'default'}
          />
        </Figure>
        <Figure label={t.stats.last} hint={lastDate ? formatDate(lastDate) : t.stats.lastNone}>
          <span className="text-[28px] leading-8 tracking-[-0.02em]">
            {lastDate ? (
              <RelativeDate date={s?.lastInvoiceDate} />
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </span>
        </Figure>
      </div>

      <div className="grid items-start gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section>
          <h2 className="mb-2 text-sm font-medium">{t.detail.invoices}</h2>
          <ContactInvoices contactId={id} />
        </section>

        <aside className="space-y-8">
          <section>
            <h2 className="mb-3 text-sm font-medium">{t.detail.info}</h2>
            <dl className="space-y-4">
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
              <p className="mt-4 text-[13px] text-muted-foreground">
                {t.detail.aresSynced(formatDate(new Date(c.aresSyncedAt)))}
              </p>
            )}
          </section>
          <section>
            <h2 className="mb-2 text-sm font-medium">{t.detail.notes}</h2>
            <p className="text-sm whitespace-pre-line text-muted-foreground">
              {c.note || t.detail.noNotes}
            </p>
          </section>
        </aside>
      </div>
    </div>
  )
}
