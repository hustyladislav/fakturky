import { formatDateCs } from '@fakturky/domain/dates'
import { Button } from '@fakturky/ui/components/button'
import { Money } from '@fakturky/ui/components/money'
import { createFileRoute, notFound } from '@tanstack/react-router'
import { Download, Printer } from 'lucide-react'
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
      <h1 className="font-serif text-3xl font-medium">404</h1>
      <p className="mt-2 text-muted-foreground">{t.notFound}</p>
    </main>
  ),
  head: () => ({
    meta: [{ name: 'robots', content: 'noindex, nofollow, noarchive' }, { title: cs.brand }],
  }),
  component: PublicInvoice,
})

type Party = {
  name: string
  ico: string | null
  dic: string | null
  street: string
  city: string
  zip: string
  registerNote: string | null
}

function PartyBlock({ title, p }: { title: string; p: Party }) {
  return (
    <div className="space-y-0.5 text-sm">
      <div className="text-xs text-neutral-500">{title}</div>
      <div className="font-semibold">{p.name}</div>
      {p.street && <div>{p.street}</div>}
      {(p.zip || p.city) && (
        <div>
          {p.zip} {p.city}
        </div>
      )}
      {p.ico && <div>IČO {p.ico}</div>}
      {p.dic && <div>DIČ {p.dic}</div>}
      {p.registerNote && <div className="text-xs text-neutral-500">{p.registerNote}</div>}
    </div>
  )
}

