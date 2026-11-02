import { InvoiceSheet } from '@fakturky/pdf/html'
import { Amount } from '@fakturky/ui/components/amount'
import { Avatar } from '@fakturky/ui/components/avatar'
import { StatusBadge } from '@fakturky/ui/components/status-badge'
import { Check } from 'lucide-react'
import { Delta, KpiCard } from '@/components/dashboard/kpi-card'
import { cs } from '@/i18n/cs'
import { demoInvoice } from './demo-invoice'

const t = cs.landing.hero

const awaiting = [
  { name: 'Studio Lípa s.r.o.', n: '2026-0040', amount: '56000.00', status: 'overdue' as const },
  { name: 'Novák & syn s.r.o.', n: '2026-0042', amount: '24200.00', status: 'issued' as const },
  { name: 'Kavárna U Mostu', n: '2026-0041', amount: '8500.00', status: 'issued' as const },
]

/**
 * Decorative product shot built from the real app pieces: KPI cards, the awaiting list rows and the
 * invoice sheet (the same HTML twin of the PDF). Hidden from assistive tech; no data is real.
 */
export function HeroComposition() {
  return (
    <div
      aria-hidden="true"
      className="relative mx-auto mt-10 max-w-5xl motion-safe:animate-in motion-safe:duration-700 motion-safe:fade-in motion-safe:slide-in-from-bottom-4 md:mt-14"
    >
      <div
        className="absolute inset-x-[8%] -top-6 bottom-0 -z-10 rounded-[2rem] bg-primary/10 blur-3xl"
        aria-hidden
      />
      <div className="relative overflow-hidden rounded-2xl border bg-muted/60 p-3 shadow-[0_40px_90px_-40px_rgb(0_0_0/0.4)] [mask-image:linear-gradient(to_bottom,black_82%,transparent)] md:p-5">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,21rem)] md:gap-5">
          <div className="space-y-3 md:space-y-4">
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <KpiCard
                label={t.kpiMonth}
                amount="148500.00"
                tone="ink"
                delta={<Delta current={148500} previous={132600} />}
                spark={[82, 96, 90, 118, 126, 148]}
              />
              <KpiCard
                label={t.kpiReceived}
                amount="112300.00"
                delta={<Delta current={112300} previous={104000} />}
                spark={[60, 72, 68, 95, 101, 112]}
              />
            </div>
            <div className="sheet overflow-hidden pt-4 pb-1">
              <div className="label-caps px-5">{t.awaiting}</div>
              <ul className="mt-2 divide-y divide-border/60">
                {awaiting.map((r) => (
                  <li key={r.n} className="flex items-center gap-3 px-5 py-2.5">
                    <Avatar name={r.name} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground tabular-nums">{r.n}</div>
                    </div>
                    <StatusBadge status={r.status} className="hidden sm:inline-flex">
                      {cs.status[r.status]}
                    </StatusBadge>
                    <Amount value={r.amount} hideZeroFraction />
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="relative hidden md:block">
            <div className="origin-top-right rotate-[1.5deg] overflow-hidden rounded-[3px] shadow-[0_0_0_1px_var(--border),0_4px_8px_rgb(0_0_0/0.05),0_30px_60px_-20px_rgb(0_0_0/0.35)]">
              <InvoiceSheet doc={demoInvoice} maxScale={1.2} headingLevel={4} decorative />
            </div>
            <div className="sheet absolute top-24 -left-8 flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium motion-safe:animate-[fk-float_6s_ease-in-out_infinite]">
              <span className="flex size-5 items-center justify-center rounded-full bg-success/15 text-success">
                <Check className="size-3" />
              </span>
              {t.paidToast}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
