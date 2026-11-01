import { BRAND } from '@fakturky/core/brand'
import { Logo } from '@fakturky/ui/components/logo'
import { ThemeToggle } from '@fakturky/ui/components/theme'
import { Link } from '@tanstack/react-router'
import { TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { cs } from '@/i18n/cs'

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: ReactNode
}) {
  return (
    <div className="min-h-svh">
      <header className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
        <Link to="/" aria-label={BRAND.name}>
          <Logo name={BRAND.name} markClassName="size-8" />
        </Link>
        <ThemeToggle labels={cs.theme} />
      </header>
      <main className="mx-auto max-w-3xl px-6 pt-8 pb-24">
        <h1 className="text-4xl leading-tight font-medium">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{cs.legal.updated(updated)}</p>
        <div className="mt-6 flex gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <p>{cs.legal.draftNotice}</p>
        </div>
        <div className="legal mt-8 space-y-4 text-[15px] leading-relaxed [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-medium [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1 [&_a]:underline">
          {children}
        </div>
        <div className="mt-12 flex gap-4 border-t pt-6 text-sm text-muted-foreground">
          <Link to="/podminky" className="hover:text-foreground">
            {cs.legal.terms}
          </Link>
          <Link to="/soukromi" className="hover:text-foreground">
            {cs.legal.privacy}
          </Link>
        </div>
      </main>
    </div>
  )
}
