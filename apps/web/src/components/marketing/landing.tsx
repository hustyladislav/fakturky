import { BRAND } from '@fakturky/core/brand'
import { Button } from '@fakturky/ui/components/button'
import { Logo } from '@fakturky/ui/components/logo'
import { Money } from '@fakturky/ui/components/money'
import { StatusBadge } from '@fakturky/ui/components/status-badge'
import { ThemeToggle } from '@fakturky/ui/components/theme'
import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  Bot,
  Calculator,
  CalendarSync,
  Coffee,
  FileCheck2,
  Infinity as InfinityIcon,
  Plug,
  QrCode,
  Search,
  Terminal,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { cs } from '@/i18n/cs'

function Github({ className, ...props }: React.ComponentProps<'svg'> & { 'data-icon'?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.7 5.4-5.27 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  )
}

const t = cs.landing
const featureIcons = [InfinityIcon, QrCode, Search, Calculator, CalendarSync, FileCheck2]

export function Landing() {
  return (
    <div className="min-h-svh">
      <SiteHeader />
      <main>
        <Hero />
        <Why />
        <Features />
        <ForAssistants />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  )
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-6 px-5 md:px-8">
        <Link to="/">
          <Logo name={BRAND.name} markClassName="size-8" />
        </Link>
        <nav
          className="hidden items-center gap-6 text-sm text-muted-foreground md:flex"
          aria-label="Sekce"
        >
          <a href="#funkce" className="hover:text-foreground">
            {t.nav.features}
          </a>
          <a href="#proc-zdarma" className="hover:text-foreground">
            {t.nav.why}
          </a>
          <a href="#ai" className="hover:text-foreground">
            {t.nav.ai}
          </a>
          <a href="#faq" className="hover:text-foreground">
            {t.nav.faq}
          </a>
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle labels={cs.theme} />
          <Button
            variant="ghost"
            size="lg"
            className="hidden sm:inline-flex"
            nativeButton={false}
            render={<Link to="/prihlaseni" />}
          >
            {t.signIn}
          </Button>
          <Button size="lg" nativeButton={false} render={<Link to="/registrace" />}>
            {t.start}
          </Button>
        </div>
      </div>
    </header>
  )
}

function Hero() {
  return (
    <section className="mx-auto max-w-[1200px] px-5 pt-14 pb-16 md:px-8 md:pt-24 md:pb-24">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-5xl leading-[1.05] font-medium tracking-tight text-balance md:text-7xl">
          {t.heroTitle}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-pretty text-muted-foreground">
          {t.heroText}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button
            size="lg"
            className="h-11 px-5 text-base"
            nativeButton={false}
            render={<Link to="/registrace" />}
          >
            {t.start}
            <ArrowRight data-icon="inline-end" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="h-11 px-5 text-base"
            nativeButton={false}
            render={<a href={BRAND.repoUrl} target="_blank" rel="noreferrer" />}
          >
            <Github data-icon="inline-start" />
            GitHub
          </Button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">{t.heroNote}</p>
      </div>
      <ProductMock />
    </section>
  )
}

const qrCells = Array.from({ length: 169 }, (_, i) => {
  const x = i % 13
  const y = Math.floor(i / 13)
  const finder = (x < 4 && y < 4) || (x > 8 && y < 4) || (x < 4 && y > 8)
  return finder
    ? (x % 3 === 1 && y % 3 === 1) ||
        x === 0 ||
        y === 0 ||
        x === 3 ||
        y === 3 ||
        x === 9 ||
        x === 12 ||
        y === 9 ||
        y === 12
    : (i * 7 + y * 3) % 5 < 2
})

