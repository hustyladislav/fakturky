import { BRAND } from '@fakturky/core/brand'
import { Button } from '@fakturky/ui/components/button'
import { Logo } from '@fakturky/ui/components/logo'
import { ThemeToggle } from '@fakturky/ui/components/theme'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Coffee } from 'lucide-react'
import { useEffect, useState } from 'react'
import { CopyButton } from '@/components/copy-button'
import { cs } from '@/i18n/cs'
import { Comparison } from './comparison'
import { HeroComposition } from './hero-composition'
import { IcoDemo } from './ico-demo'
import { anchor, container, focusRing, h2, inlineLink, lead, sectionY } from './styles'

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

export function Landing() {
  return (
    <div className="min-h-svh">
      <SiteHeader />
      <main>
        <Hero />
        <IcoDemo />
        <Features />
        <Comparison />
        <Why />
        <ForAssistants />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  )
}

function SiteHeader() {
  const link = `text-muted-foreground transition-colors hover:text-foreground ${focusRing}`
  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
      <div className={`${container} flex h-14 items-center gap-3 sm:gap-6`}>
        <Link to="/" className={focusRing}>
          {/* Below 430 px the wordmark yields so sign-in and sign-up both fit; it stays the link's name. */}
          <Logo name={BRAND.name} markClassName="size-7" nameClassName="max-[429px]:sr-only" />
        </Link>
        <nav className="hidden items-center gap-6 text-sm lg:flex" aria-label="Sekce">
          <a href="#funkce" className={link}>
            {t.nav.features}
          </a>
          <a href="#srovnani" className={link}>
            {t.nav.compare}
          </a>
          <a href="#proc-zdarma" className={link}>
            {t.nav.why}
          </a>
          <a href="#ai" className={link}>
            {t.nav.ai}
          </a>
          <a href="#faq" className={link}>
            {t.nav.faq}
          </a>
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <div className="max-sm:hidden">
            <ThemeToggle labels={cs.theme} />
          </div>
          <Button
            variant="ghost"
            size="lg"
            className="max-sm:px-2.5"
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
    <section className={`${container} pt-14 pb-12 md:pt-24 md:pb-20`}>
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-[40px] leading-[42px] font-normal tracking-[-0.02em] text-balance md:text-[64px] md:leading-[64px]">
          {t.heroTitle}
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-pretty text-muted-foreground">
          {t.heroText}
        </p>
        <Button
          variant="brand"
          size="lg"
          className="mt-8 h-12 px-6 text-base"
          nativeButton={false}
          render={<Link to="/registrace" />}
        >
          {t.start}
          <ArrowRight data-icon="inline-end" />
        </Button>
        <p className="mt-3 text-sm text-muted-foreground">{t.heroNote}</p>
      </div>
      <div className="mt-12 md:mt-16">
        <HeroComposition />
      </div>
    </section>
  )
}

