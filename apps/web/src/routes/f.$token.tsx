import { InvoiceSheet, type InvoiceSheetInput } from '@fakturky/pdf/html'
import { Amount } from '@fakturky/ui/components/amount'
import { Avatar } from '@fakturky/ui/components/avatar'
import { Button } from '@fakturky/ui/components/button'
import { LogoMark } from '@fakturky/ui/components/logo'
import { RelativeDate } from '@fakturky/ui/components/relative-date'
import { type DocumentStatus, StatusBadge } from '@fakturky/ui/components/status-badge'
import { diffDays, formatDate, parseIsoDate, startOfDay } from '@fakturky/ui/lib/dates'
import { createFileRoute, notFound } from '@tanstack/react-router'
import { Check, Copy, Download, FileCode2, Printer } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { PaymentQr } from '@/components/payment-qr'
import { cs } from '@/i18n/cs'
import { client } from '@/lib/orpc'

const t = cs.publicInvoice

export const Route = createFileRoute('/f/$token')({
  loader: async ({ params }) => {
    try {
      return await client.public.invoice({ token: params.token })
    } catch (e) {
      // Only an unknown token is a 404; outages and other failures must surface as errors.
      if ((e as { code?: string }).code === 'NOT_FOUND') throw notFound()
      throw e
    }
  },
  notFoundComponent: () => (
    <main className="mx-auto max-w-md p-6 pt-24 text-center">
      <h1 className="font-serif text-3xl">404</h1>
      <p className="mt-2 text-muted-foreground">{t.notFound}</p>
    </main>
  ),
  head: () => ({
    meta: [{ name: 'robots', content: 'noindex, nofollow, noarchive' }, { title: cs.brand }],
  }),
  component: PublicInvoice,
})

/** Copies `value` and flips the icon to a check for a moment. */
function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard
          ?.writeText(value)
          .then(() => {
            setDone(true)
            clearTimeout(timer.current)
            timer.current = setTimeout(() => setDone(false), 1600)
          })
          .catch(() => {})
      }}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      aria-label={done ? t.copied : `${t.copy}: ${label}`}
      title={done ? t.copied : t.copy}
    >
      {done ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
    </button>
  )
}

function PayRow({
  label,
  value,
  copy,
  strong,
}: {
  label: string
  value: string
  copy?: string
  strong?: boolean
}) {
  return (
    <div className="py-2.5">
      <dt className="label-caps">{label}</dt>
      <dd className="mt-0.5 flex items-center justify-between gap-3">
        <span className={`min-w-0 text-sm tabular-nums break-all ${strong ? 'font-semibold' : ''}`}>
          {value}
        </span>
        {copy ? <CopyButton value={copy} label={label} /> : null}
      </dd>
    </div>
  )
}

