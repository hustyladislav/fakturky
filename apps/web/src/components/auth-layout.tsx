import { BRAND } from '@fakturky/core/brand'
import { InvoiceSheet, type InvoiceSheetDraft } from '@fakturky/pdf/html'
import { Amount } from '@fakturky/ui/components/amount'
import { Logo } from '@fakturky/ui/components/logo'
import { StatusBadge } from '@fakturky/ui/components/status-badge'
import { ThemeToggle } from '@fakturky/ui/components/theme'
import { Link } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { cs } from '@/i18n/cs'

/** A believable invoice for the product visual (never real data). */
const DEMO: InvoiceSheetDraft = {
  type: 'invoice',
  language: 'cs',
  vatPayer: false,
  number: '2026-0014',
  issueDate: '2026-11-02',
  brandName: BRAND.name,
  supplier: {
    name: 'Jana Nováková',
    ico: '04817623',
    street: 'Vinohradská 1234/56',
    city: 'Praha 2',
    zip: '120 00',
    country: 'CZ',
  },
  customer: {
    name: 'Studio Lípa s.r.o.',
    ico: '25596641',
    street: 'Lipová 8',
    city: 'Ostrava',
    zip: '702 00',
    country: 'CZ',
  },
  lines: [
    { description: 'Návrh vizuální identity', quantity: '1', unit: 'ks', unitPrice: '18000' },
    { description: 'Webový redesign, 12 hodin', quantity: '12', unit: 'h', unitPrice: '1500' },
    { description: 'Správa webu (měsíčně)', quantity: '1', unit: 'ks', unitPrice: '3500' },
  ],
  payment: {
    method: 'bank_transfer',
    dueDate: '2026-11-16',
    variableSymbol: '20260014',
    bankAccount: {
      accountNumber: '19-2000145399',
      bankCode: '0800',
      iban: 'CZ6508000000192000145399',
      showQr: true,
    },
  },
}

/** Auth layout: the form on the desk, a scaled product sheet on large screens. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <main className="flex flex-col px-6 py-6 sm:px-12">
        <div className="flex items-center justify-between">
          <Link to="/">
            <Logo name={BRAND.name} markClassName="size-8" />
          </Link>
          <ThemeToggle labels={cs.theme} />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          {children}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          <Link to="/podminky" className="hover:underline">
            {cs.legal.terms}
          </Link>
          {' · '}
          <Link to="/soukromi" className="hover:underline">
            {cs.legal.privacy}
          </Link>
        </p>
      </main>
      <aside className="relative hidden overflow-hidden border-l bg-sidebar lg:flex lg:flex-col">
        <div className="relative z-10 max-w-lg space-y-5 px-12 pt-14 xl:px-16">
          <h2 className="font-serif text-[40px] leading-[1.08] font-medium tracking-tight text-balance">
            {cs.authPanel.title}
          </h2>
          <ul className="space-y-2.5 text-[15px]">
            {cs.authPanel.points.map((p) => (
              <li key={p} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <Check className="size-3" aria-hidden />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mt-auto flex justify-center px-10 pb-0" aria-hidden>
          <div className="relative -mb-40 w-full max-w-[460px] origin-bottom -rotate-[2.5deg] xl:max-w-[500px]">
            <div className="overflow-hidden rounded-[3px] shadow-[0_0_0_1px_var(--border),0_4px_8px_rgb(0_0_0/0.05),0_40px_80px_-24px_rgb(0_0_0/0.35)]">
              <InvoiceSheet doc={DEMO} maxScale={1.2} headingLevel={4} />
            </div>
            <div className="sheet absolute -top-5 -right-6 flex items-center gap-3 px-3.5 py-2.5">
              <StatusBadge status="issued" className="min-w-0">
                {cs.status.issued}
              </StatusBadge>
              <Amount value="39500" size="md" />
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}
