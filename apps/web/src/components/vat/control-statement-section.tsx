import { formatDateCs } from '@fakturky/domain/dates'
import { parseDecimal } from '@fakturky/domain/money'
import { Money } from '@fakturky/ui/components/money'
import type { ReactNode } from 'react'
import { SettingsSection } from '@/components/settings/settings-section'
import { cs } from '@/i18n/cs'
import { DocLink, Drill, DrillButton, type DrillState } from './drill'
import type { VatReport } from './use-vat-report'

const t = cs.vat.kh

function Part({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}

const Th = ({ children, right }: { children: ReactNode; right?: boolean }) => (
  <th scope="col" className={`py-2 pr-3 font-normal last:pr-0 ${right ? 'text-right' : ''}`}>
    {children}
  </th>
)

/** Kontrolní hlášení: A.1, A.4 per document, A.5 in sum. */
export function ControlStatementSection({
  report,
  drill,
}: {
  report: VatReport
  drill: DrillState
}) {
  const { a1, a4, a5 } = report.kh
  const a5Count = report.contributions.filter((c) => c.rowKey === 'kh.A5').length
  const a5Empty = ['base21', 'vat21', 'base12', 'vat12'].every((k) =>
    parseDecimal(a5[k as keyof typeof a5]).isZero(),
  )
  const none = <p className="text-sm text-muted-foreground">{t.none}</p>
  const head = 'text-left text-xs text-muted-foreground'
  return (
    <SettingsSection title={t.title} description={t.description}>
      <div className="space-y-8">
        <Part title={t.a1}>
          {a1.length === 0 ? (
            none
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[30rem] text-sm">
                <thead>
                  <tr className={head}>
                    <Th>{t.document}</Th>
                    <Th>{t.dic}</Th>
                    <Th>{t.date}</Th>
                    <Th>{t.code}</Th>
                    <Th right>{cs.vat.dph.base}</Th>
                  </tr>
                </thead>
                <tbody className="border-y">
                  {a1.map((x) => (
                    <tr key={x.documentId} className="border-b last:border-0">
                      <td className="py-2 pr-3">
                        <DocLink report={report} id={x.documentId} />
                      </td>
                      <td className="py-2 pr-3">{x.dicOdb}</td>
                      <td className="py-2 pr-3">{formatDateCs(x.duzp)}</td>
                      <td className="py-2 pr-3">{x.code}</td>
                      <td className="py-2 text-right">
                        <Money amount={x.base} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Part>

        <Part title={t.a4}>
          {a4.length === 0 ? (
            none
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-sm">
                <thead>
                  <tr className={head}>
                    <Th>{t.document}</Th>
                    <Th>{t.dic}</Th>
                    <Th>{t.date}</Th>
                    <Th right>{t.rate21}</Th>
                    <Th right>{t.rate12}</Th>
                  </tr>
                </thead>
                <tbody className="border-y">
                  {a4.map((x) => (
                    <tr key={x.documentId} className="border-b last:border-0">
                      <td className="py-2 pr-3">
                        <DocLink report={report} id={x.documentId} />
                      </td>
                      <td className="py-2 pr-3">{x.dicOdb}</td>
                      <td className="py-2 pr-3">{formatDateCs(x.dppd)}</td>
                      <td className="py-2 pr-3 text-right">
                        <Money amount={x.base21} /> / <Money amount={x.vat21} />
                      </td>
                      <td className="py-2 text-right">
                        <Money amount={x.base12} /> / <Money amount={x.vat12} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Part>

        <Part title={t.a5} action={<DrillButton rowKey="kh.A5" count={a5Count} drill={drill} />}>
          {a5Empty ? (
            none
          ) : (
            <dl className="divide-y border-y text-sm">
              {(['21', '12'] as const).map((rate) => (
                <div key={rate} className="flex items-baseline justify-between gap-4 py-2.5">
                  <dt className="text-muted-foreground">{rate === '21' ? t.rate21 : t.rate12}</dt>
                  <dd>
                    <Money amount={a5[`base${rate}`]} /> / <Money amount={a5[`vat${rate}`]} />
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {drill.open === 'kh.A5' && <Drill report={report} rowKey="kh.A5" />}
        </Part>
        <p className="text-xs text-muted-foreground">{t.notIncluded}</p>
      </div>
    </SettingsSection>
  )
}
