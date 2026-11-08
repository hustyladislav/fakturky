import { InvoiceSheet, type InvoiceSheetInput } from '@fakturky/pdf/html'
import { Amount } from '@fakturky/ui/components/amount'
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
      <h1 className="text-3xl">404</h1>
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
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
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
    <div className="min-h-svh bg-background text-foreground">
      <div className="mx-auto w-full max-w-[1180px] px-5 pt-5 pb-12 sm:px-6 lg:pt-9">
        <header className="mb-6 flex items-center justify-between gap-4 lg:mb-8 print:hidden">
          <div className="flex min-w-0 items-center gap-3">
            {d.appearance.logo && (
              <img
                src={d.appearance.logo}
                alt=""
                className="h-9 max-w-36 rounded-md object-contain"
              />
            )}
            <div className="min-w-0">
              <p className="text-[13px] text-muted-foreground">{t.from}</p>
              <p className="truncate text-lg leading-6">{supplierName}</p>
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
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-10 lg:grid-cols-[22rem_minmax(0,1fr)] lg:gap-14">
          <aside className="space-y-6 lg:sticky lg:top-6 print:hidden" aria-label={t.payHeading}>
            <section>
              <div className="flex items-start justify-between gap-3">
                <p className="text-[13px] text-muted-foreground">
                  {open ? t.toPay : d.status === 'paid' ? t.paidAmount : t.totalLabel}
                </p>
                <StatusBadge status={status} overdueDays={overdueDays}>
                  {statusLabel}
                </StatusBadge>
              </div>
              <div className="mt-1">
                <Amount value={heroValue} currency={d.currency} size="hero" />
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-4 text-sm">
                <div>
                  <dt className="text-[13px] text-muted-foreground">{t.documentHeading}</dt>
                  <dd className="mt-0.5 tabular-nums">{d.number}</dd>
                </div>
                {d.type !== 'credit_note' && (
                  <div>
                    <dt className="text-[13px] text-muted-foreground">{t.dueOn}</dt>
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
                <p className="mt-4 flex items-start gap-2 text-sm text-success">
                  <Check className="mt-0.5 size-4 shrink-0" />
                  {t.paidNote}
                </p>
              )}
              {d.status === 'cancelled' && (
                <p className="mt-4 text-sm text-muted-foreground">{t.cancelledNote}</p>
              )}
              {d.status === 'issued' && !payable && (
                <p className="mt-4 text-sm text-muted-foreground">{t.noPaymentNote}</p>
              )}
            </section>

            {payable && d.qr && (
              <figure className="flex flex-col items-center gap-3" data-testid="public-qr">
                <div className="rounded-xl border bg-white p-1.5">
                  <PaymentQr qr={d.qr} className="size-56 rounded-lg" />
                </div>
                <figcaption className="max-w-[17rem] text-center text-[13px] text-muted-foreground">
                  <span className="block font-medium text-foreground">
                    {d.qr.kind === 'spayd' ? cs.paymentQr.platba : cs.paymentQr.epc}
                  </span>
                  <span className="mt-1 block">{t.scanHint}</span>
                </figcaption>
              </figure>
            )}

            <div className="grid grid-cols-2 gap-2" aria-label={t.files}>
              <Button
                variant="brand"
                size="lg"
                className="h-11"
                nativeButton={false}
                render={<a href={`/f/${token}/pdf`} download />}
              >
                <Download /> {t.downloadPdf}
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-11"
                nativeButton={false}
                render={<a href={`/f/${token}/isdoc`} download />}
              >
                <FileCode2 /> ISDOC
              </Button>
            </div>

            {payable && (
              <section aria-labelledby="pay-details">
                <h2 id="pay-details" className="border-b pb-2 text-[13px] text-muted-foreground">
                  {t.payHeading}
                </h2>
                <dl className="divide-y">
                  {d.bank?.account && (
                    <PayRow label={t.account} value={d.bank.account} copy={d.bank.account} strong />
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
              </section>
            )}
          </aside>

          <main>
            <div className="overflow-hidden rounded-[3px] shadow-[0_0_0_1px_var(--border),0_12px_30px_-16px_rgb(0_0_0/0.25)] print:shadow-none">
              <InvoiceSheet doc={sheet} qr={d.qr} maxScale={1.4} headingLevel={2} />
            </div>
          </main>
        </div>
        {d.appearance.showBrand && (
          <footer className="mt-12 flex items-center justify-center gap-2 text-xs text-muted-foreground print:hidden">
            <LogoMark letter={cs.brand} className="size-4" />
            {t.issuedIn(cs.brand)}
          </footer>
        )}
      </div>
    </div>
  )
}
