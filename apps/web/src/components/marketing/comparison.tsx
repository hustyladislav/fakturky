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
    <section id="srovnani" className="mx-auto max-w-[1200px] px-5 py-14 md:px-8 md:py-20">
      <h2 className="max-w-3xl text-[32px] leading-[38px] tracking-[-0.02em] text-balance md:text-5xl md:leading-[50px]">
        {t.title}
      </h2>
      <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-pretty text-muted-foreground">
        {t.text}
      </p>

      <ul className="mt-8 divide-y border-y md:hidden">
        {t.rows.map(([feature, us, fakturoid, idoklad]) => (
          <li key={feature} className="space-y-2 py-4 text-sm">
            <div className="font-medium">{feature}</div>
            {(
              [
                [t.us, us, true],
                [t.fakturoid, fakturoid, false],
                [t.idoklad, idoklad, false],
              ] as const
            ).map(([name, value, ours]) => (
              <div key={name} className="grid grid-cols-[6.5rem_1fr] gap-3">
                <span className="text-muted-foreground">{name}</span>
                <Cell value={value} ours={ours} />
              </div>
            ))}
          </li>
        ))}
      </ul>

      <div className="mt-10 hidden md:block">
        <table className="w-full border-separate border-spacing-0 text-left text-sm">
          <caption className="sr-only">{t.caption}</caption>
          <thead>
            <tr className="[&>th]:border-b [&>th]:px-4 [&>th]:py-3 [&>th]:font-medium">
              <th scope="col" className="w-[22%] pl-0">
                {t.feature}
              </th>
              <th scope="col" className="w-[26%] bg-muted">
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
          <tbody className="[&_td]:border-b [&_td]:px-4 [&_td]:py-3.5 [&_td]:align-top [&_th]:border-b [&_th]:px-4 [&_th]:py-3.5 [&_tr:last-child_td]:border-b-0 [&_tr:last-child_th]:border-b-0">
            {t.rows.map(([feature, us, fakturoid, idoklad]) => (
              <tr key={feature}>
                <th scope="row" className="pl-0 text-left font-medium">
                  {feature}
                </th>
                <td className="bg-muted">
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
