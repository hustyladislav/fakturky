import { cn } from '@fakturky/ui/lib/utils'
import { Check, Minus, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cs } from '@/i18n/cs'

const t = cs.landing.compare

const SOURCES = [
  ['Fakturoid', 'https://www.fakturoid.cz/cenik'],
  ['iDoklad', 'https://www.idoklad.cz/cenik'],
] as const

function Mark({ kind, children }: { kind: 'yes' | 'no' | 'limited'; children: ReactNode }) {
  const Icon = kind === 'yes' ? Check : kind === 'no' ? X : Minus
  return (
    <span className="flex items-start gap-2">
      <Icon
        className={cn(
          'mt-0.5 size-4 shrink-0',
          kind === 'yes' ? 'text-success' : 'text-muted-foreground',
        )}
        aria-hidden
      />
      <span>{children}</span>
    </span>
  )
}

function Cell({ value, ours }: { value: string; ours?: boolean }) {
  if (value === 'yes') return <Mark kind="yes">{t.yes}</Mark>
  if (ours) return <Mark kind="yes">{value}</Mark>
  return <Mark kind={/^Ne(\s|$)/.test(value) ? 'no' : 'limited'}>{value}</Mark>
}

/** Honest free-tier comparison: facts from the public price lists, with sources. */
export function Comparison() {
  return (
    <section id="srovnani" className="mx-auto max-w-[1200px] px-5 py-12 md:px-8 md:py-16">
      <h2 className="max-w-3xl text-4xl leading-tight font-medium text-balance md:text-5xl">
        {t.title}
      </h2>
      <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-pretty text-muted-foreground">
        {t.text}
      </p>
      <div
        className="mt-8 overflow-x-auto rounded-xl border bg-card focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        role="region"
        aria-label={t.caption}
        tabIndex={0}
      >
        <table className="w-full min-w-[46rem] border-separate border-spacing-0 text-left text-sm">
          <caption className="sr-only">{t.caption}</caption>
          <thead>
            <tr className="[&>th]:border-b [&>th]:px-4 [&>th]:py-3 [&>th]:font-medium">
              <th scope="col" className="w-[22%]">
                {t.feature}
              </th>
              <th scope="col" className="w-[26%] bg-accent text-accent-foreground">
                {t.us}
              </th>
              <th scope="col" className="w-[26%]">
                {t.fakturoid}
              </th>
              <th scope="col" className="w-[26%]">
                {t.idoklad}
              </th>
            </tr>
          </thead>
          <tbody className="[&_td]:border-b [&_td]:px-4 [&_td]:py-3 [&_td]:align-top [&_th]:border-b [&_th]:px-4 [&_th]:py-3 [&_tr:last-child_td]:border-b-0 [&_tr:last-child_th]:border-b-0">
            {t.rows.map(([feature, us, fakturoid, idoklad]) => (
              <tr key={feature}>
                <th scope="row" className="text-left font-medium">
                  {feature}
                </th>
                <td className="bg-accent/50">
                  <Cell value={us} ours />
                </td>
                <td>
                  <Cell value={fakturoid} />
                </td>
                <td>
                  <Cell value={idoklad} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
        {t.disclaimer} {t.sources}:{' '}
        {SOURCES.map(([name, href], i) => (
          <span key={name}>
            {i > 0 && ', '}
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-foreground underline underline-offset-4"
            >
              {name}
            </a>
          </span>
        ))}
        .
      </p>
    </section>
  )
}