function PublicInvoice() {
  const d = Route.useLoaderData()
  const { token } = Route.useParams()
  const supplierName = d.supplier.name
  const open = d.status === 'issued' && Number(d.remaining) > 0
  const due = parseIsoDate(d.dueDate)
  const overdueDays =
    d.overdue && due ? Math.max(1, diffDays(startOfDay(new Date()), due)) : undefined
  const status: DocumentStatus =
    d.status === 'paid'
      ? 'paid'
      : d.status === 'cancelled'
        ? 'cancelled'
        : d.overdue
          ? 'overdue'
          : 'issued'
  const statusLabel =
    d.status === 'paid'
      ? t.paid
      : d.status === 'cancelled'
        ? t.cancelled
        : d.overdue
          ? t.overdue
          : open
            ? t.awaiting
            : t.issued
  const payable = open && d.bank !== null
  const heroValue = open ? d.remaining : d.total
  const sheet = d.sheet as unknown as InvoiceSheetInput

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-[1180px] px-4 pt-5 pb-12 sm:px-6 lg:pt-9">
        <header className="mb-5 flex items-center justify-between gap-4 lg:mb-7 print:hidden">
          <div className="flex min-w-0 items-center gap-3">
            {d.appearance.logo ? (
              <img
                src={d.appearance.logo}
                alt=""
                className="h-9 max-w-36 rounded-md object-contain"
              />
            ) : (
              <Avatar name={supplierName} size="md" shape="square" />
            )}
            <div className="min-w-0">
              <p className="label-caps">{t.from}</p>
              <p className="truncate font-serif text-lg leading-6">{supplierName}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex"
            onClick={() => window.print()}
          >
            <Printer /> {t.print}
          </Button>
        </header>
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_368px] lg:gap-9">
          <aside className="order-first space-y-4 lg:sticky lg:top-6 lg:order-last print:hidden">
            <section className="sheet p-5 sm:p-6" aria-label={t.payHeading}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="label-caps">
                    {open ? t.toPay : d.status === 'paid' ? t.paidAmount : t.totalLabel}
                  </p>
                  <div className="mt-1.5">
                    <Amount value={heroValue} currency={d.currency} size="hero" />
                  </div>
                </div>
                <StatusBadge status={status} overdueDays={overdueDays} className="mt-0.5">
                  {statusLabel}
                </StatusBadge>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-4 text-sm">
                <div>
                  <dt className="label-caps">{t.documentHeading}</dt>
                  <dd className="mt-0.5 font-serif text-base tabular-nums">{d.number}</dd>
                </div>
                {d.type !== 'credit_note' && (
                  <div>
                    <dt className="label-caps">{t.dueOn}</dt>
                    <dd className="mt-0.5">
                      {open ? (
                        <>
                          <RelativeDate date={d.dueDate} tone="due" />
                          <span className="block text-xs text-muted-foreground tabular-nums">
                            {due ? formatDate(due) : ''}
                          </span>
                        </>
                      ) : (
                        <span className="tabular-nums">{due ? formatDate(due) : '—'}</span>
                      )}
                    </dd>
                  </div>
                )}
              </dl>

              {d.status === 'paid' && (
                <p className="mt-4 flex items-start gap-2 rounded-lg bg-success/10 px-3 py-2.5 text-sm text-success">
                  <Check className="mt-0.5 size-4 shrink-0" />
                  {t.paidNote}
                </p>
              )}
              {d.status === 'cancelled' && (
                <p className="mt-4 rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground">
                  {t.cancelledNote}
                </p>
              )}
              {d.status === 'issued' && !payable && (
                <p className="mt-4 rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground">
                  {t.noPaymentNote}
                </p>
              )}

              {payable && (
                <div className="mt-5 border-t pt-5">
                  <h2 className="label-caps mb-4 text-center">{t.payHeading}</h2>
                  {d.qr && (
                    <figure
                      className="mb-5 flex flex-col items-center gap-3"
                      data-testid="public-qr"
                    >
                      <div className="rounded-xl border bg-white p-1.5">
                        <PaymentQr qr={d.qr} className="size-52 rounded-lg sm:size-56" />
                      </div>
                      <figcaption className="max-w-[17rem] text-center text-xs text-muted-foreground">
                        <span className="label-caps block text-foreground">
                          {d.qr.kind === 'spayd' ? cs.paymentQr.platba : cs.paymentQr.epc}
                        </span>
                        <span className="mt-1 block">{t.scanHint}</span>
                      </figcaption>
                    </figure>
                  )}
                  <dl className="divide-y">
                    {d.bank?.account && (
                      <PayRow
                        label={t.account}
                        value={d.bank.account}
                        copy={d.bank.account}
                        strong
                      />
                    )}
                    {d.variableSymbol && (
                      <PayRow
                        label={t.variableSymbol}
                        value={d.variableSymbol}
                        copy={d.variableSymbol}
                        strong
                      />
                    )}
                    <PayRow
                      label={t.amountField}
                      value={`${Number(d.remaining).toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} ${d.currency === 'CZK' ? 'Kč' : d.currency}`}
                      copy={d.remaining}
                    />
                    {d.bank && <PayRow label={t.iban} value={d.bank.iban} copy={d.bank.iban} />}
                  </dl>
                </div>
              )}
            </section>

            <div className="grid grid-cols-2 gap-2" aria-label={t.files}>
              <Button
                size="lg"
                className="h-10"
                nativeButton={false}
                render={<a href={`/f/${token}/pdf`} download />}
              >
                <Download /> {t.downloadPdf}
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-10"
                nativeButton={false}
                render={<a href={`/f/${token}/isdoc`} download />}
              >
                <FileCode2 /> ISDOC
              </Button>
            </div>
          </aside>

          <main>
            <div className="overflow-hidden rounded-[3px] shadow-[0_0_0_1px_var(--border),0_2px_4px_rgb(0_0_0/0.05),0_24px_48px_-20px_rgb(0_0_0/0.22)] print:shadow-none">
              <InvoiceSheet doc={sheet} qr={d.qr} maxScale={1.4} headingLevel={2} />
            </div>
          </main>
        </div>
        {d.appearance.showBrand && (
          <footer className="mt-10 flex items-center justify-center gap-2 text-xs text-muted-foreground print:hidden">
            <LogoMark letter={cs.brand} className="size-4" />
            {t.issuedIn(cs.brand)}
          </footer>
        )}{' '}
      </div>
    </div>
  )
}