function PublicInvoice() {
  const d = Route.useLoaderData()
  const { token } = Route.useParams()
  const title =
    d.type === 'proforma'
      ? t.titleProforma
      : d.type === 'payment_receipt'
        ? t.titleReceipt
        : d.type === 'credit_note'
          ? d.vatPayer
            ? t.titleCreditNoteTax
            : t.titleCreditNote
          : d.vatPayer
            ? t.titleTaxInvoice
            : t.titleInvoice
  const label = (k: string, v: React.ReactNode) => (
    <div>
      <div className="text-xs text-neutral-500">{k}</div>
      <div className="text-sm">{v}</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-neutral-100 p-3 sm:p-8 dark:bg-neutral-900">
      <div className="mx-auto mb-3 flex max-w-3xl flex-wrap justify-end gap-2 print:hidden">
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer /> {t.print}
        </Button>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<a href={`/f/${token}/pdf`} download />}
        >
          <Download /> {t.downloadPdf}
        </Button>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<a href={`/f/${token}/isdoc`} download />}
        >
          <Download /> {t.downloadIsdoc}
        </Button>
      </div>

      <article className="mx-auto max-w-3xl space-y-6 bg-white p-6 text-neutral-900 shadow-sm sm:p-10 print:shadow-none">
        <header
          className="flex items-start justify-between gap-4 border-b-2 pb-4"
          style={{ borderColor: d.appearance.accentColor ?? '#1F4D3C' }}
        >
          <div>
            {d.appearance.logo && (
              <img src={d.appearance.logo} alt="" className="mb-2 h-12 max-w-48 object-contain" />
            )}
            <h1 className="font-serif text-3xl font-medium">{title}</h1>
            <div className="font-serif text-xl tabular-nums">{d.number}</div>
            {d.original && (
              <div className="text-sm text-neutral-600">
                {t.corrects(d.original.number, formatDateCs(d.original.issueDate))}
              </div>
            )}
          </div>
          {d.status !== 'issued' || d.overdue ? (
            <span className="rounded border border-neutral-400 px-2 py-0.5 text-sm font-medium">
              {d.status === 'paid' ? t.paid : d.status === 'cancelled' ? t.cancelled : t.overdue}
            </span>
          ) : null}
        </header>

        <div className="grid gap-6 sm:grid-cols-2">
          <PartyBlock title={t.supplier} p={d.supplier} />
          <PartyBlock title={t.customer} p={d.customer} />
        </div>
        <p className="text-xs text-neutral-500">{d.vatPayer ? t.payer : t.notPayer}</p>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {label(t.issueDate, formatDateCs(d.issueDate))}
          {d.taxableDate && label(t.taxableDate, formatDateCs(d.taxableDate))}
          {label(t.dueDate, formatDateCs(d.dueDate))}
          {d.variableSymbol && label(t.variableSymbol, d.variableSymbol)}
        </div>

        {d.introText && <p className="text-sm whitespace-pre-line">{d.introText}</p>}

        <ul className="divide-y divide-neutral-200 border-y border-neutral-300 sm:hidden">
          {d.lines.map((l) => (
            <li
              key={`m-${l.description}-${l.unitPrice}-${l.quantity}-${l.total}`}
              className="flex items-start justify-between gap-3 py-3 text-sm"
            >
              <div className="min-w-0">
                <div>{l.description}</div>
                <div className="text-xs text-neutral-500">
                  {Number(l.quantity)} {l.unit} ×{' '}
                  <Money amount={l.unitPrice} currency={d.currency} />
                  {d.vatPayer && <> · {Number(l.vatRate)} %</>}
                  {Number(l.discountPercent) > 0 && (
                    <>
                      {' · '}
                      {t.discount} {Number(l.discountPercent)} %
                    </>
                  )}
                </div>
              </div>
              <Money amount={l.total} currency={d.currency} className="shrink-0" />
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="border-b border-neutral-400 text-left text-xs text-neutral-500">
                <th className="py-2 font-medium">{t.description}</th>
                <th className="py-2 text-right font-medium">{t.quantity}</th>
                <th className="py-2 text-right font-medium">{t.unitPrice}</th>
                {d.vatPayer && <th className="py-2 text-right font-medium">{t.vatRate}</th>}
                <th className="py-2 text-right font-medium">{t.lineTotal}</th>
              </tr>
            </thead>
            <tbody>
              {d.lines.map((l) => (
                <tr
                  key={`${l.description}-${l.unitPrice}-${l.quantity}-${l.total}`}
                  className="border-b border-neutral-200"
                >
                  <td className="py-2">
                    {l.description}
                    {l.vatNote && <div className="text-xs text-neutral-500">{l.vatNote}</div>}
                    {Number(l.discountPercent) > 0 && (
                      <div className="text-xs text-neutral-500">
                        {t.discount} {Number(l.discountPercent)} %
                      </div>
                    )}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {Number(l.quantity)} {l.unit}
                  </td>
                  <td className="py-2 text-right">
                    <Money amount={l.unitPrice} currency={d.currency} />
                  </td>
                  {d.vatPayer && (
                    <td className="py-2 text-right tabular-nums">
                      {l.vatTreatment === 'standard' ? `${Number(l.vatRate)} %` : t.regime}
                    </td>
                  )}
                  <td className="py-2 text-right">
                    <Money amount={l.total} currency={d.currency} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {d.vatPayer && (
          <div className="ml-auto max-w-md overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="pb-1 text-left text-xs text-neutral-500">{t.vatRecap}</caption>
              <thead>
                <tr className="border-b border-neutral-400 text-xs text-neutral-500">
                  <th className="py-1 text-left font-medium">{t.rate}</th>
                  <th className="py-1 text-right font-medium">{t.base}</th>
                  <th className="py-1 text-right font-medium">{t.vat}</th>
                  <th className="py-1 text-right font-medium">{t.total}</th>
                </tr>
              </thead>
              <tbody>
                {d.recap.map((r) => (
                  <tr
                    key={`${r.vatTreatment}-${r.vatRate}`}
                    className="border-b border-neutral-200"
                  >
                    <td className="py-1 tabular-nums">
                      {r.vatTreatment === 'standard' ? `${Number(r.vatRate)} %` : t.regime}
                    </td>
                    <td className="py-1 text-right">
                      <Money amount={r.base} currency={d.currency} />
                    </td>
                    <td className="py-1 text-right">
                      <Money amount={r.vat} currency={d.currency} />
                    </td>
                    <td className="py-1 text-right">
                      <Money amount={r.total} currency={d.currency} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {d.recap
          .filter((r) => r.note)
          .map((r) => (
            <p key={`${r.vatTreatment}-note`} className="text-sm text-neutral-700">
              {r.note}
            </p>
          ))}

        <div className="ml-auto max-w-xs space-y-1 text-sm">
          {Number(d.rounding) !== 0 && (
            <div className="flex justify-between text-neutral-600">
              <span>{t.rounding}</span>
              <Money amount={d.rounding} currency={d.currency} />
            </div>
          )}
          {d.exchangeRate && (
            <div className="text-xs text-neutral-500">
              {t.exchangeRate}: {Number(d.exchangeRate)}
            </div>
          )}
          <div className="flex items-baseline justify-between border-t border-b border-neutral-400 py-2">
            <span className="font-medium">{d.status === 'paid' ? t.lineTotal : t.amountDue}</span>
            <span className="font-serif text-3xl font-medium">
              <Money amount={d.status === 'paid' ? d.total : d.remaining} currency={d.currency} />
            </span>
          </div>
        </div>

        {d.status !== 'cancelled' && (
          <section className="flex flex-wrap items-start justify-between gap-4 text-sm">
            <div className="space-y-1">
              <h2 className="text-xs text-neutral-500">{t.payment}</h2>
              <div>
                {t.paymentMethod}:{' '}
                {t.methods[d.paymentMethod as keyof typeof t.methods] ?? d.paymentMethod}
              </div>
              {d.variableSymbol && (
                <div>
                  {t.variableSymbol}: <span className="tabular-nums">{d.variableSymbol}</span>
                </div>
              )}
              {d.bank && d.status === 'issued' && (
                <>
                  {d.bank.account && (
                    <div>
                      {t.account}: <span className="tabular-nums">{d.bank.account}</span>
                    </div>
                  )}
                  <div>
                    {t.iban}: <span className="tabular-nums">{d.bank.iban}</span>
                    {d.bank.bic ? ` · ${t.bic}: ${d.bank.bic}` : ''}
                  </div>
                </>
              )}
            </div>
            {d.qr && (
              <figure className="space-y-1 text-center">
                <svg
                  role="img"
                  aria-label={d.qr.kind === 'spayd' ? t.qrPlatba : t.qrEpc}
                  viewBox={`0 0 ${d.qr.viewBox} ${d.qr.viewBox}`}
                  className="size-32 bg-white"
                  shapeRendering="crispEdges"
                >
                  <path d={d.qr.path} stroke="#000" fill="none" />
                </svg>
                <figcaption className="text-xs text-neutral-500">
                  {d.qr.kind === 'spayd' ? t.qrPlatba : t.qrEpc}
                </figcaption>
              </figure>
            )}
          </section>
        )}

        {d.footerText && (
          <p className="text-sm whitespace-pre-line text-neutral-600">{d.footerText}</p>
        )}
        {d.appearance.signature && (
          <img src={d.appearance.signature} alt="" className="h-14 max-w-48 object-contain" />
        )}
        {d.appearance.showBrand && (
          <footer className="border-t border-neutral-200 pt-3 text-xs text-neutral-500">
            {t.issuedIn(cs.brand)}
          </footer>
        )}
      </article>
    </div>
  )
}
