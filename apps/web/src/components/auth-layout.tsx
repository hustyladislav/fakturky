import { BRAND } from '@fakturky/core/brand'
import { Logo } from '@fakturky/ui/components/logo'
import { ThemeToggle } from '@fakturky/ui/components/theme'
import { Link } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { cs } from '@/i18n/cs'

/** Two-column auth layout: form on the paper, calm brand panel on large screens. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <main className="flex flex-col px-6 py-6 sm:px-12">
        <div className="flex items-center justify-between">
          <Link to="/" aria-label={BRAND.name}>
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
      <aside className="relative hidden flex-col justify-between overflow-hidden border-l bg-sidebar p-12 lg:flex">
        <div />
        <div className="max-w-md space-y-8">
          <h2 className="font-serif text-4xl leading-[1.1] font-medium tracking-tight text-balance">
            {cs.authPanel.title}
          </h2>
          <ul className="space-y-3 text-[15px]">
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
        <p className="max-w-md text-sm text-muted-foreground">{cs.authPanel.note}</p>
      </aside>
    </div>
  )
}