function Features() {
  return (
    <section id="funkce" className={`bg-muted ${sectionY} ${anchor}`}>
      <div className={container}>
        <h2 className={`max-w-2xl ${h2}`}>{t.featuresTitle}</h2>
        <ul className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {t.features.map(([title, text]) => (
            <li key={title} className="border-t border-foreground/15 pt-4">
              <h3 className="text-base font-medium">{title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function Why() {
  return (
    <section id="proc-zdarma" className={`bg-muted ${sectionY} ${anchor}`}>
      <div className={`${container} grid gap-8 md:grid-cols-[1fr_1.4fr] md:gap-14`}>
        <h2 className={h2}>{t.whyTitle}</h2>
        <div className="space-y-4 text-[17px] leading-relaxed text-pretty">
          {t.whyText.map((p) => (
            <p key={p}>{p}</p>
          ))}
          <div className="flex flex-wrap gap-3 pt-2">
            <Button
              variant="outline"
              size="lg"
              nativeButton={false}
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

function ForAssistants() {
  return (
    <section id="ai" className={`${sectionY} ${anchor}`}>
      <div className={`${container} grid gap-10 lg:grid-cols-2 lg:gap-14`}>
        <div>
          <h2 className={h2}>{t.aiTitle}</h2>
          <p className={`mt-4 max-w-lg ${lead}`}>{t.aiText}</p>
          <ul className="mt-8 divide-y border-y">
            {t.aiCards.map(([title, text]) => (
              <li key={title} className="py-3.5">
                <div className="font-medium">{title}</div>
                <div className="text-sm text-muted-foreground">{text}</div>
              </li>
            ))}
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

function Snippet({ title, children }: { title: string; children: string }) {
  return (
    <figure className="min-w-0">
      <figcaption className="mb-1.5 text-xs font-medium text-muted-foreground">{title}</figcaption>
      <div className="relative">
        <pre className="overflow-x-auto rounded-lg bg-muted p-4 pr-14 font-mono text-[13px] leading-relaxed">
          <code>{children}</code>
        </pre>
        <CopyButton
          text={children}
          labels={t}
          className="absolute top-2 right-2 text-muted-foreground hover:bg-background hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-copied:text-success"
        />
      </div>
    </figure>
  )
}

function ApiExample() {
  // Derived from the current origin so the key never points at another deployment.
  const [origin, setOrigin] = useState<string>(BRAND.productionUrl)
  useEffect(() => setOrigin(window.location.origin), [])
  const mcp = JSON.stringify(
    {
      mcpServers: {
        [BRAND.slug]: {
          url: `${origin}/mcp`,
          headers: { Authorization: `Bearer ${BRAND.apiKeyPrefix}…` },
        },
      },
    },
    null,
    2,
  )
  return (
    <div className="min-w-0 space-y-4 self-start">
      <Snippet title={t.aiConfigTitle}>{mcp}</Snippet>
      <p className="-mt-2 text-xs text-muted-foreground">
        {t.aiConfigHint}{' '}
        <a href="/docs/mcp" className={inlineLink}>
          {t.aiMcpDocs}
        </a>
      </p>
      <Snippet title={t.aiCards[0]?.[0] ?? 'REST API'}>{`curl ${origin}/api/v1/documents \\
  -H "Authorization: Bearer ${BRAND.apiKeyPrefix}…"`}</Snippet>
    </div>
  )
}

function Faq() {
  return (
    <section id="faq" className={`bg-muted ${sectionY} ${anchor}`}>
      <div className="mx-auto max-w-3xl px-5 md:px-8">
        <h2 className={h2}>{t.faqTitle}</h2>
        <div className="mt-8 divide-y divide-foreground/15 border-y border-foreground/15">
          {t.faq.map(([q, a]) => (
            <details key={q} className="group">
              <summary
                className={`flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-medium [&::-webkit-details-marker]:hidden ${focusRing}`}
              >
                {q}
                <span
                  className="text-xl text-muted-foreground transition-transform duration-150 ease-out group-open:rotate-45"
                  aria-hidden
                >
                  +
                </span>
              </summary>
              <p className="pb-4 text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

function FinalCta() {
  return (
    <section className={`${container} py-16 text-center md:py-24`}>
      <h2 className={`mx-auto max-w-2xl ${h2}`}>{t.ctaTitle}</h2>
      <Button
        variant="brand"
        size="lg"
        className="mt-8 h-12 px-6 text-base"
        nativeButton={false}
        render={<Link to="/registrace" />}
      >
        {t.start}
        <ArrowRight data-icon="inline-end" />
      </Button>
    </section>
  )
}

function SiteFooter() {
  // Touch gets 44 px rows; a fine pointer keeps the compact desktop column.
  const link = `inline-flex items-center self-start text-muted-foreground transition-colors hover:text-foreground pointer-coarse:min-h-11 ${focusRing}`
  return (
    <footer className="border-t">
      <div className={`${container} grid gap-8 py-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]`}>
        <div>
          <Logo name={BRAND.name} markClassName="size-8" />
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">{t.footer.made}</p>
          {/* The header drops the theme switch on phones; it lives here instead. */}
          <div className="mt-4 -ml-2.5 sm:hidden">
            <ThemeToggle labels={cs.theme} />
          </div>
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
    <div className="flex flex-col gap-2 text-sm pointer-coarse:gap-0">
      <div className="mb-1 font-medium">{title}</div>
      {children}
    </div>
  )
}
