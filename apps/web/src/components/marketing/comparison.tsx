import { cn } from '@fakturky/ui/lib/utils'
import { Check, Minus, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cs } from '@/i18n/cs'
import { anchor, container, h2, inlineLink, lead, sectionY } from './styles'

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
    <section id="srovnani" className={`${container} ${sectionY} ${anchor}`}>
      <h2 className={`max-w-3xl ${h2}`}>{t.title}</h2>
      <p className={`mt-4 max-w-2xl ${lead}`}>{t.text}</p>

      <ul className="mt-8 divide-y border-y md:hidden">
        {t.rows.map(([feature, us, fakturoid, idoklad]) => (
          // Subgrid: the name column fits the longest name, identically in every group.
          <li
            key={feature}
            className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-2 py-4 text-sm"
          >
            <div className="col-span-2 font-medium">{feature}</div>
            {(
              [
                [t.us, us, true],
                [t.fakturoid, fakturoid, false],
                [t.idoklad, idoklad, false],
              ] as const
            ).map(([name, value, ours]) => (
              <div key={name} className="col-span-2 grid grid-cols-subgrid">
                <span className="whitespace-nowrap text-muted-foreground">{name}</span>
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
            <tr className="[&>th]:border-b [&>th]:px-4 [&>th]:py-3 [&>th]:font-medium [&>th:first-child]:pl-0">
              <th scope="col" className="w-[22%]">
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
          <tbody className="[&_td]:border-b [&_td]:px-4 [&_td]:py-3.5 [&_td]:align-top [&_th]:border-b [&_th]:py-3.5 [&_th]:pr-4 [&_tr:last-child_td]:border-b-0 [&_tr:last-child_th]:border-b-0">
            {t.rows.map(([feature, us, fakturoid, idoklad]) => (
              <tr key={feature}>
                <th scope="row" className="text-left font-medium">
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
            <a href={href} target="_blank" rel="noreferrer" className={inlineLink}>
              {name}
            </a>
          </span>
        ))}
        .
      </p>
    </section>
  )
}
