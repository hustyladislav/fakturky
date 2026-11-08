import { BRAND } from '@fakturky/core/brand'
import { Logo } from '@fakturky/ui/components/logo'
import { ThemeToggle } from '@fakturky/ui/components/theme'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { cs } from '@/i18n/cs'

/** One calm centred column for sign-in and sign-up: logo, the form, the legal links. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <div className="flex justify-end">
        <ThemeToggle labels={cs.theme} />
      </div>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col pt-2 pb-10 sm:justify-center sm:pt-0">
        <Link to="/" className="mb-10 self-center">
          <Logo name={BRAND.name} markClassName="size-8" />
        </Link>
        {children}
      </main>
      <p className="text-center text-xs text-muted-foreground">
        <Link to="/podminky" className="hover:underline">
          {cs.legal.terms}
        </Link>
        {' · '}
        <Link to="/soukromi" className="hover:underline">
          {cs.legal.privacy}
        </Link>
      </p>
    </div>
  )
}
