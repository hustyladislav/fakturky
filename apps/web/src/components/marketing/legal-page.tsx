import { BRAND } from '@fakturky/core/brand'
import { Logo } from '@fakturky/ui/components/logo'
import { ThemeToggle } from '@fakturky/ui/components/theme'
import { Link } from '@tanstack/react-router'
import { TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { cs } from '@/i18n/cs'
import type { LegalSection } from '@/i18n/legal'

export function LegalPage({
  title,
  updated,
  sections,
  children,
}: {
  title: string
  updated: string
  sections?: readonly LegalSection[]
  children: ReactNode
}) {
  return (
    <div className="min-h-svh">
      <header className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <Link to="/">
          <Logo name={BRAND.name} markClassName="size-8" />
        </Link>
        <ThemeToggle labels={cs.theme} />
      </header>
      <div className="mx-auto grid max-w-5xl gap-x-14 px-6 pt-10 pb-24 lg:grid-cols-[13rem_minmax(0,40rem)]">
        <aside className="hidden lg:block">
          {sections && (
            <nav aria-label={title} className="sticky top-8">
              <p className="label-caps mb-3">{cs.legal.contents}</p>
              <ol className="space-y-0.5 border-l text-sm">
                {sections.map((s, i) => (
                  <li key={s.heading}>
                    <a
                      href={`#s-${i + 1}`}
                      className="-ml-px flex gap-2 border-l border-transparent py-1 pl-3 text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                    >
                      <span className="w-4 shrink-0 text-xs leading-5 tabular-nums">{i + 1}</span>
                      <span className="leading-5">{s.heading}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}
        </aside>
        <main>
          <p className="label-caps mb-3">{cs.legal.eyebrow}</p>
          <h1 className="text-[44px] leading-[1.08] font-medium tracking-[-0.02em] text-balance">
            {title}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground tabular-nums">
            {cs.legal.updated(updated)}
          </p>
          <div role="note" className="mt-6 flex gap-3 rounded-xl bg-warning/12 px-4 py-3 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            <p>{cs.legal.draftNotice}</p>
          </div>
          <div className="legal mt-10 text-[16px] leading-[1.7] [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
            {children}
          </div>
          <div className="mt-14 flex gap-5 border-t pt-6 text-sm text-muted-foreground">
            <Link to="/podminky" className="hover:text-foreground">
              {cs.legal.terms}
            </Link>
            <Link to="/soukromi" className="hover:text-foreground">
              {cs.legal.privacy}
            </Link>
          </div>
        </main>
      </div>
    </div>
  )
}

/** Renders [text](url) and **bold** inline markup from the dictionary. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*)/g)
  return (
    <>
      {parts.map((part, i) => {
        const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part)
        if (link) {
          return (
            <a key={i} href={link[2]} target="_blank" rel="noreferrer">
              {link[1]}
            </a>
          )
        }
        const bold = /^\*\*([^*]+)\*\*$/.exec(part)
        return bold ? <strong key={i}>{bold[1]}</strong> : <span key={i}>{part}</span>
      })}
    </>
  )
}

export function LegalSections({ sections }: { sections: readonly LegalSection[] }) {
  return (
    <>
      {sections.map((s, i) => (
        <section key={s.heading} id={`s-${i + 1}`} className="scroll-mt-8 pt-9 first:pt-0">
          <h2 className="flex items-baseline gap-3 text-2xl leading-8 font-medium tracking-[-0.01em]">
            <span className="label-caps w-5 shrink-0 font-sans tabular-nums">{i + 1}</span>
            {s.heading}
          </h2>
          {s.body.map((block) =>
            typeof block === 'string' ? (
              <p key={block} className="mt-3 sm:pl-8">
                <Inline text={block} />
              </p>
            ) : (
              <ul key={block.list[0]} className="mt-3 sm:pl-8">
                {block.list.map((li) => (
                  <li key={li}>
                    <Inline text={li} />
                  </li>
                ))}
              </ul>
            ),
          )}
        </section>
      ))}
    </>
  )
}
