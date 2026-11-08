import { Button } from '@fakturky/ui/components/button'
import { Money } from '@fakturky/ui/components/money'
import { ExternalLink } from 'lucide-react'
import { SettingsSection } from '@/components/settings-section'
import { cs } from '@/i18n/cs'
import type { VatReport } from './use-vat-report'

const t = cs.vat

/** Souhrnné hlášení: EU supplies by customer VAT ID. */
export function SummaryStatementSection({ report }: { report: VatReport }) {
  const th = 'py-2 pr-3 font-normal last:pr-0'
  return (
    <SettingsSection title={t.sh.title} description={t.sh.description}>
      {report.sh.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.sh.none}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[26rem] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th scope="col" className={th}>
                  {t.sh.country}
                </th>
                <th scope="col" className={th}>
                  {t.sh.vatId}
                </th>
                <th scope="col" className={th}>
                  {t.sh.code}
                </th>
                <th scope="col" className={`${th} text-right`}>
                  {t.sh.count}
                </th>
                <th scope="col" className={`${th} text-right`}>
                  {t.sh.value}
                </th>
              </tr>
            </thead>
            <tbody className="border-y">
              {report.sh.map((x) => (
                <tr key={`${x.country}${x.vatNumber}${x.code}`} className="border-b last:border-0">
                  <td className="py-2 pr-3">{x.country}</td>
                  <td className="py-2 pr-3">{x.vatNumber}</td>
                  <td className="py-2 pr-3">{x.code === '0' ? t.sh.code0 : t.sh.code3}</td>
                  <td className="py-2 pr-3 text-right">{x.count}</td>
                  <td className="py-2 text-right">
                    <Money amount={x.valueWhole} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SettingsSection>
  )
}

/** How to file the downloaded XML in EPO. */
export function FilingGuide() {
  return (
    <SettingsSection title={t.guide.title}>
      <div className="space-y-4">
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          {t.guide.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <Button
          nativeButton={false}
          variant="outline"
          render={<a href="https://www.mojedane.cz" target="_blank" rel="noreferrer" />}
        >
          <ExternalLink aria-hidden /> {t.guide.link}
        </Button>
      </div>
    </SettingsSection>
  )
}