function ProductMock() {
  const rows = [
    {
      n: '2026-0042',
      c: 'Novák & syn s.r.o.',
      a: '24200.00',
      s: 'issued' as const,
      l: cs.status.issued,
    },
    { n: '2026-0041', c: 'Kavárna U Mostu', a: '8500.00', s: 'paid' as const, l: cs.status.paid },
    {
      n: '2026-0040',
      c: 'Studio Lípa',
      a: '56000.00',
      s: 'overdue' as const,
      l: cs.status.overdue,
    },
    { n: '2026-0039', c: 'Ing. Petr Dvořák', a: '3200.00', s: 'paid' as const, l: cs.status.paid },
  ]
  return (
    <div className="relative mx-auto mt-14 max-w-5xl md:mt-20" aria-hidden="true">
      <div className="overflow-hidden rounded-xl border bg-card shadow-[0_30px_80px_-30px_rgba(31,77,60,0.35)]">
        <div className="flex h-9 items-center gap-1.5 border-b bg-muted px-3">
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
        </div>
        <div className="grid md:grid-cols-[1.1fr_1fr]">
          <div className="border-b p-5 md:border-r md:border-b-0 md:p-6">
            <div className="mb-4 text-sm font-medium text-muted-foreground">{t.mock.recent}</div>
            <ul className="divide-y">
              {rows.map((r) => (
                <li key={r.n} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{r.n}</div>
                    <div className="truncate text-xs text-muted-foreground">{r.c}</div>
                  </div>
                  <StatusBadge status={r.s} className="hidden sm:inline-flex">
                    {r.l}
                  </StatusBadge>
                  <Money amount={r.a} className="text-sm" />
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-muted/50 p-5 md:p-6">
            <div className="mx-auto max-w-sm rounded-md border bg-white p-5 text-[#1B1A17] shadow-sm">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-neutral-500">{t.mock.invoice}</span>
                <span className="font-serif text-lg font-semibold">{t.mock.number}</span>
              </div>
              <div className="mt-1 text-sm">{t.mock.customer}</div>
              <div className="my-4 h-px bg-neutral-200" />
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-xs text-neutral-500">{t.mock.total}</div>
                  <div className="font-serif text-3xl font-medium">24&nbsp;200,00&nbsp;Kč</div>
                </div>
                <div className="text-center">
                  <div className="grid size-16 grid-cols-13 gap-px">
                    {qrCells.map((on, i) => (
                      <span key={i} className={on ? 'bg-neutral-900' : 'bg-transparent'} />
                    ))}
                  </div>
                  <div className="mt-1 text-[10px] text-neutral-500">{t.mock.qr}</div>
                </div>
              </div>
              <div className="mt-4 h-1 rounded-full bg-primary" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Why() {
  return (
    <section id="proc-zdarma" className="border-y bg-card py-16 md:py-24">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-5 md:grid-cols-[1fr_1.4fr] md:px-8">
        <h2 className="text-4xl leading-tight font-medium md:text-5xl">{t.whyTitle}</h2>
        <div className="space-y-4 text-[17px] leading-relaxed text-pretty">
          {t.whyText.map((p) => (
            <p key={p}>{p}</p>
          ))}
          <div className="flex flex-wrap gap-3 pt-2">
            <Button
              nativeButton={false}
              size="lg"
              render={<a href={BRAND.supportUrl} target="_blank" rel="noreferrer" />}
            >
              <Coffee data-icon="inline-start" />
              {t.whyCoffee}
            </Button>
            <Button
              variant="outline"
              size="lg"
              nativeButton={false}
              render={<a href={BRAND.repoUrl} target="_blank" rel="noreferrer" />}
            >
              <Github data-icon="inline-start" />
              {t.whyGithub}
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

function Features() {
  return (
    <section id="funkce" className="mx-auto max-w-[1200px] px-5 py-16 md:px-8 md:py-24">
      <h2 className="max-w-2xl text-4xl leading-tight font-medium text-balance md:text-5xl">
        {t.featuresTitle}
      </h2>
      <ul className="mt-10 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
        {t.features.map(([title, text], i) => {
          const Icon = featureIcons[i] ?? InfinityIcon
          return (
            <li key={title} className="bg-background p-6">
              <Icon className="size-5 text-primary" aria-hidden />
              <h3 className="mt-4 text-base font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{text}</p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function ForAssistants() {
  const icons = [Plug, Bot, Terminal]
  return (
    <section id="ai" className="border-y bg-sidebar py-16 md:py-24">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-5 md:px-8 lg:grid-cols-2">
        <div>
          <h2 className="text-4xl leading-tight font-medium md:text-5xl">{t.aiTitle}</h2>
          <p className="mt-4 max-w-lg text-[17px] leading-relaxed text-pretty">{t.aiText}</p>
          <ul className="mt-8 space-y-4">
            {t.aiCards.map(([title, text], i) => {
              const Icon = icons[i] ?? Plug
              return (
                <li key={title} className="flex gap-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <div>
                    <div className="font-medium">{title}</div>
                    <div className="text-sm text-muted-foreground">{text}</div>
                  </div>
                </li>
              )
            })}
          </ul>
          <Button
            variant="outline"
            size="lg"
            className="mt-8"
            nativeButton={false}
            render={<a href="/docs/api" />}
          >
            {t.docs}
            <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
        <ApiExample />
      </div>
    </section>
  )
}

function ApiExample() {
  // Derived from the current origin so the key never points at another deployment.
  const [origin, setOrigin] = useState('https://vase-instance.example')
  useEffect(() => setOrigin(window.location.origin), [])
  return (
    <pre className="min-w-0 self-start overflow-x-auto rounded-xl border bg-card p-5 font-mono text-[13px] leading-relaxed">
      <code>{`# ${t.aiCards[0]?.[0]}
curl ${origin}/api/v1/documents \\
  -H "Authorization: Bearer ${BRAND.apiKeyPrefix}…"

# OpenAPI
${origin}/api/v1/openapi.json`}</code>
    </pre>
  )
}

function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-5 py-16 md:px-8 md:py-24">
      <h2 className="text-4xl leading-tight font-medium md:text-5xl">{t.faqTitle}</h2>
      <div className="mt-8 divide-y border-y">
        {t.faq.map(([q, a]) => (
          <details key={q} className="group py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
              {q}
              <span
                className="text-xl text-muted-foreground transition-transform group-open:rotate-45"
                aria-hidden
              >
                +
              </span>
            </summary>
            <p className="mt-2 text-muted-foreground">{a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

function FinalCta() {
  return (
    <section className="mx-auto max-w-[1200px] px-5 pb-20 md:px-8 md:pb-28">
      <div className="rounded-xl border bg-accent px-6 py-14 text-center md:py-20">
        <h2 className="mx-auto max-w-2xl text-4xl leading-tight font-medium text-balance text-accent-foreground md:text-5xl">
          {t.ctaTitle}
        </h2>
        <Button
          size="lg"
          className="mt-8 h-11 px-6 text-base"
          nativeButton={false}
          render={<Link to="/registrace" />}
        >
          {t.start}
          <ArrowRight data-icon="inline-end" />
        </Button>
      </div>
    </section>
  )
}

function SiteFooter() {
  const link = 'text-muted-foreground hover:text-foreground'
  return (
    <footer className="border-t">
      <div className="mx-auto grid max-w-[1200px] gap-8 px-5 py-12 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:px-8">
        <div>
          <Logo name={BRAND.name} markClassName="size-8" />
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">{t.footer.made}</p>
        </div>
        <FooterCol title={t.footer.product}>
          <a href="#funkce" className={link}>
            {t.nav.features}
          </a>
          <a href="/docs/api" className={link}>
            {t.docs}
          </a>
          <Link to="/prihlaseni" className={link}>
            {t.signIn}
          </Link>
        </FooterCol>
        <FooterCol title={t.footer.project}>
          <a href={BRAND.repoUrl} target="_blank" rel="noreferrer" className={link}>
            GitHub
          </a>
          <a href={BRAND.supportUrl} target="_blank" rel="noreferrer" className={link}>
            {cs.shell.coffee}
          </a>
          <a href={BRAND.issuesUrl} target="_blank" rel="noreferrer" className={link}>
            {t.footer.feedback}
          </a>
        </FooterCol>
        <FooterCol title={t.footer.legal}>
          <Link to="/podminky" className={link}>
            {cs.legal.terms}
          </Link>
          <Link to="/soukromi" className={link}>
            {cs.legal.privacy}
          </Link>
        </FooterCol>
      </div>
    </footer>
  )
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="mb-1 font-medium">{title}</div>
      {children}
    </div>
  )
}
