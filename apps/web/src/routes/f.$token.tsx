import { formatDateCs } from '@fakturky/domain/dates'
import { Button } from '@fakturky/ui/components/button'
import { Money } from '@fakturky/ui/components/money'
import { createFileRoute } from '@tanstack/react-router'
import { Download, Printer } from 'lucide-react'
import { cs } from '@/i18n/cs'
import { client } from '@/lib/orpc'

const t = cs.publicInvoice

export const Route = createFileRoute('/f/$token')({
  loader: ({ params }) => client.public.invoice({ token: params.token }).catch(() => null),
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
  if (!d) {
    return (
      <main className="mx-auto max-w-md p-6 pt-24 text-center">
        <p className="text-muted-foreground">{t.notFound}</p>
      </main>
    )
  }
  const title =
    d.type === 'proforma' ? t.titleProforma : d.vatPayer ? t.titleTaxInvoice : t.titleInvoice
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
          render={<a href={`/f/${token}/isdoc`} download />}
        >
          <Download /> {t.downloadIsdoc}
        </Button>
      </div>

      <article className="mx-auto max-w-3xl space-y-6 bg-white p-6 text-neutral-900 shadow-sm sm:p-10 print:shadow-none">
        <header className="flex items-start justify-between gap-4 border-b border-neutral-300 pb-4">
          <div>
            <h1 className="font-heading text-2xl font-semibold">{title}</h1>
            <div className="font-heading text-xl tabular-nums">{d.number}</div>
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

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
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
                  <td className="py-2">{l.description}</td>
                  <td className="py-2 text-right tabular-nums">
                    {Number(l.quantity)} {l.unit}
                  </td>
                  <td className="py-2 text-right">
                    <Money amount={l.unitPrice} currency={d.currency} />
                  </td>
                  {d.vatPayer && (
                    <td className="py-2 text-right tabular-nums">{Number(l.vatRate)} %</td>
                  )}
                  <td className="py-2 text-right">
                    <Money amount={l.total} currency={d.currency} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="ml-auto max-w-xs space-y-1 text-sm">
          {d.vatPayer &&
            d.recap.map((r) => (
              <div key={r.vatRate} className="flex justify-between text-neutral-600">
                <span>
                  {t.vatRecap} {Number(r.vatRate)} %: {t.base}{' '}
                  <Money amount={r.base} currency={d.currency} />
                </span>
                <Money amount={r.vat} currency={d.currency} />
              </div>
            ))}
          {d.exchangeRate && (
            <div className="text-xs text-neutral-500">
              {t.exchangeRate}: {Number(d.exchangeRate)}
            </div>
          )}
          <div className="flex items-baseline justify-between border-t border-b border-neutral-400 py-2">
            <span className="font-medium">{t.amountDue}</span>
            <span className="font-heading text-xl font-semibold">
              <Money amount={d.status === 'paid' ? '0' : d.remaining} currency={d.currency} />
            </span>
          </div>
        </div>

        {d.bank && (
          <section className="space-y-1 text-sm">
            <h2 className="text-xs text-neutral-500">{t.payment}</h2>
            {d.bank.account && (
              <div>
                {t.account}: <span className="tabular-nums">{d.bank.account}</span>
              </div>
            )}
            <div>
              {t.iban}: <span className="tabular-nums">{d.bank.iban}</span>
              {d.bank.bic ? ` · ${t.bic}: ${d.bank.bic}` : ''}
            </div>
          </section>
        )}

        {d.footerText && (
          <p className="text-sm whitespace-pre-line text-neutral-600">{d.footerText}</p>
        )}
        <footer className="border-t border-neutral-200 pt-3 text-xs text-neutral-400">
          {t.issuedIn(cs.brand)}
        </footer>
      </article>
    </div>
  )
}
