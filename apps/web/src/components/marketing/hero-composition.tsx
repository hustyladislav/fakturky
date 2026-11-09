import { InvoiceSheet } from '@fakturky/pdf/html'
import { Amount } from '@fakturky/ui/components/amount'
import { StatusBadge } from '@fakturky/ui/components/status-badge'
import { cs } from '@/i18n/cs'
import { demoInvoice } from './demo-invoice'

const t = cs.landing.hero

const awaiting = [
  { name: 'Studio Lípa s.r.o.', n: '2026-0040', amount: '56000.00', status: 'overdue' as const },
  { name: 'Novák & syn s.r.o.', n: '2026-0042', amount: '24200.00', status: 'issued' as const },
  { name: 'Kavárna U Mostu', n: '2026-0041', amount: '8500.00', status: 'issued' as const },
]

function Figure({ label, amount }: { label: string; amount: string }) {
  return (
    <div>
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <Amount value={amount} size="hero" hideZeroFraction className="mt-1" />
    </div>
  )
}

/**
 * Decorative product view in the app's own flat language: two figures, the awaiting rows and the
 * invoice sheet (the HTML twin of the PDF). Hidden from assistive tech; no data is real.
 */
export function HeroComposition() {
  return (
    <div
      aria-hidden="true"
      className="mx-auto max-w-5xl overflow-hidden rounded-xl border xl:max-w-none bg-background motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in"
    >
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,40rem)]">
        <div className="@container p-5 md:p-8">
          {/* By the pane's own width: two hero amounts need ~28rem side by side. */}
          <div className="grid gap-5 @md:grid-cols-2 @md:gap-4">
            <Figure label={t.kpiMonth} amount="148500.00" />
            <Figure label={t.kpiReceived} amount="112300.00" />
          </div>
          <p className="mt-8 border-b pb-2 text-[13px] text-muted-foreground">{t.awaiting}</p>
          <ul className="divide-y">
            {awaiting.map((r) => (
              <li key={r.n} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{r.name}</div>
                  <StatusBadge status={r.status} className="mt-0.5">
                    {cs.status[r.status]}
                  </StatusBadge>
                </div>
                <Amount value={r.amount} hideZeroFraction />
              </li>
            ))}
          </ul>
        </div>
        {/* The paper runs off the bottom edge: shown large enough to read, cropped to the left pane's height. */}
        <div className="relative hidden overflow-hidden border-l bg-muted lg:block">
          <div className="absolute inset-x-8 top-8 overflow-hidden rounded-t-[3px] shadow-[0_0_0_1px_var(--border),0_12px_30px_-16px_rgb(0_0_0/0.25)]">
            <InvoiceSheet doc={demoInvoice} maxScale={1} headingLevel={4} decorative />
          </div>
        </div>
      </div>
    </div>
  )
}
